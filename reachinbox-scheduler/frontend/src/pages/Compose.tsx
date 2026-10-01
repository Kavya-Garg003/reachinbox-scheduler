import { ArrowLeft, ChevronDown, Clock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EditorHandle, RichTextEditor } from '../components/RichTextEditor';
import { RecipientInput } from '../components/RecipientInput';
import { SendLaterPopover } from '../components/SendLaterPopover';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { formatBadgeTime } from '../lib/format';
import { ScheduleResult, Sender } from '../lib/types';

const numBox =
  'h-12 w-24 rounded-xl border border-slate-200 bg-white px-3 text-lg outline-none placeholder:text-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100';

export function Compose() {
  const nav = useNavigate();
  const toast = useToast();
  const editor = useRef<EditorHandle>(null);
  const laterRef = useRef<HTMLDivElement>(null);

  const [senders, setSenders] = useState<Sender[]>([]);
  const [from, setFrom] = useState('all');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [delay, setDelay] = useState('');
  const [limit, setLimit] = useState('');
  const [sendAt, setSendAt] = useState<string | null>(null);
  const [laterOpen, setLaterOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<Sender[]>('/api/senders').then(setSenders).catch((e: Error) => toast(`Couldn't load sender accounts: ${e.message}`, 'error'));
  }, [toast]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!laterRef.current?.contains(e.target as Node)) setLaterOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const submit = async () => {
    const problems: string[] = [];
    if (recipients.length === 0) problems.push('Add at least one recipient (type one or use Upload List)');
    if (!subject.trim()) problems.push('Subject is required');
    if (!editor.current?.getText()) problems.push('Write the email body');
    if (delay !== '' && !(Number(delay) >= 0)) problems.push('Delay must be 0 or more seconds');
    if (limit !== '' && !(Number(limit) >= 1)) problems.push('Hourly limit must be at least 1');
    if (problems.length) return toast(problems[0], 'error');

    setSubmitting(true);
    try {
      const res = await api.post<ScheduleResult>('/api/emails/schedule', {
        subject,
        body: editor.current!.getHtml(),
        recipients,
        startTime: sendAt ? new Date(sendAt).toISOString() : new Date().toISOString(),
        delaySeconds: Number(delay || 0),
        hourlyLimit: Number(limit || 50),
        senderId: from === 'all' ? null : Number(from),
      });
      toast(`Scheduled ${res.scheduled} email${res.scheduled === 1 ? '' : 's'}`, 'success');
      nav('/scheduled');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-6 pt-6 pb-16">
      <div className="flex items-center justify-between">
        <button onClick={() => nav(-1)} className="flex items-center gap-4 text-3xl font-light" aria-label="Back">
          <ArrowLeft size={28} /> Compose New Email
        </button>
        <div ref={laterRef} className="relative flex items-center gap-3">
          {sendAt && <span className="text-sm text-slate-500">{formatBadgeTime(new Date(sendAt).toISOString())}</span>}
          <button onClick={() => setLaterOpen((o) => !o)} aria-label="Pick send time" title="Pick send time"
            className={`rounded-full p-2 hover:bg-surface ${sendAt ? 'text-brand-700' : 'text-brand-600'}`}>
            <Clock size={26} />
          </button>
          <Button variant="outline" loading={submitting} onClick={submit} className="h-11 px-6 text-base">
            {sendAt ? 'Send Later' : 'Send Now'}
          </Button>
          {laterOpen && <SendLaterPopover value={sendAt} onCancel={() => setLaterOpen(false)} onDone={(v) => { setSendAt(v); setLaterOpen(false); }} />}
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-5xl space-y-7">
        <div className="flex items-center gap-8">
          <span className="w-16 text-[17px]">From</span>
          <div className="relative">
            <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From"
              className="h-12 appearance-none rounded-xl bg-surface pl-4 pr-10 text-[17px] font-medium outline-none">
              <option value="all">All senders (rotate)</option>
              {senders.map((s) => <option key={s.id} value={s.id}>{s.email}</option>)}
            </select>
            <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div className="flex items-start gap-8">
          <span className="w-16 pt-1.5 text-[17px]">To</span>
          <div className="flex-1"><RecipientInput value={recipients} onChange={setRecipients} /></div>
        </div>

        <div className="flex items-center gap-8">
          <span className="w-16 text-[17px]">Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject"
            className="flex-1 border-b border-slate-200 bg-transparent pb-2 text-[17px] outline-none placeholder:text-slate-400 focus:border-brand-600" />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <span className="text-[17px]">Delay between 2 emails</span>
          <input type="number" min={0} value={delay} onChange={(e) => setDelay(e.target.value)} placeholder="00" aria-label="Delay between emails in seconds" className={numBox} />
          <span className="-ml-2 mr-4 text-sm text-slate-400">sec</span>
          <span className="text-[17px]">Hourly Limit</span>
          <input type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="00" aria-label="Hourly limit per sender" className={numBox} />
          <span className="-ml-2 text-sm text-slate-400">/ sender</span>
        </div>

        <RichTextEditor ref={editor} />
      </div>
    </div>
  );
}
