import { RowDataPacket } from 'mysql2/promise';
import { exec, query } from './db';

export type EmailStatus = 'scheduled' | 'sending' | 'sent' | 'failed';

export interface EmailRow extends RowDataPacket {
  id: number;
  batch_id: number;
  user_id: number;
  sender_id: number;
  to_email: string;
  subject: string;
  body: string;
  position: number;
  hourly_limit: number;
  scheduled_at: Date;
  status: EmailStatus;
  claimed_at: Date | null;
  sent_at: Date | null;
  message_id: string | null;
  preview_url: string | null;
  error: string | null;
}

export const getEmail = async (id: number) =>
  (await query<EmailRow>('SELECT * FROM emails WHERE id = ?', [id]))[0];

/**
 * Atomic claim: only ONE worker can flip scheduled -> sending.
 * A 'sending' row is re-claimable only if its claim is stale (worker crashed mid-send).
 */
export async function claim(id: number): Promise<boolean> {
  const r = await exec(
    `UPDATE emails SET status='sending', claimed_at=NOW(3)
     WHERE id=? AND (status='scheduled' OR (status='sending' AND claimed_at < NOW(3) - INTERVAL 60 SECOND))`,
    [id],
  );
  return r.affectedRows === 1;
}

export const reschedule = (id: number, runAt: Date, error: string | null = null) =>
  exec(`UPDATE emails SET status='scheduled', claimed_at=NULL, scheduled_at=?, error=? WHERE id=?`, [runAt, error, id]);

export const markSent = (id: number, messageId: string, previewUrl: string | null) =>
  exec(
    `UPDATE emails SET status='sent', sent_at=NOW(3), message_id=?, preview_url=?, error=NULL, claimed_at=NULL WHERE id=?`,
    [messageId, previewUrl, id],
  );

export const markFailed = (id: number, error: string) =>
  exec(`UPDATE emails SET status='failed', sent_at=NOW(3), error=?, claimed_at=NULL WHERE id=?`, [error.slice(0, 2000), id]);

export const markRetry = (id: number, error: string) =>
  exec(`UPDATE emails SET status='scheduled', claimed_at=NULL, error=? WHERE id=?`, [error.slice(0, 2000), id]);
