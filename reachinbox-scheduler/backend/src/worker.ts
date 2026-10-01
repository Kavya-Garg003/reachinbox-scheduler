import { DelayedError, Job, Worker } from 'bullmq';
import { config } from './config';
import { claim, getEmail, markFailed, markRetry, markSent, reschedule } from './emailRepo';
import { log } from './logger';
import { getSender, sendMail } from './mailer';
import { EmailJobData, QUEUE_NAME } from './queue';
import { consumeSlot, firstHitInWindow } from './rateLimiter';
import { makeRedis } from './redis';
import { reindex } from './search';
import { sendSlack } from './slack';

async function processor(job: Job<EmailJobData>, token?: string): Promise<string> {
  const { emailId } = job.data;
  const email = await getEmail(emailId);

  // Idempotency #1: already in a terminal state -> never send twice.
  if (!email || email.status === 'sent' || email.status === 'failed') return 'skipped';

  // Idempotency #2: atomic DB claim. Only one worker can own an email at a time.
  if (!(await claim(emailId))) {
    // Someone else holds a fresh claim (or this is a stalled re-run). Look again later instead of completing.
    await job.moveToDelayed(Date.now() + 30_000, token);
    throw new DelayedError();
  }

  const sender = await getSender(email.sender_id);
  if (!sender) {
    await markFailed(emailId, 'Sender account no longer exists');
    await reindex(emailId);
    return 'no-sender';
  }

  // Rate limit (per sender, per hour) using an atomic Redis counter shared by every worker/instance.
  const slot = await consumeSlot(sender.id, email.hourly_limit);
  if (!slot.allowed) {
    // Never drop or fail: push into the next hour window, staggered by original position to keep order.
    const runAt = new Date(slot.nextWindowStart + Math.min(email.position * 20, 60_000));
    await reschedule(emailId, runAt);
    await job.moveToDelayed(runAt.getTime(), token);
    void reindex(emailId);
    if (await firstHitInWindow(sender.id, slot.window)) {
      void sendSlack(
        email.user_id,
        `:warning: *ReachInbox Scheduler* - hourly limit reached for sender \`${sender.email}\` ` +
          `(${email.hourly_limit}/hour). Remaining emails were rescheduled to ${runAt.toISOString()} (UTC).`,
      );
    }
    log.info(`rate limit hit sender=${sender.id} email=${emailId} -> ${runAt.toISOString()}`);
    throw new DelayedError();
  }

  try {
    const r = await sendMail(sender, email.to_email, email.subject, email.body);
    // NOTE: a crash exactly between SMTP accept and this UPDATE could re-send once (at-least-once); see README trade-offs.
    await markSent(emailId, r.messageId, r.previewUrl);
    void reindex(emailId);
    log.info(`sent email=${emailId} to=${email.to_email} preview=${r.previewUrl ?? '-'}`);
    return 'sent';
  } catch (e) {
    await slot.release(); // failed sends don't burn the hourly quota
    await markRetry(emailId, (e as Error).message);
    throw e; // BullMQ retries with exponential backoff
  }
}

export function startWorker() {
  const worker = new Worker<EmailJobData>(QUEUE_NAME, processor, {
    connection: makeRedis(),
    concurrency: config.worker.concurrency,
    // Global (Redis-backed) throttle: at most 1 send per MIN_DELAY_BETWEEN_SENDS_MS across ALL workers.
    limiter: { max: 1, duration: config.worker.minDelayMs },
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const final = job.attemptsMade >= (job.opts.attempts ?? 1);
    log.warn(`job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`);
    if (final) {
      await markFailed(job.data.emailId, err.message);
      await reindex(job.data.emailId);
    }
  });
  worker.on('error', (e) => log.error('worker error', e.message));
  log.info(`worker started concurrency=${config.worker.concurrency} minDelay=${config.worker.minDelayMs}ms`);
  return worker;
}
