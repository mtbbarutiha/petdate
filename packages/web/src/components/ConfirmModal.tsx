import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';

export type ConfirmModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Disable dismiss / confirm while a parent action is in flight */
  busy?: boolean;
  /** Optional test id on the dialog panel */
  testId?: string;
};

/**
 * Public confirm dialog — Pepito lead-modal chrome (RTL, dark/light via --pd-*).
 * Esc + backdrop close, basic focus trap, restores focus on close.
 */
export function ConfirmModal({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
  testId = 'confirm-modal',
}: ConfirmModalProps) {
  const { t, dir } = useI18n();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
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
      const list = focusables();
      // Prefer primary confirm as first focus for keyboard users
      const confirmBtn = panel?.querySelector<HTMLElement>('[data-confirm-primary]');
      (confirmBtn ?? list[0] ?? panel)?.focus?.();
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
  }, [open, onCancel, busy]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="pepito-lead-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={panelRef}
        className="pepito-lead-modal pepito-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        dir={dir}
        tabIndex={-1}
        data-testid={testId}
      >
        <header className="pepito-lead-modal__head">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="pepito-lead-modal__close"
            aria-label={t('common.close')}
            onClick={onCancel}
            disabled={busy}
          >
            ×
          </button>
        </header>
        <div className="pepito-lead-modal__body">
          {children}
          <div className="pepito-lead-modal__actions">
            <button
              type="button"
              className="pepito-btn button-1"
              data-confirm-primary
              data-testid={`${testId}-confirm`}
              disabled={busy}
              onClick={onConfirm}
            >
              {confirmLabel ?? t('common.confirm')}
            </button>
            <button
              type="button"
              className="pepito-btn pepito-btn--ghost"
              data-testid={`${testId}-cancel`}
              disabled={busy}
              onClick={onCancel}
            >
              {cancelLabel ?? t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
