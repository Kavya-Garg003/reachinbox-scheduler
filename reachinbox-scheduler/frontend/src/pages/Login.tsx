import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';

const field = 'h-14 w-full rounded-xl bg-surface px-6 text-[16px] outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-brand-100';

export function Login({ onLoggedIn }: { onLoggedIn: () => Promise<void> }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const err = new URLSearchParams(location.search).get('error');
    if (err) { toast(`Login failed: ${err}`, 'error'); history.replaceState({}, '', '/'); }
  }, [toast]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post<{ created: boolean }>('/api/auth/email', { email, password });
      if (r.created) toast('Account created', 'success');
      await onLoggedIn();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-[620px] rounded-2xl border border-slate-200 bg-white px-8 py-14 sm:px-[72px]">
        <h1 className="text-center text-5xl font-semibold">Login</h1>

        <a href="/api/auth/google" className="mt-12 flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-brand-50 text-[17px] transition hover:bg-brand-100">
          <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
            <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4-13.5-9.7l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
          Login with Google
        </a>

        <div className="my-8 flex items-center gap-4 text-sm tracking-wider text-slate-400">
          <span className="h-px flex-1 bg-slate-200" /> or sign up through email <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email ID" aria-label="Email ID" autoComplete="email" className={field} />
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" aria-label="Password" autoComplete="current-password" className={field} />
          <Button type="submit" loading={busy} className="!mt-7 h-14 w-full rounded-xl !text-lg">Login</Button>
        </form>
      </div>
    </div>
  );
}
