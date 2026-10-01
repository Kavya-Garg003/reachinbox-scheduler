import { Upload, X } from 'lucide-react';
import { ChangeEvent, KeyboardEvent, useRef, useState } from 'react';
import { extractEmails } from '../lib/emails';

interface Props { value: string[]; onChange: (v: string[]) => void }

const VISIBLE = 3;

export function RecipientInput({ value, onChange }: Props) {
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [source, setSource] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const add = (found: string[]) => onChange([...new Set([...value, ...found])]);
  const commit = () => { if (draft.trim()) add(extractEmails(draft)); setDraft(''); };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ' ', 'Tab'].includes(e.key) && draft.trim()) { e.preventDefault(); commit(); }
    else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const found = extractEmails(await f.text());
    setSource(`${found.length} email address${found.length === 1 ? '' : 'es'} detected in ${f.name}`);
    add(found);
    e.target.value = '';
  };

  const shown = expanded ? value : value.slice(0, VISIBLE);
  const hidden = value.length - shown.length;

  return (
    <div>
      <div className="flex items-center gap-4 border-b border-slate-200 pb-2">
        <div className="flex min-h-9 flex-1 flex-wrap items-center gap-2">
          {shown.map((r) => (
            <span key={r} className="group inline-flex items-center gap-1 rounded-full border border-brand-600 bg-brand-50 px-3 py-0.5 text-[15px]">
              {r}
              <button onClick={() => onChange(value.filter((x) => x !== r))} aria-label={`Remove ${r}`} className="hidden text-slate-500 hover:text-red-600 group-hover:block"><X size={13} /></button>
            </span>
          ))}
          {hidden > 0 && (
            <button onClick={() => setExpanded(true)} className="rounded-full border border-brand-600 bg-brand-50 px-3 py-0.5 text-[15px]">+{hidden}</button>
          )}
          {expanded && value.length > VISIBLE && (
            <button onClick={() => setExpanded(false)} className="text-xs text-slate-500 hover:underline">show less</button>
          )}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={commit}
            onPaste={(e) => { const t = e.clipboardData.getData('text'); if (t.includes('@')) { e.preventDefault(); add(extractEmails(t)); } }}
            placeholder={value.length ? '' : 'recipient@example.com'}
            aria-label="Recipients"
            className="min-w-40 flex-1 bg-transparent text-[17px] outline-none placeholder:text-slate-400"
          />
        </div>
        <button onClick={() => file.current?.click()} className="flex shrink-0 items-center gap-2 text-[17px] text-brand-600 hover:underline">
          <Upload size={18} /> Upload List
        </button>
        <input ref={file} type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onFile} className="hidden" />
      </div>
      {value.length > 0 && (
        <p className="mt-2 text-sm text-slate-500">
          <strong className="text-slate-700">{value.length}</strong> recipient{value.length === 1 ? '' : 's'}{source ? ` · ${source}` : ''}
        </p>
      )}
    </div>
  );
}
