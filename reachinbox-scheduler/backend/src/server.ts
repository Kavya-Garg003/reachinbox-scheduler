import 'express-async-errors'; // Express 4: route promise rejections -> error handler (no process crash)
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config';
import { pool } from './db';
import { log } from './logger';
import { emailQueue } from './queue';
import { redis } from './redis';
import { esAvailable } from './search';
import { authRouter } from './routes/auth';
import { emailsRouter, sendersRouter } from './routes/emails';
import { slackRouter } from './routes/slack';

function basicAuth(req: Request, res: Response, next: NextFunction) {
  const [scheme, encoded] = (req.headers.authorization ?? '').split(' ');
  if (scheme === 'Basic' && encoded) {
    const [u, ...p] = Buffer.from(encoded, 'base64').toString().split(':');
    if (u === config.bullBoard.user && p.join(':') === config.bullBoard.pass) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Bull Board"').status(401).send('Authentication required');
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());

  app.get('/health', async (_req, res) => {
    const out = { redis: false, mysql: false, elasticsearch: esAvailable() };
    try { out.redis = (await redis.ping()) === 'PONG'; } catch { /* ignore */ }
    try { await pool.query('SELECT 1'); out.mysql = true; } catch { /* ignore */ }
    res.status(out.redis && out.mysql ? 200 : 503).json(out);
  });

  // Live BullMQ dashboard
  const board = new ExpressAdapter();
  board.setBasePath('/admin/queues');
  createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter: board });
  app.use('/admin/queues', basicAuth, board.getRouter());

  app.use('/api/auth', authRouter);
  app.use('/api/emails', emailsRouter);
  app.use('/api/senders', sendersRouter);
  app.use('/api/slack', slackRouter);

  // Single-deploy mode: serve the built React app from the same origin.
  const dist = process.env.FRONTEND_DIST ?? path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get(/^\/(?!api|admin|health).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
    log.info('serving frontend from', dist);
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    log.error(err);
    res.status(500).json({ error: err.message || 'Internal error' });
  });
  return app;
}
