import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { tr, useI18n } from '../i18n';

export type AppDialogKind = 'alert' | 'confirm' | 'prompt';
export type AppDialogVariant = 'admin' | 'public';

export type AppDialogRequest = {
  kind: AppDialogKind;
  variant?: AppDialogVariant;
  title?: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Prompt: empty value is allowed (native prompt). Default true. */
  optional?: boolean;
  /** Prompt field: textarea (notes) vs single-line (URLs). Default true for notes. */
  multiline?: boolean;
  danger?: boolean;
  testId?: string;
};

type Queued = {
  id: number;
  request: Required<Pick<AppDialogRequest, 'kind'>> & AppDialogRequest;
  resolve: (value: string | boolean | null) => void;
};

type Listener = () => void;

let seq = 0;
const queue: Queued[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn();
}

function detectVariant(): AppDialogVariant {
  if (typeof document !== 'undefined' && document.querySelector('.admin-app')) return 'admin';
  return 'public';
}

function enqueue(request: AppDialogRequest): Promise<string | boolean | null> {
  return new Promise((resolve) => {
    if (listeners.size === 0) {
      console.warn('[AppDialog] AppDialogHost is not mounted');
      resolve(request.kind === 'confirm' ? false : request.kind === 'prompt' ? null : true);
      return;
    }
    queue.push({
      id: ++seq,
      request: { optional: true, multiline: true, ...request, kind: request.kind },
      resolve,
    });
    emit();
  });
}

function settleCurrent(value: string | boolean | null) {
  const item = queue.shift();
  if (!item) return;
  item.resolve(value);
  emit();
}

/** In-app alert — replaces `window.alert`. */
export function appAlert(message: string, opts?: Omit<AppDialogRequest, 'kind' | 'message'>): Promise<void> {
  return enqueue({ kind: 'alert', message, ...opts }).then(() => undefined);
}

/** In-app confirm — replaces `window.confirm`. `true` = OK, `false` = Cancel. */
export function appConfirm(
  message: string,
  opts?: Omit<AppDialogRequest, 'kind' | 'message'>
): Promise<boolean> {
  return enqueue({ kind: 'confirm', message, ...opts }).then((v) => v === true);
}

/**
 * In-app prompt — replaces `window.prompt`.
 * Returns the entered string (may be empty) or `null` if cancelled.
 */
export function appPrompt(
  message: string,
  opts?: Omit<AppDialogRequest, 'kind' | 'message'>
): Promise<string | null> {
  return enqueue({ kind: 'prompt', message, ...opts }).then((v) =>
    typeof v === 'string' ? v : null
  );
}

function defaultTitle(req: AppDialogRequest): string {
  if (req.title) return req.title;
  if (req.kind === 'prompt') return req.message || tr('یادداشت');
  if (req.kind === 'alert') return tr('توجه');
  return tr('تأیید');
}

function AppDialogChrome({
  variant,
  title,
  titleId,
  testId,
  busy,
  onCancel,
  onSubmit,
  children,
  footer,
}: {
  variant: AppDialogVariant;
  title: string;
  titleId: string;
  testId: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit?: (e: FormEvent) => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const { t, dir } = useI18n();
  const panelRef = useRef<HTMLDivElement | HTMLFormElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => el.offsetParent !== null || el === document.activeElement)
        : [];

    const tFocus = window.setTimeout(() => {
      const field = panel?.querySelector<HTMLElement>('[data-app-dialog-field]');
      const primary = panel?.querySelector<HTMLElement>('[data-app-dialog-primary]');
      (field ?? primary ?? focusables()[0] ?? panel)?.focus?.();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(tFocus);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [busy, onCancel]);

  const adminRoot = typeof document !== 'undefined' ? document.querySelector('.admin-app') : null;
  const portalTarget = (variant === 'admin' && adminRoot) || document.body;

  const closeLabel = t('common.close');

  const overlayMouseDown = (e: ReactMouseEvent) => {
    if (busy) return;
    if (e.target === e.currentTarget) onCancel();
  };

  let node: ReactNode;
  if (variant === 'admin') {
    const body = (
      <>
        <div className="admin-modal-head">
          <h3 id={titleId}>{title}</h3>
          <button
            type="button"
            className="admin-modal-close"
            aria-label={closeLabel}
            disabled={busy}
            onClick={onCancel}
          >
            ×
          </button>
        </div>
        <div className="admin-modal-body">{children}</div>
        <div className="admin-modal-footer">{footer}</div>
      </>
    );
    node = (
      <div className="admin-modal app-dialog-overlay" role="presentation" onMouseDown={overlayMouseDown}>
        {onSubmit ? (
          <form
            ref={panelRef as RefObject<HTMLFormElement>}
            className="admin-modal-card admin-form admin-modal-card--sm app-dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            data-testid={testId}
            onSubmit={onSubmit}
          >
            {body}
          </form>
        ) : (
          <div
            ref={panelRef as RefObject<HTMLDivElement>}
            className="admin-modal-card admin-form admin-modal-card--sm app-dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            data-testid={testId}
          >
            {body}
          </div>
        )}
      </div>
    );
    if (!adminRoot) {
      node = (
        <div className="admin-app" style={{ display: 'contents' }}>
          {node}
        </div>
      );
    }
  } else {
    const body = (
      <>
        <header className="pepito-lead-modal__head">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="pepito-lead-modal__close"
            aria-label={closeLabel}
            onClick={onCancel}
            disabled={busy}
          >
            ×
          </button>
        </header>
        <div className="pepito-lead-modal__body">
          {children}
          <div className="pepito-lead-modal__actions">{footer}</div>
        </div>
      </>
    );
    node = (
      <div className="pepito-lead-modal-overlay app-dialog-overlay" role="presentation" onClick={overlayMouseDown}>
        {onSubmit ? (
          <form
            ref={panelRef as RefObject<HTMLFormElement>}
            className="pepito-lead-modal pepito-confirm-modal app-dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            dir={dir}
            tabIndex={-1}
            data-testid={testId}
            onSubmit={onSubmit}
          >
            {body}
          </form>
        ) : (
          <div
            ref={panelRef as RefObject<HTMLDivElement>}
            className="pepito-lead-modal pepito-confirm-modal app-dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            dir={dir}
            tabIndex={-1}
            data-testid={testId}
          >
            {body}
          </div>
        )}
      </div>
    );
  }

  return createPortal(node, portalTarget);
}

function AppDialogView({ item }: { item: Queued }) {
  const { t } = useI18n();
  const req = item.request;
  const variant = req.variant ?? detectVariant();
  const titleId = useId();
  const testId = req.testId || `app-dialog-${req.kind}`;
  const [value, setValue] = useState(req.defaultValue ?? '');

  const cancel = useCallback(() => {
    settleCurrent(req.kind === 'alert' ? true : req.kind === 'confirm' ? false : null);
  }, [req.kind]);

  const confirm = useCallback(() => {
    if (req.kind === 'prompt') {
      const trimmed = value.trim();
      if (!req.optional && !trimmed) return;
      settleCurrent(value);
      return;
    }
    settleCurrent(true);
  }, [req.kind, req.optional, value]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    confirm();
  };

  const confirmLabel = req.confirmLabel ?? t('common.confirm');
  const cancelLabel = req.cancelLabel ?? t('common.cancel');
  const title = defaultTitle(req);
  const showPromptBody = req.kind === 'prompt' && req.title && req.message;
  const showMessage = req.kind !== 'prompt' || showPromptBody;

  const fieldId = `${titleId}-field`;
  const requiredEmpty = req.kind === 'prompt' && !req.optional && !value.trim();

  const messageNode =
    showMessage && req.message ? (
      <p className={variant === 'admin' ? 'app-dialog-message' : 'pepito-lead-modal__lead app-dialog-message'}>
        {req.message}
      </p>
    ) : null;

  const fieldNode =
    req.kind === 'prompt' ? (
      variant === 'admin' ? (
        <label className="app-dialog-field" htmlFor={fieldId}>
          <span className="admin-muted">{req.optional ? tr('اختیاری') : tr('الزامی')}</span>
          {req.multiline === false ? (
            <input
              id={fieldId}
              className="admin-input"
              data-app-dialog-field
              value={value}
              placeholder={req.placeholder}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="off"
            />
          ) : (
            <textarea
              id={fieldId}
              className="admin-input app-dialog-textarea"
              data-app-dialog-field
              value={value}
              placeholder={req.placeholder}
              rows={3}
              onChange={(e) => setValue(e.target.value)}
            />
          )}
        </label>
      ) : (
        <label className="pepito-lead-modal__field app-dialog-field" htmlFor={fieldId}>
          <span>{req.optional ? t('common.optional') : t('common.required')}</span>
          {req.multiline === false ? (
            <input
              id={fieldId}
              data-app-dialog-field
              value={value}
              placeholder={req.placeholder}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="off"
            />
          ) : (
            <textarea
              id={fieldId}
              className="app-dialog-textarea"
              data-app-dialog-field
              value={value}
              placeholder={req.placeholder}
              rows={3}
              onChange={(e) => setValue(e.target.value)}
            />
          )}
        </label>
      )
    ) : null;

  const footer =
    variant === 'admin' ? (
      <>
        <button
          type={req.kind === 'prompt' ? 'submit' : 'button'}
          className={`admin-btn ${req.danger ? 'admin-btn--danger' : 'admin-btn--primary'}`}
          data-app-dialog-primary
          data-testid={`${testId}-confirm`}
          disabled={requiredEmpty}
          onClick={req.kind === 'prompt' ? undefined : confirm}
        >
          {confirmLabel}
        </button>
        {req.kind !== 'alert' ? (
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            data-testid={`${testId}-cancel`}
            onClick={cancel}
          >
            {cancelLabel}
          </button>
        ) : null}
      </>
    ) : (
      <>
        <button
          type={req.kind === 'prompt' ? 'submit' : 'button'}
          className={`pepito-btn button-1${req.danger ? ' app-dialog-btn--danger' : ''}`}
          data-app-dialog-primary
          data-testid={`${testId}-confirm`}
          disabled={requiredEmpty}
          onClick={req.kind === 'prompt' ? undefined : confirm}
        >
          {confirmLabel}
        </button>
        {req.kind !== 'alert' ? (
          <button
            type="button"
            className="pepito-btn pepito-btn--ghost"
            data-testid={`${testId}-cancel`}
            onClick={cancel}
          >
            {cancelLabel}
          </button>
        ) : null}
      </>
    );

  return (
    <AppDialogChrome
      variant={variant}
      title={title}
      titleId={titleId}
      testId={testId}
      busy={false}
      onCancel={cancel}
      onSubmit={req.kind === 'prompt' ? onSubmit : undefined}
      footer={footer}
    >
      {messageNode}
      {fieldNode}
    </AppDialogChrome>
  );
}

/** Mount once near the app root. Renders the active in-app alert/confirm/prompt. */
export function AppDialogHost() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  const current = queue[0];
  if (!current || typeof document === 'undefined') return null;
  return <AppDialogView key={current.id} item={current} />;
}
