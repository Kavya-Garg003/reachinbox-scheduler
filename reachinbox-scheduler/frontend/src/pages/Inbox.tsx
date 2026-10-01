import { Filter, RefreshCw, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EmailRow } from '../components/EmailRow';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { useEmails, useStarred } from '../hooks/useEmails';
import { Link } from 'react-router-dom';

const FILTERS = {
  scheduled: [['', 'All'], ['scheduled', 'Waiting'], ['sending', 'Sending']],
  sent: [['', 'All'], ['sent', 'Sent'], ['failed', 'Failed']],
} as const;

export function Inbox({ variant }: { variant: 'scheduled' | 'sent' }) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState('');
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { starred, toggle } = useStarred();

  useEffect(() => { setPage(1); setState(''); setSearch(''); setQ(''); }, [variant]);
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 350); // debounce -> fewer Elasticsearch hits
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const { data, loading, refreshing, error, refresh } = useEmails(variant, q, page, state);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 15;
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="flex items-center gap-4 px-6 pb-4">
        <div className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            aria-label="Search emails"
            className="h-12 w-full rounded-full bg-surface pl-11 pr-4 text-[15px] outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div ref={menuRef} className="relative">
          <button onClick={() => setMenu((m) => !m)} aria-label="Filter" className={`rounded-full p-2.5 hover:bg-surface ${state ? 'text-brand-600' : 'text-slate-500'}`}>
            <Filter size={20} />
          </button>
          {menu && (
            <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-2xl border border-slate-200 bg-white p-1 shadow-lg">
              {FILTERS[variant].map(([value, label]) => (
                <button
                  key={label}
                  onClick={() => { setState(value); setPage(1); setMenu(false); }}
                  className={`block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-surface ${state === value ? 'font-semibold text-brand-600' : 'text-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={refresh} aria-label="Refresh" className="rounded-full p-2.5 text-slate-500 hover:bg-surface">
          <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center gap-3 py-24 text-slate-500"><Spinner /> Loading emails…</div>
      ) : error && !data ? (
        <div className="px-6 py-20 text-center text-sm text-red-600">Couldn't load emails: {error}</div>
      ) : items.length === 0 ? (
        q || state ? (
          <EmptyState title="No matches" description="Nothing matched your search or filter. Try part of an email address or subject." />
        ) : variant === 'scheduled' ? (
          <EmptyState title="No scheduled emails" description="Emails you schedule will show up here until they're sent."
            action={<Link to="/compose"><Button variant="outline">Compose</Button></Link>} />
        ) : (
          <EmptyState title="No sent emails yet" description="Once the scheduler delivers an email, it appears here." />
        )
      ) : (
        <>
          <div className="border-t border-slate-100">
            {items.map((e) => <EmailRow key={e.id} email={e} starred={starred.has(e.id)} onStar={() => toggle(e.id)} />)}
          </div>
          <div className="flex items-center justify-between px-6 py-4 text-sm text-slate-500">
            <span>{total} email{total === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-3">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
              <span>Page {page} / {pages}</span>
              <Button variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
