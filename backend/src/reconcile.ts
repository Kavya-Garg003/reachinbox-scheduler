import { query } from './db';
import { log } from './logger';
import { emailQueue, jobFor, jobIdFor } from './queue';

/**
 * One-time startup self-heal (NOT a cron): every email the DB still considers pending must have a live
 * BullMQ job. If Redis lost data (or a job ended in failed/completed but the DB never caught up), re-add it.
 * Jobs use deterministic ids, so this can never create duplicates.
 */
export async function reconcile() {
  const rows = await query<{ id: number; scheduled_at: Date }>(
    `SELECT id, scheduled_at FROM emails WHERE status IN ('scheduled','sending')`,
  );
  let restored = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const jobs = await Promise.all(chunk.map((r) => emailQueue.getJob(jobIdFor(r.id))));
    const toAdd: typeof chunk = [];
    for (let j = 0; j < chunk.length; j++) {
      const job = jobs[j];
      if (!job) toAdd.push(chunk[j]);
      else {
        const state = await job.getState();
        if (state === 'failed' || state === 'completed') {
          await job.remove();
          toAdd.push(chunk[j]);
        }
      }
    }
    if (toAdd.length) {
      await emailQueue.addBulk(toAdd.map((r) => jobFor(r.id, new Date(r.scheduled_at))));
      restored += toAdd.length;
    }
  }
  log.info(`reconcile: ${rows.length} pending emails checked, ${restored} jobs restored`);
}
