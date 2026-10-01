import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { useToast } from '../components/ui/Toast';

export function AppLayout() {
  const toast = useToast();

  // Slack OAuth round-trip feedback (?slack=connected|error)
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const s = p.get('slack');
    if (!s) return;
    toast(s === 'connected' ? 'Slack connected' : `Slack connection failed${p.get('message') ? `: ${p.get('message')}` : ''}`, s === 'connected' ? 'success' : 'error');
    history.replaceState({}, '', location.pathname);
  }, [toast]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 pt-4">
        <Outlet />
      </main>
    </div>
  );
}
