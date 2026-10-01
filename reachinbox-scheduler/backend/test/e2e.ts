/**
 * End-to-end check against real Redis + MySQL and a local SMTP sink (no Ethereal/network needed).
 * Verifies: scheduling, delayed send, per-sender hourly limit -> reschedule (not drop), idempotency,
 * and recovery after Redis data loss (reconcile).  Run: npm run e2e
 */
process.env.DATABASE_URL ??= 'mysql://app:app@127.0.0.1:3306/reachinbox_test';
process.env.SENDERS_PER_USER = '1';
process.env.MIN_DELAY_BETWEEN_SENDS_MS = '200';
process.env.WORKER_CONCURRENCY = '5';
process.env.ELASTICSEARCH_URL = 'http://127.0.0.1:1'; // force SQL fallback
process.env.PORT = '4111';

import assert from 'assert';
import jwt from 'jsonwebtoken';
import { SMTPServer } from 'smtp-server';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const received: string[] = [];
  const smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ['STARTTLS'],
    onAuth: (_a, _s, cb) => cb(null, { user: 'x' }),
    onRcptTo: (a, _s, cb) => { received.push(a.address); cb(); },
    onData: (s, _sess, cb) => { s.on('data', () => {}); s.on('end', cb); },
  });
  await new Promise<void>((r) => smtp.listen(2525, '127.0.0.1', r));

  const { config } = await import('../src/config');
  const { migrate, pool, exec, query } = await import('../src/db');
  const { redis } = await import('../src/redis');
  const { startWorker } = await import('../src/worker');
  const { reconcile } = await import('../src/reconcile');
  const { createApp } = await import('../src/server');
  const { initSearch } = await import('../src/search');

  await migrate();
  await initSearch();
  for (const t of ['emails', 'batches', 'senders', 'users']) await exec(`TRUNCATE TABLE ${t}`);
  await redis.flushall();

  const u = await exec(`INSERT INTO users (google_id,email,name) VALUES ('g1','t@t.io','Test')`);
  await exec(`INSERT INTO senders (user_id,email,smtp_host,smtp_port,smtp_user,smtp_pass) VALUES (?,?,?,?,?,?)`,
    [u.insertId, 'sender@test.io', '127.0.0.1', 2525, 'x', 'x']);
  const server = createApp().listen(4111);
  const cookie = `token=${jwt.sign({ uid: u.insertId }, config.jwtSecret)}`;
  const api = (p: string, body?: unknown) =>
    fetch(`http://127.0.0.1:4111${p}`, { method: body ? 'POST' : 'GET', headers: { cookie, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json() as Promise<any>);

  // 1) 6 emails, limit 3/hour, 1 sender -> exactly 3 sent, 3 pushed to next hour window (none dropped/failed)
  const rcpts = Array.from({ length: 6 }, (_, i) => `lead${i}@example.com`);
  const r1 = await api('/api/emails/schedule', { subject: 'Hi', body: 'Hello', recipients: rcpts, startTime: new Date().toISOString(), delaySeconds: 0, hourlyLimit: 3 });
  assert.equal(r1.scheduled, 6);

  let worker = startWorker();
  await sleep(6000);
  const s1 = await api('/api/emails/stats');
  console.log('after limit test:', s1, 'smtp received:', received.length);
  assert.equal(s1.sent, 3, 'exactly hourly limit sent');
  assert.equal(s1.scheduled, 3, 'rest still scheduled, not dropped');
  assert.equal(s1.failed, 0);
  const pending = await query<{ scheduled_at: Date }>(`SELECT scheduled_at FROM emails WHERE status='scheduled'`);
  assert(pending.every((p) => p.scheduled_at.getTime() > Date.now() + 1000), 'rescheduled into a future window');

  // 2) Delayed send + Redis data loss + restart recovery, with no duplicates
  await worker.close();
  await exec(`TRUNCATE TABLE emails`); await redis.flushall(); received.length = 0;
  const r2 = await api('/api/emails/schedule', { subject: 'Later', body: 'Body', recipients: ['a@x.io', 'b@x.io', 'c@x.io'], startTime: new Date(Date.now() + 3000).toISOString(), delaySeconds: 1, hourlyLimit: 100 });
  assert.equal(r2.scheduled, 3);
  await redis.flushall();          // simulate Redis losing every job while the server is "down"
  await reconcile();               // what happens on boot
  await reconcile();               // running twice must not duplicate
  worker = startWorker();
  await sleep(1500);
  assert.equal(received.length, 0, 'nothing sent before scheduled time');
  await sleep(6000);
  console.log('after restart test smtp received:', received);
  assert.equal(received.length, 3, 'each email sent exactly once');
  assert.equal(new Set(received).size, 3);

  // 3) search endpoint (SQL fallback here) + validation
  const found = await api('/api/emails?status=sent&q=b@x');
  assert.equal(found.total, 1);
  const bad = await api('/api/emails/schedule', { subject: '', body: 'x', recipients: [], startTime: 'nope' });
  assert(bad.error);

  // 4) rich-text body is sanitized, preview is plain text, detail endpoint works
  const r4 = await api('/api/emails/schedule', { subject: 'Rich', body: '<p>Hello <b>bold</b><script>alert(1)</script><img src=x onerror=alert(1)></p>', recipients: ['rich@x.io'], startTime: new Date(Date.now() + 3600_000).toISOString(), delaySeconds: 0, hourlyLimit: 10 });
  assert.equal(r4.scheduled, 1);
  const list = await api('/api/emails?status=scheduled&q=rich');
  assert.equal(list.items[0].preview, 'Hello bold');
  const detail = await api(`/api/emails/${list.items[0].id}`);
  assert(detail.body.includes('<b>bold</b>') && !detail.body.includes('script') && !detail.body.includes('onerror'), 'sanitized: ' + detail.body);
  const missing = await fetch(`http://127.0.0.1:4111/api/emails/999999`, { headers: { cookie } });
  assert.equal(missing.status, 404);

  // 5) email+password auth: signup, login, wrong password, /me via session cookie
  const post = (p: string, b: unknown) => fetch(`http://127.0.0.1:4111${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
  const su = await post('/api/auth/email', { email: 'New@User.io', password: 'secret1' });
  assert.equal(su.status, 200); assert.equal(((await su.json()) as any).created, true);
  const sessionCookie = su.headers.get('set-cookie')!.split(';')[0];
  const me = await fetch('http://127.0.0.1:4111/api/auth/me', { headers: { cookie: sessionCookie } });
  assert.equal(((await me.json()) as any).email, 'new@user.io');
  assert.equal((await post('/api/auth/email', { email: 'new@user.io', password: 'secret1' })).status, 200);
  assert.equal((await post('/api/auth/email', { email: 'new@user.io', password: 'wrong-pass' })).status, 401);
  assert.equal((await post('/api/auth/email', { email: 'bad', password: '1' })).status, 400);
  // 6) a throwing async route returns 500 JSON and the server stays alive (no process crash)
  const boom = await fetch('http://127.0.0.1:4111/api/senders', { headers: { cookie: sessionCookie } }); // new user -> tries to reach Ethereal
  console.log('senders for new user ->', boom.status);
  assert((await fetch('http://127.0.0.1:4111/health')).status === 200, 'server alive after error');

  console.log('\nALL E2E CHECKS PASSED');
  await worker.close(); server.close(); smtp.close(); await pool.end(); redis.disconnect();
  process.exit(0);
}
main().catch((e) => { console.error('E2E FAILED', e); process.exit(1); });
