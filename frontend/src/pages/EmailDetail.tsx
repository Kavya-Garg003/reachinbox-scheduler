import { ArrowLeft, ChevronDown, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StatusPill } from '../components/StatusPill';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/Auth';
import { api } from '../lib/api';
import { formatFullDate } from '../lib/format';
import { EmailDetail as Detail } from '../lib/types';

export function EmailDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.get<Detail>(`/api/emails/${id}`).then(setEmail).catch((e: Error) => setError(e.message));
  }, [id]);

  return (
    <div className="min-h-screen px-6 pt-6 pb-16">
      <button onClick={() => nav(-1)} className="flex items-center gap-4 text-3xl font-light" aria-label="Back">
        <ArrowLeft size={28} /> {email?.subject ?? 'Email'}
      </button>

      <div className="mx-auto mt-10 max-w-4xl">
        {error ? (
          <div className="py-20 text-center text-sm text-red-600">{error}</div>
        ) : !email ? (
          <div className="flex justify-center py-20 text-slate-400"><Spinner /></div>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-medium text-white">
                {user.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-lg"><span className="font-semibold">{user.name}</span> <span className="text-slate-500">&lt;{email.sender}&gt;</span></div>
                <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-sm text-slate-500">
                  to {email.to} <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
                </button>
                {open && (
                  <div className="mt-2 rounded-xl bg-canvas p-3 text-sm text-slate-600">
                    <div>From: {email.sender}</div><div>To: {email.to}</div><div>Subject: {email.subject}</div>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-sm text-slate-500">{formatFullDate(email.status === 'sent' || email.status === 'failed' ? email.sentAt : email.scheduledAt)}</span>
                <StatusPill email={email} />
              </div>
            </div>

            <div className="rich mt-8 text-[17px]" dangerouslySetInnerHTML={{ __html: email.body }} />

            {email.status === 'failed' && email.error && (
              <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Delivery failed: {email.error}</div>
            )}
            {email.previewUrl && (
              <a href={email.previewUrl} target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline">
                Open delivered message on Ethereal <ExternalLink size={14} />
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
