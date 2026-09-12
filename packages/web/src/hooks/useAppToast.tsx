import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, Info, TriangleAlert, X } from 'lucide-react';
import { useI18nOptional } from '../i18n';
import { splitToastCopy } from '../lib/toastCopy';

export { splitToastCopy };

export type AppToastTone = 'info' | 'success' | 'error' | 'warning';

export type AppToastAction = {
  label: string;
  onClick: () => void;
};

export type AppToastOptions = {
  tone?: AppToastTone;
  /** Optional heading; `message` then becomes the body. */
  title?: string;
  /** Auto-dismiss; default 3200 (error/warning 4200). Pass 0 to keep until dismiss. */
  durationMs?: number;
  /** Optional text button (does not change existing call-site signatures). */
  action?: AppToastAction;
};

type ToastItem = {
  id: number;
  message: string;
  title?: string;
  tone: AppToastTone;
  durationMs: number;
  action?: AppToastAction;
};

type AppToastApi = {
  showToast: (message: string, options?: AppToastOptions) => void;
  toastSuccess: (message: string, options?: Omit<AppToastOptions, 'tone'>) => void;
  toastError: (message: string, options?: Omit<AppToastOptions, 'tone'>) => void;
  toastInfo: (message: string, options?: Omit<AppToastOptions, 'tone'>) => void;
  toastWarning: (message: string, options?: Omit<AppToastOptions, 'tone'>) => void;
  dismissToast: () => void;
};

const AppToastContext = createContext<AppToastApi | null>(null);

const EXIT_MS = 220;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function defaultDuration(tone: AppToastTone, override?: number): number {
  if (override != null) return override;
  return tone === 'error' || tone === 'warning' ? 4200 : 3200;
}

function ToastIcon({ tone }: { tone: AppToastTone }) {
  if (tone === 'success') return <Check size={18} strokeWidth={2.6} aria-hidden />;
  if (tone === 'error') return <AlertCircle size={18} strokeWidth={2.2} aria-hidden />;
  if (tone === 'warning') return <TriangleAlert size={18} strokeWidth={2.2} aria-hidden />;
  return <Info size={18} strokeWidth={2.2} aria-hidden />;
}

function AppToastCard({
  toast,
  leaving,
  onDismiss,
}: {
  toast: ToastItem;
  leaving: boolean;
  onDismiss: () => void;
}) {
  const i18n = useI18nOptional();
  const closeLabel = i18n?.t('common.close') ?? 'بستن';
  const { title, body } = splitToastCopy(toast.message, toast.title);
  const ttl = toast.durationMs > 0 ? toast.durationMs : 0;

  return (
    <div
      className={`toast toast--${toast.tone}${leaving ? ' is-leaving' : ' is-enter'}`}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-testid="app-toast"
      style={ttl ? ({ '--toast-ttl': `${ttl}ms` } as CSSProperties) : undefined}
    >
      <span className="toast__icon">
        <ToastIcon tone={toast.tone} />
      </span>
      <div className="toast__copy">
        <p className="toast__title">{title}</p>
        {body ? <p className="toast__body">{body}</p> : null}
      </div>
      {toast.action ? (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      ) : null}
      <button type="button" className="toast__close" aria-label={closeLabel} onClick={onDismiss}>
        <X size={15} strokeWidth={2.3} aria-hidden />
      </button>
      {ttl > 0 ? <span className="toast__ttl" aria-hidden /> : null}
    </div>
  );
}

function AppToastHost({ toast, onDismiss }: { toast: ToastItem | null; onDismiss: () => void }) {
  const [view, setView] = useState<{ item: ToastItem; leaving: boolean } | null>(
    toast ? { item: toast, leaving: false } : null
  );
  const leaveGen = useRef(0);

  useEffect(() => {
    if (toast) {
      leaveGen.current += 1;
      setView({ item: toast, leaving: false });
      return;
    }
    setView((cur) => {
      if (!cur || cur.leaving) return cur;
      const id = cur.item.id;
      const gen = leaveGen.current;
      if (prefersReducedMotion()) return null;
      window.setTimeout(() => {
        if (leaveGen.current !== gen) return;
        setView((v) => (v?.item.id === id ? null : v));
      }, EXIT_MS);
      return { ...cur, leaving: true };
    });
  }, [toast]);

  const requestLeave = useCallback(
    (id: number) => {
      const gen = leaveGen.current;
      setView((cur) => {
        if (!cur || cur.item.id !== id || cur.leaving) return cur;
        return { ...cur, leaving: true };
      });
      const finish = () => {
        if (leaveGen.current !== gen) return;
        setView((cur) => (cur?.item.id === id ? null : cur));
        onDismiss();
      };
      if (prefersReducedMotion()) {
        finish();
        return;
      }
      window.setTimeout(finish, EXIT_MS);
    },
    [onDismiss]
  );

  useEffect(() => {
    if (!toast || toast.durationMs <= 0) return;
    const id = toast.id;
    const timer = window.setTimeout(() => requestLeave(id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast, requestLeave]);

  if (!view || typeof document === 'undefined') return null;

  return createPortal(
    <div className="toast-host" data-testid="app-toast-host">
      <AppToastCard
        toast={view.item}
        leaving={view.leaving}
        onDismiss={() => requestLeave(view.item.id)}
      />
    </div>,
    document.body
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
    if (!trimmed && !options?.title?.trim()) return;
    const tone = options?.tone ?? 'info';
    seqRef.current += 1;
    setToast({
      id: seqRef.current,
      message: trimmed,
      title: options?.title?.trim() || undefined,
      tone,
      durationMs: defaultDuration(tone, options?.durationMs),
      action: options?.action,
    });
  }, []);

  const api = useMemo<AppToastApi>(
    () => ({
      showToast,
      toastSuccess: (message, options) => showToast(message, { ...options, tone: 'success' }),
      toastError: (message, options) => showToast(message, { ...options, tone: 'error' }),
      toastInfo: (message, options) => showToast(message, { ...options, tone: 'info' }),
      toastWarning: (message, options) => showToast(message, { ...options, tone: 'warning' }),
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
