import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmailList, Stats } from '../lib/types';

const POLL_MS = 5000;

/** Fetches a page of emails and keeps it fresh (live status updates without a reload). */
export function useEmails(status: 'scheduled' | 'sent', q: string, page: number, state: string) {
  const [data, setData] = useState<EmailList | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent: boolean) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ status, page: String(page), limit: '15', ...(q ? { q } : {}), ...(state ? { state } : {}) });
      setData(await api.get<EmailList>(`/api/emails?${params}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status, q, page, state]);

  useEffect(() => {
    setData(null);
    void load(false);
    const t = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const refresh = async () => { setRefreshing(true); await load(true); setTimeout(() => setRefreshing(false), 400); };
  return { data, loading, refreshing, error, refresh };
}

export function useStats() {
  const [stats, setStats] = useState<Stats>({ scheduled: 0, sent: 0, failed: 0 });
  useEffect(() => {
    const run = () => api.get<Stats>('/api/emails/stats').then(setStats).catch(() => {});
    void run();
    const t = setInterval(run, POLL_MS);
    return () => clearInterval(t);
  }, []);
  return stats;
}

/** Starred emails are a client-side nicety (persisted in localStorage when available). */
export function useStarred() {
  const [ids, setIds] = useState<Set<number>>(() => {
    try { return new Set<number>(JSON.parse(localStorage.getItem('starred') ?? '[]')); } catch { return new Set(); }
  });
  const toggle = (id: number) =>
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('starred', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  return { starred: ids, toggle };
}
