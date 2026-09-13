import {
  useId,
  useRef,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { tr } from '../i18n';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';

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
 * Shared admin dialog: Pepito light theme, RTL-friendly, ESC + overlay close.
 * Focus trap lives in useDialogFocusTrap — initial focus runs once on open
 * so inline onClose / form keystrokes cannot steal focus back to ×.
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
  useDialogFocusTrap({ active: open, panelRef, onDismiss: onClose, busy });

  if (!open) return null;

  const panelClass = `admin-modal-card admin-form admin-modal-card--${size}${className ? ` ${className}` : ''}`;

  const body = (
    <>
      <div className="admin-modal-head">
        <h3 id={titleId}>{title}</h3>
        <button
          type="button"
          className="admin-modal-close"
          aria-label={tr("بستن")}
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
