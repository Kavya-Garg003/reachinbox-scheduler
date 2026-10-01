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

function transporterFor(s: Sender): Transporter {
  let t = transporters.get(s.id);
  if (!t) {
    t = nodemailer.createTransport({
      host: s.smtp_host,
      port: s.smtp_port,
      secure: false,
      auth: { user: s.smtp_user, pass: s.smtp_pass },
    });
    transporters.set(s.id, t);
  }
  return t;
}

export async function getSender(id: number): Promise<Sender | undefined> {
  return (await query<Sender>('SELECT * FROM senders WHERE id = ?', [id]))[0];
}

/** Every user gets N Ethereal (fake SMTP) sender accounts, created on first use. */
export async function ensureSenders(userId: number): Promise<Sender[]> {
  let senders = await query<Sender>('SELECT * FROM senders WHERE user_id = ? ORDER BY id', [userId]);
  const missing = config.sendersPerUser - senders.length;
  for (let i = 0; i < missing; i++) {
    const acc = await nodemailer.createTestAccount(); // https://ethereal.email
    await exec(
      'INSERT INTO senders (user_id, email, smtp_host, smtp_port, smtp_user, smtp_pass) VALUES (?,?,?,?,?,?)',
      [userId, acc.user, acc.smtp.host, acc.smtp.port, acc.user, acc.pass],
    );
    log.info('created Ethereal sender', acc.user);
  }
  if (missing > 0) senders = await query<Sender>('SELECT * FROM senders WHERE user_id = ? ORDER BY id', [userId]);
  return senders;
}

export async function sendMail(sender: Sender, to: string, subject: string, bodyHtml: string) {
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
