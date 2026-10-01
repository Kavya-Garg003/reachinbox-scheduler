import nodemailer, { Transporter } from 'nodemailer';
import { config } from './config';
import { exec, query } from './db';
import { log } from './logger';
import { htmlToText } from './sanitize';

export interface Sender {
  id: number;
  user_id: number;
  email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
}

const transporters = new Map<number, Transporter>();
const refreshing = new Map<number, Promise<void>>();

// Pooled + one connection per sender: re-uses a single authenticated SMTP session instead of logging in
// for every email (Ethereal throttles repeated logins).
function transporterFor(s: Sender): Transporter {
  let t = transporters.get(s.id);
  if (!t) {
    t = nodemailer.createTransport({
      host: s.smtp_host,
      port: s.smtp_port,
      secure: false,
      auth: { user: s.smtp_user, pass: s.smtp_pass },
      pool: true,
      maxConnections: 1,
      maxMessages: 100,
    });
    transporters.set(s.id, t);
  }
  return t;
}

export async function getSender(id: number): Promise<Sender | undefined> {
  return (await query<Sender>('SELECT * FROM senders WHERE id = ?', [id]))[0];
}

async function createEtherealSender(userId: number) {
  const acc = await nodemailer.createTestAccount(); // https://ethereal.email
  await exec(
    'INSERT INTO senders (user_id, email, smtp_host, smtp_port, smtp_user, smtp_pass) VALUES (?,?,?,?,?,?)',
    [userId, acc.user, acc.smtp.host, acc.smtp.port, acc.user, acc.pass],
  );
  log.info('created Ethereal sender', acc.user);
}

/** Every user gets N Ethereal (fake SMTP) sender accounts, created on first use. */
export async function ensureSenders(userId: number): Promise<Sender[]> {
  let senders = await query<Sender>('SELECT * FROM senders WHERE user_id = ? ORDER BY id', [userId]);
  const missing = config.sendersPerUser - senders.length;
  for (let i = 0; i < missing; i++) await createEtherealSender(userId);
  if (missing > 0) senders = await query<Sender>('SELECT * FROM senders WHERE user_id = ? ORDER BY id', [userId]);
  return senders;
}

/**
 * Ethereal deletes idle accounts (~48 h) and can invalidate logins. When a sender's credentials stop working
 * (SMTP 535) we provision a fresh Ethereal account and swap it into the SAME sender row, so queued emails keep
 * working. Concurrent jobs for one sender share a single refresh.
 */
async function refreshSender(s: Sender): Promise<void> {
  let p = refreshing.get(s.id);
  if (!p) {
    p = (async () => {
      const acc = await nodemailer.createTestAccount();
      await exec('UPDATE senders SET email=?, smtp_host=?, smtp_port=?, smtp_user=?, smtp_pass=? WHERE id=?', [
        acc.user, acc.smtp.host, acc.smtp.port, acc.user, acc.pass, s.id,
      ]);
      transporters.get(s.id)?.close();
      transporters.delete(s.id);
      log.warn(`sender ${s.id}: credentials rejected, rotated to fresh Ethereal account ${acc.user}`);
    })().finally(() => refreshing.delete(s.id));
    refreshing.set(s.id, p);
  }
  await p;
  const fresh = await getSender(s.id);
  if (fresh) Object.assign(s, fresh);
}

const isBadCredentials = (e: unknown) => (e as { responseCode?: number }).responseCode === 535;

async function deliver(sender: Sender, to: string, subject: string, bodyHtml: string) {
  const info = await transporterFor(sender).sendMail({
    from: `"ReachInbox Scheduler" <${sender.email}>`,
    to,
    subject,
    text: htmlToText(bodyHtml),
    html: bodyHtml,
  });
  const preview = nodemailer.getTestMessageUrl(info);
  return { messageId: info.messageId as string, previewUrl: preview || null };
}

export async function sendMail(sender: Sender, to: string, subject: string, bodyHtml: string) {
  try {
    return await deliver(sender, to, subject, bodyHtml);
  } catch (e) {
    if (!isBadCredentials(e)) throw e; // other errors (e.g. 403 rate limited) -> BullMQ retries with backoff
    await refreshSender(sender);
    return deliver(sender, to, subject, bodyHtml);
  }
}