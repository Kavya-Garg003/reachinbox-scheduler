import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatFullDate } from '../lib/format';
import { EmailItem } from '../lib/types';
import { StatusPill } from './StatusPill';

interface Props { email: EmailItem; starred: boolean; onStar: () => void }

export function EmailRow({ email, starred, onStar }: Props) {
  return (
    <Link to={`/email/${email.id}`} className="group flex items-center gap-6 border-b border-slate-100 px-6 py-5 transition hover:bg-canvas">
      <div className="w-56 shrink-0 truncate text-[15px] font-medium" title={email.to}>To: {email.to}</div>
      <div className="flex min-w-0 flex-1 items-center gap-2 text-[15px]">
        <StatusPill email={email} />
        <span className="truncate">
          <span className="font-medium">{email.subject}</span>
          {email.preview && <span className="text-slate-400"> - {email.preview}</span>}
        </span>
      </div>
      {(email.status === 'sent' || email.status === 'failed') && (
        <span className="hidden shrink-0 text-sm text-slate-400 md:block" title="Sent time">{formatFullDate(email.sentAt)}</span>
      )}
      <button
        aria-label={starred ? 'Unstar' : 'Star'}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onStar(); }}
        className="shrink-0 text-slate-300 transition hover:text-amber-400"
      >
        <Star size={20} className={starred ? 'fill-amber-400 text-amber-400' : ''} />
      </button>
    </Link>
  );
}
