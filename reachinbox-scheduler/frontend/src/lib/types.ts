export interface User { id: number; name: string; email: string; avatar: string | null }
export type EmailStatus = 'scheduled' | 'sending' | 'sent' | 'failed';
export interface EmailItem {
  id: number; to: string; subject: string; preview: string; status: EmailStatus;
  scheduledAt: string; sentAt: string | null; previewUrl: string | null; error: string | null; sender: string;
}
export interface EmailDetail extends EmailItem { body: string }
export interface EmailList { items: EmailItem[]; total: number; page: number; limit: number; engine?: string }
export interface Stats { scheduled: number; sent: number; failed: number }
export interface Sender { id: number; email: string }
export interface SlackStatus { configured: boolean; connected: boolean; team: string | null; channel: string | null }
export interface ScheduleInput {
  subject: string; body: string; recipients: string[]; startTime: string;
  delaySeconds: number; hourlyLimit: number; senderId?: number | null;
}
export interface ScheduleResult { batchId: number; scheduled: number; skippedInvalid: number; firstAt: string; lastAt: string; hourlyLimit: number }
