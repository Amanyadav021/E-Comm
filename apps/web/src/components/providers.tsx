'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

// ---------------- Toasts ----------------

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<(kind: ToastKind, message: string) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

function ToastViewport({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {toasts.map((t) => {
        const Icon = icons[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className="toast-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg shadow-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <Icon
              className={
                t.kind === 'success' ? 'size-5 shrink-0 text-emerald-500' :
                t.kind === 'error' ? 'size-5 shrink-0 text-rose-500' : 'size-5 shrink-0 text-brand-500'
              }
            />
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Root providers ----------------

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++idRef.current;
    setToasts((ts) => [...ts.slice(-2), { id, kind, message }]);
    setTimeout(() => dismiss(id), 3500);
  }, [dismiss]);

  return (
    <QueryClientProvider client={client}>
      <ToastContext.Provider value={push}>
        {children}
        <ToastViewport toasts={toasts} dismiss={dismiss} />
      </ToastContext.Provider>
    </QueryClientProvider>
  );
}
