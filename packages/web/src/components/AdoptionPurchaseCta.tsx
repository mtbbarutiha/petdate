import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { submitPetPurchaseLead } from '../lib/api';
import { useAppToast } from '../hooks/useAppToast';
import { useI18n } from '../i18n';

type PetPurchaseLeadModalProps = {
  open: boolean;
  onClose: () => void;
  sourcePage?: string;
};

export function PetPurchaseLeadModal({ open, onClose, sourcePage }: PetPurchaseLeadModalProps) {
  const { t, dir } = useI18n();
  const titleId = useId();
  const { toastSuccess, toastError } = useAppToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Reset only when the modal opens — do NOT depend on onClose identity.
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
      toastSuccess(t('adoption.ctaOk'));
      window.setTimeout(() => onClose(), 900);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('adoption.ctaErr');
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
        dir={dir}
      >
        <header className="pepito-lead-modal__head">
          <h2 id={titleId}>{t('adoption.modalTitle')}</h2>
          <button
            type="button"
            className="pepito-lead-modal__close"
            aria-label={t('adoption.close')}
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </header>
        {done ? (
          <div className="pepito-lead-modal__body">
            <p className="pepito-lead-modal__success">{t('adoption.modalOkBody')}</p>
            <button type="button" className="pepito-btn" onClick={onClose}>
              {t('adoption.modalOk')}
            </button>
          </div>
        ) : (
          <form className="pepito-lead-modal__body" onSubmit={(e) => void submit(e)}>
            <p className="pepito-lead-modal__lead">{t('adoption.modalLead')}</p>
            <label className="pepito-lead-modal__field">
              <span>{t('adoption.firstName')}</span>
              <input
                required
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="pepito-lead-modal__field">
              <span>{t('adoption.lastName')}</span>
              <input
                required
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="pepito-lead-modal__field">
              <span>{t('adoption.mobile')}</span>
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
                {busy ? t('adoption.sending') : t('adoption.submit')}
              </button>
              <button type="button" className="pepito-btn pepito-btn--ghost" onClick={onClose} disabled={busy}>
                {t('common.cancel')}
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
  const { t } = useI18n();
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
          {t('adoption.ctaLead')}
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
  label,
}: {
  className?: string;
  label?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const onClose = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <span className="pepito-btn-icon" aria-hidden>
          <i className="flaticon-pawprint-4" />
        </span>
        {label ?? t('adoption.ctaLead')}
      </button>
      <PetPurchaseLeadModal
        open={open}
        onClose={onClose}
        sourcePage={location.pathname || '/'}
      />
    </>
  );
}
