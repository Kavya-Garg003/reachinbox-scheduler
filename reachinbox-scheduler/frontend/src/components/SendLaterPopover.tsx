import { Calendar } from 'lucide-react';
import { useState } from 'react';
import { toLocalInput, tomorrowAt } from '../lib/format';
import { Button } from './ui/Button';

const QUICK: [string, () => string][] = [
  ['Tomorrow', () => tomorrowAt(9)],
  ['Tomorrow, 10:00 AM', () => tomorrowAt(10)],
  ['Tomorrow, 11:00 AM', () => tomorrowAt(11)],
  ['Tomorrow, 3:00 PM', () => tomorrowAt(15)],
];

interface Props { value: string | null; onDone: (v: string | null) => void; onCancel: () => void }

export function SendLaterPopover({ value, onDone, onCancel }: Props) {
  const [pending, setPending] = useState(value ?? '');
  const invalid = !!pending && new Date(pending).getTime() < Date.now() - 60_000;

  return (
    <div className="absolute right-0 top-full z-30 mt-3 w-[380px] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
      <h3 className="text-lg font-medium">Send Later</h3>

      <div className="relative mt-5 border-b border-slate-200 pb-2">
        <input
          type="datetime-local"
          min={toLocalInput(new Date())}
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          aria-label="Pick date and time"
          className="w-full bg-transparent pr-7 text-[15px] text-slate-700 outline-none [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
        />
        <Calendar size={16} className="pointer-events-none absolute right-0 top-1 text-slate-400" />
      </div>
      {invalid && <p className="mt-1 text-xs text-red-600">That time is in the past.</p>}

      <ul className="mt-4">
        {QUICK.map(([label, get]) => (
          <li key={label}>
            <button onClick={() => setPending(get())} className={`w-full rounded-lg px-1 py-2.5 text-left text-[15px] hover:bg-surface ${pending === get() ? 'font-semibold text-brand-600' : ''}`}>
              {label}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-end gap-5">
        {value && <button onClick={() => onDone(null)} className="mr-auto text-sm text-slate-500 hover:underline">Send now instead</button>}
        <button onClick={onCancel} className="text-[15px] font-medium">Cancel</button>
        <Button variant="outline" disabled={!pending || invalid} onClick={() => onDone(pending)}>Done</Button>
      </div>
    </div>
  );
}
