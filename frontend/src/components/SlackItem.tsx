import { Bell } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { SlackStatus } from '../lib/types';
import { useToast } from './ui/Toast';

export function SlackItem() {
  const toast = useToast();
  const [s, setS] = useState<SlackStatus | null>(null);
  const load = useCallback(() => api.get<SlackStatus>('/api/slack/status').then(setS).catch(() => {}), []);
  useEffect(() => { void load(); }, [load]);
  if (!s) return null;

  const disconnect = async () => { await api.del('/api/slack'); toast('Slack disconnected', 'info'); void load(); };
  const test = async () => {
    const r = await api.post<{ sent: boolean }>('/api/slack/test');
    toast(r.sent ? 'Test message sent to Slack' : 'Could not send to Slack', r.sent ? 'success' : 'error');
  };

  const link = 'text-xs font-medium text-brand-600 hover:underline';
  return (
    <div className="rounded-2xl px-3 py-2.5 text-[15px] text-slate-700">
      <div className="flex items-center gap-3">
        <Bell size={20} />
        <span className="flex-1">Slack alerts</span>
        <span className={`h-2 w-2 rounded-full ${s.connected ? 'bg-brand-600' : 'bg-slate-300'}`} title={s.connected ? 'Connected' : 'Not connected'} />
      </div>
      <div className="mt-1 pl-8 text-xs text-slate-500">
        {s.connected ? (
          <>
            <div className="truncate">Posting to {s.channel}{s.team ? ` · ${s.team}` : ''}</div>
            <div className="mt-1 flex gap-3">
              <button onClick={test} className={link}>Send test</button>
              <button onClick={disconnect} className="text-xs font-medium text-red-600 hover:underline">Disconnect</button>
            </div>
          </>
        ) : s.configured ? (
          <a href="/api/slack/connect" className={link}>Connect Slack →</a>
        ) : (
          <span>Slack app not configured</span>
        )}
      </div>
    </div>
  );
}
