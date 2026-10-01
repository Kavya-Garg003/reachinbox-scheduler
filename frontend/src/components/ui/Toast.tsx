import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

type Kind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: Kind; message: string }
const Ctx = createContext<(message: string, kind?: Kind) => void>(() => {});
export const useToast = () => useContext(Ctx);

const color: Record<Kind, string> = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-slate-800' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, kind: Kind = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-lg px-4 py-3 text-sm text-white shadow-lg ${color[t.kind]}`}>{t.message}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
