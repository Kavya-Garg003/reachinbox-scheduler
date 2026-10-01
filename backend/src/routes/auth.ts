import crypto from 'crypto';
import { NextFunction, Request, Response, Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import { z } from 'zod';
import { config } from '../config';
import { exec, query } from '../db';

export const authRouter = Router();

const oauth = () =>
  new OAuth2Client(config.google.clientId, config.google.clientSecret, `${config.appUrl}/api/auth/google/callback`);

const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, secure: config.isProd, path: '/' };

const scrypt = promisify(crypto.scrypt) as unknown as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
async function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16);
  return `${salt.toString('hex')}:${(await scrypt(pw, salt, 64)).toString('hex')}`;
}
async function verifyPassword(pw: string, stored: string) {
  const [salt, hash] = stored.split(':');
  const calc = await scrypt(pw, Buffer.from(salt, 'hex'), 64);
  return crypto.timingSafeEqual(calc, Buffer.from(hash, 'hex'));
}

const startSession = (res: Response, uid: number) =>
  res.cookie('token', jwt.sign({ uid }, config.jwtSecret, { expiresIn: '7d' }), { ...cookieOpts, maxAge: 7 * 24 * 3600 * 1000 });

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token as string | undefined;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const p = jwt.verify(token, config.jwtSecret) as unknown as { uid: number };
    req.userId = p.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired' });
  }
}

/* ---------- Google OAuth ---------- */
authRouter.get('/google', (_req, res) => {
  if (!config.google.clientId) return res.status(503).json({ error: 'GOOGLE_CLIENT_ID not configured' });
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, { ...cookieOpts, maxAge: 10 * 60 * 1000 });
  res.redirect(oauth().generateAuthUrl({ scope: ['openid', 'email', 'profile'], prompt: 'select_account', state }));
});

authRouter.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state || state !== req.cookies?.oauth_state) throw new Error('Invalid OAuth state');
    const client = oauth();
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token!, audience: config.google.clientId });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email || !p.email_verified) throw new Error('Google account email not verified');
    const email = p.email.toLowerCase();

    const [existing] = await query<{ id: number }>('SELECT id FROM users WHERE google_id = ? OR email = ? LIMIT 1', [p.sub, email]);
    let uid: number;
    if (existing) {
      uid = existing.id;
      await exec('UPDATE users SET google_id=?, name=?, avatar=? WHERE id=?', [p.sub, p.name ?? email, p.picture ?? null, uid]);
    } else {
      uid = (await exec('INSERT INTO users (google_id, email, name, avatar) VALUES (?,?,?,?)', [p.sub, email, p.name ?? email, p.picture ?? null])).insertId;
    }
    res.clearCookie('oauth_state', cookieOpts);
    startSession(res, uid);
    res.redirect(`${config.frontendUrl}/scheduled`);
  } catch (e) {
    res.redirect(`${config.frontendUrl}/?error=${encodeURIComponent((e as Error).message)}`);
  }
});

/* ---------- Email + password (the Figma login form): logs in, or signs up if the email is new ---------- */
const emailAuth = z.object({ email: z.string().trim().toLowerCase().email().max(255), password: z.string().min(6).max(200) });

authRouter.post('/email', async (req, res) => {
  const parsed = emailAuth.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and a password of at least 6 characters' });
  const { email, password } = parsed.data;

  const [u] = await query<{ id: number; password_hash: string | null }>('SELECT id, password_hash FROM users WHERE email = ?', [email]);
  let uid: number;
  if (u) {
    if (!u.password_hash) return res.status(401).json({ error: 'This account uses Google sign-in. Use "Login with Google".' });
    if (!(await verifyPassword(password, u.password_hash))) return res.status(401).json({ error: 'Incorrect email or password' });
    uid = u.id;
  } else {
    uid = (await exec('INSERT INTO users (email, name, password_hash) VALUES (?,?,?)', [email, email.split('@')[0], await hashPassword(password)])).insertId;
  }
  startSession(res, uid);
  res.json({ ok: true, created: !u });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const [u] = await query<{ id: number; name: string; email: string; avatar: string | null }>(
    'SELECT id, name, email, avatar FROM users WHERE id = ?',
    [req.userId],
  );
  if (!u) return res.status(401).json({ error: 'User not found' });
  res.json(u);
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('token', cookieOpts);
  res.json({ ok: true });
});
