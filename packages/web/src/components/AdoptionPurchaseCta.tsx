import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { submitPetPurchaseLead } from '../lib/api';
import { useAppToast } from '../hooks/useAppToast';

const CTA_LABEL = 'درخواست خرید پت و تماس با مشاور پت دیت با شما';

type PetPurchaseLeadModalProps = {
  open: boolean;
  onClose: () => void;
  sourcePage?: string;
};

export function PetPurchaseLeadModal({ open, onClose, sourcePage }: PetPurchaseLeadModalProps) {
  const titleId = useId();
  const { toastSuccess, toastError } = useAppToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Reset only when the modal opens — do NOT depend on onClose identity.
  // WelcomePage carousels re-render often; an inline onClose() => … would wipe the form mid-type/submit.
  useEffect(() => {
    if (!open) return;
    setFirstName('');
    setLastName('');
    setMobile('');
    setError(null);
    setDone(false);
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await submitPetPurchaseLead({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobile: mobile.trim(),
        sourcePage,
      });
      setDone(true);
      toastSuccess('درخواست ثبت شد — مشاور پت‌دیت به‌زودی تماس می‌گیرد.');
      window.setTimeout(() => onClose(), 900);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در ثبت درخواست';
      setError(msg);
      toastError(msg);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="pepito-lead-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="pepito-lead-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        dir="rtl"
      >
        <header className="pepito-lead-modal__head">
          <h2 id={titleId}>درخواست خرید پت</h2>
          <button
            type="button"
            className="pepito-lead-modal__close"
            aria-label="بستن"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </header>
        {done ? (
          <div className="pepito-lead-modal__body">
            <p className="pepito-lead-modal__success">
              درخواست شما ثبت شد. مشاور پت‌دیت به‌زودی با شما تماس می‌گیرد.
            </p>
            <button type="button" className="pepito-btn" onClick={onClose}>
              باشه
            </button>
          </div>
        ) : (
          <form className="pepito-lead-modal__body" onSubmit={(e) => void submit(e)}>
            <p className="pepito-lead-modal__lead">
              نام، نام خانوادگی و شماره موبایل را وارد کنید تا مشاور پت‌دیت با شما تماس بگیرد.
            </p>
            <label className="pepito-lead-modal__field">
              <span>نام</span>
              <input
                required
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="pepito-lead-modal__field">
              <span>نام خانوادگی</span>
              <input
                required
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="pepito-lead-modal__field">
              <span>شماره موبایل</span>
              <input
                required
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder="0912…"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                disabled={busy}
              />
            </label>
            {error ? <p className="pepito-lead-modal__error">{error}</p> : null}
            <div className="pepito-lead-modal__actions">
              <button type="submit" className="pepito-btn" disabled={busy}>
                {busy ? 'در حال ارسال…' : 'ثبت درخواست'}
              </button>
              <button type="button" className="pepito-btn pepito-btn--ghost" onClick={onClose} disabled={busy}>
                انصراف
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}

/** Pepito adoption CTA strip: purchase-consult lead button only (adopting tag removed). */
export function AdoptionPurchaseCta() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const onClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <div className="pepito-adoption-info">
        <button
          type="button"
          className="pepito-btn pepito-adoption-lead-btn"
          onClick={() => setOpen(true)}
        >
          <span className="pepito-btn-icon" aria-hidden>
            <i className="flaticon-pawprint-4" />
          </span>
          {CTA_LABEL}
        </button>
      </div>
      <PetPurchaseLeadModal
        open={open}
        onClose={onClose}
        sourcePage={location.pathname || '/'}
      />
    </>
  );
}

export function PetPurchaseLeadButton({
  className = 'pepito-btn button-1',
  label = CTA_LABEL,
}: {
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const onClose = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <span className="pepito-btn-icon" aria-hidden>
          <i className="flaticon-pawprint-4" />
        </span>
        {label}
      </button>
      <PetPurchaseLeadModal
        open={open}
        onClose={onClose}
        sourcePage={location.pathname || '/'}
      />
    </>
  );
}
