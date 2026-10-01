import 'dotenv/config';

const int = (k: string, d: number) => parseInt(process.env[k] ?? '', 10) || d;
const str = (k: string, d = '') => process.env[k] ?? d;

export const config = {
  env: str('NODE_ENV', 'development'),
  isProd: process.env.NODE_ENV === 'production',
  port: int('PORT', 4000),
  appUrl: str('APP_URL', 'http://localhost:4000').replace(/\/$/, ''),
  frontendUrl: str('FRONTEND_URL', 'http://localhost:5173').replace(/\/$/, ''),
  jwtSecret: str('JWT_SECRET', 'dev-secret-change-me'),
  redisUrl: str('REDIS_URL', 'redis://localhost:6379'),
  databaseUrl: str('DATABASE_URL', 'mysql://root:root@localhost:3306/reachinbox'),
  elasticUrl: str('ELASTICSEARCH_URL', 'http://localhost:9200'),
  elasticApiKey: str('ELASTICSEARCH_API_KEY'), // Elastic Cloud
  elasticUser: str('ELASTICSEARCH_USERNAME'),
  elasticPass: str('ELASTICSEARCH_PASSWORD'),
  databaseSsl: process.env.DATABASE_SSL === 'true', // managed MySQL (Aiven, TiDB...) needs TLS
  google: { clientId: str('GOOGLE_CLIENT_ID'), clientSecret: str('GOOGLE_CLIENT_SECRET') },
  slack: { clientId: str('SLACK_CLIENT_ID'), clientSecret: str('SLACK_CLIENT_SECRET') },
  worker: {
    concurrency: int('WORKER_CONCURRENCY', 5),
    minDelayMs: int('MIN_DELAY_BETWEEN_SENDS_MS', 2000),
  },
  rate: {
    defaultPerHour: int('DEFAULT_EMAILS_PER_HOUR_PER_SENDER', 50),
    maxPerHour: int('MAX_EMAILS_PER_HOUR_PER_SENDER', 200),
  },
  sendersPerUser: int('SENDERS_PER_USER', 3),
  runWorker: process.env.RUN_WORKER !== 'false',
  runApi: process.env.RUN_API !== 'false',
  bullBoard: { user: str('BULL_BOARD_USER', 'admin'), pass: str('BULL_BOARD_PASS', 'admin') },
};
