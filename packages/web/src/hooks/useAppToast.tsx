import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type AppToastTone = 'info' | 'success' | 'error';

export type AppToastOptions = {
  tone?: AppToastTone;
  /** Auto-dismiss; default 3200 (error 4200). Pass 0 to keep until dismiss. */
  durationMs?: number;
};

type ToastItem = {
  id: number;
  message: string;
  tone: AppToastTone;
  durationMs: number;
};

type AppToastApi = {
  showToast: (message: string, options?: AppToastOptions) => void;
  toastSuccess: (message: string, options?: Omit<AppToastOptions, 'tone'>) => void;
  toastError: (message: string, options?: Omit<AppToastOptions, 'tone'>) => void;
  toastInfo: (message: string, options?: Omit<AppToastOptions, 'tone'>) => void;
  dismissToast: () => void;
};

const AppToastContext = createContext<AppToastApi | null>(null);

function defaultDuration(tone: AppToastTone, override?: number): number {
  if (override != null) return override;
  return tone === 'error' ? 4200 : 3200;
}

function ToastIcon({ tone }: { tone: AppToastTone }) {
  if (tone === 'success') return <CheckCircle2 size={18} strokeWidth={2.2} aria-hidden />;
  if (tone === 'error') return <AlertCircle size={18} strokeWidth={2.2} aria-hidden />;
  return <Info size={18} strokeWidth={2.2} aria-hidden />;
}

function AppToastHost({ toast, onDismiss }: { toast: ToastItem | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast || toast.durationMs <= 0) return;
    const t = window.setTimeout(onDismiss, toast.durationMs);
    return () => window.clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      className={`toast toast--${toast.tone}`}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
    >
      <span className="toast__icon">
        <ToastIcon tone={toast.tone} />
      </span>
      <span className="toast__msg">{toast.message}</span>
      <button type="button" className="toast__close" aria-label="بستن" onClick={onDismiss}>
        <X size={16} strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  );
}

export function AppToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const seqRef = useRef(0);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const showToast = useCallback((message: string, options?: AppToastOptions) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const tone = options?.tone ?? 'info';
    seqRef.current += 1;
    setToast({
      id: seqRef.current,
      message: trimmed,
      tone,
      durationMs: defaultDuration(tone, options?.durationMs),
    });
  }, []);

  const api = useMemo<AppToastApi>(
    () => ({
      showToast,
      toastSuccess: (message, options) => showToast(message, { ...options, tone: 'success' }),
      toastError: (message, options) => showToast(message, { ...options, tone: 'error' }),
      toastInfo: (message, options) => showToast(message, { ...options, tone: 'info' }),
      dismissToast,
    }),
    [showToast, dismissToast]
  );

  return (
    <AppToastContext.Provider value={api}>
      {children}
      <AppToastHost toast={toast} onDismiss={dismissToast} />
    </AppToastContext.Provider>
  );
}

export function useAppToast(): AppToastApi {
  const ctx = useContext(AppToastContext);
  if (!ctx) {
    throw new Error('useAppToast must be used within AppToastProvider');
  }
  return ctx;
}
