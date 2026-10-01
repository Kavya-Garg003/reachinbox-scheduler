import { ResultSetHeader } from 'mysql2';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { pool, query } from '../db';
import { EmailRow } from '../emailRepo';
import { ensureSenders } from '../mailer';
import { emailQueue, jobFor } from '../queue';
import { cleanHtml, htmlToText, previewOf } from '../sanitize';
import { indexEmails, searchIds } from '../search';
import { requireAuth } from './auth';

export const emailsRouter = Router();
export const sendersRouter = Router();
emailsRouter.use(requireAuth);
sendersRouter.use(requireAuth);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** GET /api/senders - the user's Ethereal sender accounts (created on first call). */
sendersRouter.get('/', async (req, res) => {
  const senders = await ensureSenders(req.userId!);
  res.json(senders.map((s) => ({ id: s.id, email: s.email })));
});

const scheduleSchema = z.object({
  subject: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(200_000), // rich-text HTML from the editor (sanitized below)
  recipients: z.array(z.string()).min(1).max(5000),
  startTime: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid startTime'),
  delaySeconds: z.coerce.number().int().min(0).max(86_400).default(0),
  hourlyLimit: z.coerce.number().int().min(1).default(config.rate.defaultPerHour),
  senderId: z.coerce.number().int().nullish(), // omit/null = rotate across all of the user's senders
});

/** POST /api/emails/schedule */
emailsRouter.post('/schedule', async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  const d = parsed.data;

  const bodyHtml = cleanHtml(d.body);
  if (!htmlToText(bodyHtml)) return res.status(400).json({ error: 'Email body is empty' });
  const preview = previewOf(bodyHtml);

  const recipients = [...new Set(d.recipients.map((r) => r.trim().toLowerCase()).filter((r) => EMAIL_RE.test(r)))];
  if (recipients.length === 0) return res.status(400).json({ error: 'No valid email addresses found' });

  const userId = req.userId!;
  const hourlyLimit = Math.min(d.hourlyLimit, config.rate.maxPerHour);
  const start = new Date(Math.max(Date.parse(d.startTime), Date.now()));
  const all = await ensureSenders(userId);
  const senders = d.senderId ? all.filter((s) => s.id === d.senderId) : all;
  if (senders.length === 0) return res.status(400).json({ error: 'Unknown sender' });

  const [batch] = (await pool.query(
    'INSERT INTO batches (user_id, subject, hourly_limit, delay_seconds, start_at, total) VALUES (?,?,?,?,?,?)',
    [userId, d.subject, hourlyLimit, d.delaySeconds, start, recipients.length],
  )) as unknown as [ResultSetHeader];
  const batchId = batch.insertId;

  // Email i is sent at start + i * delay, round-robin across the chosen sender(s).
  const values = recipients.map((to, i) => [
    batchId, userId, senders[i % senders.length].id, to, d.subject, bodyHtml, preview, i, hourlyLimit,
    new Date(start.getTime() + i * d.delaySeconds * 1000),
  ]);
  for (let i = 0; i < values.length; i += 500) {
    await pool.query(
      'INSERT INTO emails (batch_id, user_id, sender_id, to_email, subject, body, preview, position, hourly_limit, scheduled_at) VALUES ?',
      [values.slice(i, i + 500)],
    );
  }

  const rows = await query<EmailRow>('SELECT * FROM emails WHERE batch_id = ? ORDER BY position', [batchId]);
  for (let i = 0; i < rows.length; i += 500) {
    await emailQueue.addBulk(rows.slice(i, i + 500).map((r) => jobFor(r.id, new Date(r.scheduled_at))));
  }
  void indexEmails(rows);

  res.status(201).json({
    batchId,
    scheduled: rows.length,
    skippedInvalid: d.recipients.length - recipients.length,
    firstAt: rows[0].scheduled_at,
    lastAt: rows[rows.length - 1].scheduled_at,
    hourlyLimit,
  });
});

const SELECT = `SELECT e.id, e.to_email, e.subject, e.preview, e.status, e.scheduled_at, e.sent_at, e.preview_url, e.error, s.email AS sender
                FROM emails e JOIN senders s ON s.id = e.sender_id`;
type ListRow = { id: number; to_email: string; subject: string; preview: string; status: string; scheduled_at: Date; sent_at: Date | null; preview_url: string | null; error: string | null; sender: string };
const toDto = (r: ListRow) => ({
  id: r.id, to: r.to_email, subject: r.subject, preview: r.preview, status: r.status, scheduledAt: r.scheduled_at,
  sentAt: r.sent_at, previewUrl: r.preview_url, error: r.error, sender: r.sender,
});

/** GET /api/emails?status=scheduled|sent&state=&q=&page=&limit= */
emailsRouter.get('/', async (req, res) => {
  const userId = req.userId!;
  const sent = req.query.status === 'sent';
  const group = sent ? ['sent', 'failed'] : ['scheduled', 'sending'];
  const state = String(req.query.state ?? '');
  const statuses = group.includes(state) ? [state] : group; // optional filter within the tab
  const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 20, 1), 100);
  const page = Math.max(parseInt(String(req.query.page)) || 1, 1);
  const q = String(req.query.q ?? '').trim();
  const offset = (page - 1) * limit;

  if (q) {
    const hit = await searchIds(userId, q, statuses, limit, offset); // Elasticsearch
    if (hit) {
      const rows = hit.ids.length ? await query<ListRow>(`${SELECT} WHERE e.user_id = ? AND e.id IN (?)`, [userId, hit.ids]) : [];
      const byId = new Map(rows.map((r) => [r.id, r]));
      const items = hit.ids.map((id) => byId.get(id)).filter(Boolean).map((r) => toDto(r!));
      return res.json({ items, total: hit.total, page, limit, engine: 'elasticsearch' });
    }
  }

  const where = `e.user_id = ? AND e.status IN (?)` + (q ? ' AND (e.to_email LIKE ? OR e.subject LIKE ? OR e.preview LIKE ?)' : '');
  const params: unknown[] = [userId, statuses, ...(q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [])];
  const order = sent ? 'e.sent_at DESC, e.id DESC' : 'e.scheduled_at ASC, e.id ASC';
  const [{ c }] = await query<{ c: number }>(`SELECT COUNT(*) AS c FROM emails e WHERE ${where}`, params);
  const rows = await query<ListRow>(`${SELECT} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, [...params, limit, offset]);
  res.json({ items: rows.map(toDto), total: c, page, limit, engine: q ? 'sql' : undefined });
});

/** GET /api/emails/stats */
emailsRouter.get('/stats', async (req, res) => {
  const rows = await query<{ status: string; c: number }>(
    'SELECT status, COUNT(*) AS c FROM emails WHERE user_id = ? GROUP BY status',
    [req.userId],
  );
  const n = (s: string) => rows.find((r) => r.status === s)?.c ?? 0;
  res.json({ scheduled: n('scheduled') + n('sending'), sent: n('sent'), failed: n('failed') });
});

/** GET /api/emails/:id - full email for the detail view (body is sanitized HTML). */
emailsRouter.get('/:id(\\d+)', async (req, res) => {
  const [r] = await query<ListRow & { body: string }>(
    `SELECT e.id, e.to_email, e.subject, e.body, e.preview, e.status, e.scheduled_at, e.sent_at, e.preview_url, e.error, s.email AS sender
     FROM emails e JOIN senders s ON s.id = e.sender_id WHERE e.id = ? AND e.user_id = ?`,
    [req.params.id, req.userId],
  );
  if (!r) return res.status(404).json({ error: 'Email not found' });
  res.json({ ...toDto(r), body: r.body });
});
