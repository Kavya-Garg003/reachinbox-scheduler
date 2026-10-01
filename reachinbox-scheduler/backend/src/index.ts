import { config } from './config';
import { migrate, pool } from './db';
import { log } from './logger';
import { emailQueue } from './queue';
import { reconcile } from './reconcile';
import { redis } from './redis';
import { initSearch } from './search';
import { createApp } from './server';
import { startWorker } from './worker';

async function main() {
  await migrate();
  await initSearch();
  await reconcile(); // restore any pending emails whose jobs are missing (e.g. Redis wiped)

  const worker = config.runWorker ? startWorker() : null;
  const server = config.runApi
    ? createApp().listen(config.port, () => log.info(`API on :${config.port}  |  Bull Board: ${config.appUrl}/admin/queues`))
    : null;

  const shutdown = async (sig: string) => {
    log.info(`${sig} received, shutting down gracefully`);
    server?.close();
    await worker?.close(); // waits for in-flight jobs; unfinished ones are safe in Redis
    await emailQueue.close();
    await pool.end();
    redis.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((e) => {
  log.error('fatal', e);
  process.exit(1);
});
