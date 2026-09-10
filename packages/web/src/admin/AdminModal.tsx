import {
  useEffect,
  useId,
  useRef,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';

export type AdminModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

type AdminModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Optional footer (actions). Prefer form submit buttons inside children when using as="form". */
  footer?: ReactNode;
  size?: AdminModalSize;
  /** Render as <form> so Enter submits; wire onSubmit yourself. */
  as?: 'div' | 'form';
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  busy?: boolean;
  className?: string;
};

/**
 * Shared admin dialog: Pepito light theme, RTL-friendly, ESC + overlay close, basic focus trap.
 */
export function AdminModal({
  open,
  title,
  onClose,
  children,
  footer,
  size = 'md',
  as = 'div',
  onSubmit,
  busy = false,
  className = '',
}: AdminModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | HTMLFormElement | null>(null);
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

    const t = window.setTimeout(() => {
      const list = focusables();
      (list[0] ?? panel)?.focus?.();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
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
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  const panelClass = `admin-modal-card admin-form admin-modal-card--${size}${className ? ` ${className}` : ''}`;

  const body = (
    <>
      <div className="admin-modal-head">
        <h3 id={titleId}>{title}</h3>
        <button
          type="button"
          className="admin-modal-close"
          aria-label="بستن"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="admin-modal-body">{children}</div>
      {footer ? <div className="admin-modal-footer">{footer}</div> : null}
    </>
  );

  return (
    <div
      className="admin-modal"
      role="presentation"
      onMouseDown={(e) => {
        if (busy) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {as === 'form' ? (
        <form
          ref={panelRef as RefObject<HTMLFormElement>}
          className={panelClass}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onSubmit={onSubmit}
        >
          {body}
        </form>
      ) : (
        <div
          ref={panelRef as RefObject<HTMLDivElement>}
          className={panelClass}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          {body}
        </div>
      )}
    </div>
  );
}
