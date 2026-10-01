import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Spinner } from './components/ui/Spinner';
import { AuthContext } from './context/Auth';
import { api } from './lib/api';
import { User } from './lib/types';
import { AppLayout } from './layouts/AppLayout';
import { Compose } from './pages/Compose';
import { EmailDetail } from './pages/EmailDetail';
import { Inbox } from './pages/Inbox';
import { Login } from './pages/Login';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  const loadUser = useCallback(
    () => api.get<User>('/api/auth/me').then(setUser).catch(() => setUser(null)),
    [],
  );
  useEffect(() => { void loadUser().finally(() => setChecking(false)); }, [loadUser]);
  const logout = useCallback(async () => { await api.post('/api/auth/logout'); setUser(null); }, []);

  if (checking) return <div className="flex min-h-screen items-center justify-center text-brand-600"><Spinner className="h-8 w-8" /></div>;
  if (!user) return <Login onLoggedIn={loadUser} />;

  return (
    <AuthContext.Provider value={{ user, logout }}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/scheduled" element={<Inbox variant="scheduled" />} />
            <Route path="/sent" element={<Inbox variant="sent" />} />
          </Route>
          <Route path="/compose" element={<Compose />} />
          <Route path="/email/:id" element={<EmailDetail />} />
          <Route path="*" element={<Navigate to="/scheduled" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
