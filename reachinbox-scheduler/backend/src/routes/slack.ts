import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { completeSlackOAuth, disconnectSlack, getSlackConnection, sendSlack, slackAuthorizeUrl } from '../slack';
import { requireAuth } from './auth';

export const slackRouter = Router();

// Callback comes from Slack's redirect; identity is proven by the signed `state` JWT we issued.
slackRouter.get('/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  try {
    if (error || !code || !state) throw new Error(error ?? 'Missing code');
    const p = jwt.verify(state, config.jwtSecret) as unknown as { uid: number; p: string };
    if (p.p !== 'slack') throw new Error('Bad state');
    await completeSlackOAuth(p.uid, code);
    res.redirect(`${config.frontendUrl}/scheduled?slack=connected`);
  } catch (e) {
    res.redirect(`${config.frontendUrl}/scheduled?slack=error&message=${encodeURIComponent((e as Error).message)}`);
  }
});

slackRouter.use(requireAuth);

slackRouter.get('/status', async (req, res) => {
  const c = await getSlackConnection(req.userId!);
  res.json({ configured: !!config.slack.clientId, connected: !!c, team: c?.team_name ?? null, channel: c?.channel ?? null });
});

slackRouter.get('/connect', (req, res) => {
  if (!config.slack.clientId) return res.status(503).json({ error: 'SLACK_CLIENT_ID not configured' });
  const state = jwt.sign({ uid: req.userId, p: 'slack' }, config.jwtSecret, { expiresIn: '10m' });
  res.redirect(slackAuthorizeUrl(state));
});

slackRouter.delete('/', async (req, res) => {
  await disconnectSlack(req.userId!);
  res.json({ ok: true });
});

slackRouter.post('/test', async (req, res) => {
  const sent = await sendSlack(req.userId!, ':white_check_mark: ReachInbox Scheduler is connected to this channel.');
  res.json({ sent });
});
