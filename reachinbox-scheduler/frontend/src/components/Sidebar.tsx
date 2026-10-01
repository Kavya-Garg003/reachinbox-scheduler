import { ChevronDown, Clock, ExternalLink, LogOut, Send } from 'lucide-react';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { useStats } from '../hooks/useEmails';
import { initials } from '../lib/format';
import { SlackItem } from './SlackItem';

function NavItem({ to, icon, label, count }: { to: string; icon: ReactNode; label: string; count: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] transition ${
          isActive ? 'bg-brand-50 font-semibold text-slate-900' : 'text-slate-700 hover:bg-surface'
        }`
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
      <span className="pr-2 text-sm font-normal text-slate-500">{count}</span>
    </NavLink>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 rounded-2xl bg-surface px-3 py-3 text-left">
        {user.avatar ? (
          <img src={user.avatar} alt={user.name} referrerPolicy="no-referrer" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">{initials(user.name)}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium leading-tight">{user.name}</div>
          <div className="truncate text-xs text-slate-500">{user.email}</div>
        </div>
        <ChevronDown size={18} className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-lg">
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-surface">
            <LogOut size={16} /> Logout
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const stats = useStats();
  return (
    <aside className="sticky top-0 flex h-screen w-[300px] shrink-0 flex-col gap-4 overflow-y-auto p-3 pt-4">
      <Link to="/scheduled" className="px-2 font-pixel text-[34px] leading-none tracking-tight">ONB</Link>
      <UserMenu />
      <Link to="/compose" className="flex h-11 items-center justify-center rounded-full border border-brand-600 text-[15px] font-medium text-brand-600 transition hover:bg-brand-50">
        Compose
      </Link>

      <div>
        <div className="mb-2 mt-3 px-3 text-xs tracking-wide text-slate-400">CORE</div>
        <NavItem to="/scheduled" icon={<Clock size={20} />} label="Scheduled" count={stats.scheduled} />
        <NavItem to="/sent" icon={<Send size={20} />} label="Sent" count={stats.sent + stats.failed} />
      </div>

      <div>
        <div className="mb-2 mt-3 px-3 text-xs tracking-wide text-slate-400">INTEGRATIONS</div>
        <SlackItem />
        <a href="/admin/queues" target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] text-slate-700 hover:bg-surface">
          <ExternalLink size={20} /> <span className="flex-1">Queue dashboard</span>
        </a>
      </div>
    </aside>
  );
}
