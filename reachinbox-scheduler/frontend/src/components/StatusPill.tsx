import { Clock } from 'lucide-react';
import { formatBadgeTime } from '../lib/format';
import { EmailItem } from '../lib/types';

const base = 'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium';

export function StatusPill({ email }: { email: Pick<EmailItem, 'status' | 'scheduledAt'> }) {
  switch (email.status) {
    case 'scheduled':
      return (
        <span className={`${base} border border-orange-200 bg-orange-100 text-orange-700`}>
          <Clock size={13} /> {formatBadgeTime(email.scheduledAt)}
        </span>
      );
    case 'sending':
      return <span className={`${base} bg-blue-100 text-blue-700`}>Sending…</span>;
    case 'failed':
      return <span className={`${base} bg-red-100 text-red-700`}>Failed</span>;
    default:
      return <span className={`${base} bg-slate-100 text-slate-600`}>Sent</span>;
  }
}
