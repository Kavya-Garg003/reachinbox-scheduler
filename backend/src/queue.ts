import { Queue } from 'bullmq';
import { redis } from './redis';

export const QUEUE_NAME = 'email-jobs';
export interface EmailJobData {
  emailId: number;
}

export const emailQueue = new Queue<EmailJobData>(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: { age: 24 * 3600, count: 5000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

/** jobId = email-<id> => BullMQ ignores duplicate adds => idempotent enqueue. */
export const jobIdFor = (emailId: number) => `email-${emailId}`;

export const jobFor = (emailId: number, runAt: Date) => ({
  name: 'send',
  data: { emailId },
  opts: { jobId: jobIdFor(emailId), delay: Math.max(0, runAt.getTime() - Date.now()) },
});