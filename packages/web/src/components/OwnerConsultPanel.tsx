import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircleHeart, UserRound, UserRoundSearch } from 'lucide-react';
import {
  SEEKER_ADVICE_COST,
  SEEKER_OWNER_SHARE,
  primaryRole,
  toPersianDigits,
} from '@petdate/shared';
import { ConfirmModal } from './ConfirmModal';
import { useAuthStore } from '../hooks/useAuthStore';
import { useAppToast } from '../hooks/useAppToast';
import { useUserStore } from '../hooks/useUserStore';
import { useI18n } from '../i18n';
import { quickVetConnect } from '../lib/api';

function formatCoins(n: number): string {
  return toPersianDigits(String(n));
}

export type OwnerConsultPanelProps = {
  compact?: boolean;
  variant?: 'panel' | 'header';
  onSent?: () => void;
};

/**
 * «مشورت با صاحبین» — جایگزین پیدا کردن همبازی برای نقش بدون پت / بدون نقش صاحب.
 * هزینه ۵ سکه؛ قطع زیر ۱ ثانیه → بازگشت کامل (سمت API).
 * CTA مثل همبازی: انتخاب جنسیت مشاور قبل از ارسال.
 */
export function OwnerConsultPanel({
  compact = false,
  variant = 'panel',
  onSent,
}: OwnerConsultPanelProps) {
  const { t } = useI18n();
  const { user } = useUserStore();
  const { user: authUser, token, isLoggedIn, refreshMe } = useAuthStore();
  const { toastError, toastSuccess } = useAppToast();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [genderPickOpen, setGenderPickOpen] = useState(false);
  const [pendingGender, setPendingGender] = useState<'female' | 'male' | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);

  const myUserId = authUser?.id ?? user.id;
  const balance = authUser?.coins ?? authUser?.wallet?.coins ?? 0;
  const cost = SEEKER_ADVICE_COST;
  const ownerShare = SEEKER_OWNER_SHARE;

  function openGenderPick() {
    if (!myUserId || !isLoggedIn) {
      toastError('اول وارد شو');
      return;
    }
    if (balance < cost) {
      toastError(
        `برای مشورت با صاحبین حداقل ${formatCoins(cost)} سکه لازم داری. موجودی: ${formatCoins(balance)}`
      );
      return;
    }
    setPendingGender(null);
    setGenderPickOpen(true);
  }

  function dismissGenderPick() {
    if (busy) return;
    setGenderPickOpen(false);
  }

  function chooseGender(gender: 'female' | 'male') {
    setGenderPickOpen(false);
    setPendingGender(gender);
    void runConnect(false, gender);
  }

  async function runConnect(
    confirmResend = false,
    ownerGender?: 'female' | 'male' | null
  ) {
    if (!myUserId || !isLoggedIn) {
      toastError('اول وارد شو');
      return;
    }
    if (balance < cost) {
      toastError(
        `برای مشورت با صاحبین حداقل ${formatCoins(cost)} سکه لازم داری. موجودی: ${formatCoins(balance)}`
      );
      return;
    }
    const gender = ownerGender ?? pendingGender ?? undefined;
    setBusy(true);
    setStatusLine('در حال ارسال درخواست…');
    try {
      const res = await quickVetConnect(myUserId, token, {
        kind: 'seeker_advice',
        confirmResend,
        humanOnly: true,
        ownerGender: gender ?? undefined,
      });
      await refreshMe().catch(() => undefined);
      setStatusLine(res.message || `درخواست ارسال شد · ${formatCoins(res.cost)} سکه`);
      toastSuccess(res.message || 'درخواست مشورت با صاحبین ارسال شد');
      setPendingGender(null);
      onSent?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ارسال ناموفق بود';
      if (/مجدد درخواست|resend/i.test(msg)) {
        setConfirmOpen(true);
        setStatusLine(null);
        return;
      }
      setStatusLine(null);
      toastError(msg);
    } finally {
      setBusy(false);
    }
  }

  const genderModal =
    genderPickOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="pepito-lead-modal-overlay"
            role="presentation"
            data-testid="owner-consult-gender"
            onClick={(e) => {
              if (e.target === e.currentTarget && !busy) dismissGenderPick();
            }}
          >
            <div
              className="pepito-lead-modal pepito-confirm-modal"
              role="dialog"
              aria-modal="true"
              aria-label={t('chats.consultOwnerGenderTitle')}
            >
              <header className="pepito-lead-modal__head">
                <h2>{t('chats.consultOwnerGenderTitle')}</h2>
                <button
                  type="button"
                  className="pepito-lead-modal__close"
                  aria-label={t('common.close')}
                  onClick={dismissGenderPick}
                  disabled={busy}
                >
                  ×
                </button>
              </header>
              <div className="pepito-lead-modal__body">
                <div
                  className="find-playmate-gender-options"
                  role="group"
                  aria-label={t('chats.consultOwnerGenderTitle')}
                >
                  <button
                    type="button"
                    className="pepito-btn button-1 find-playmate-gender-btn"
                    data-testid="owner-consult-gender-female"
                    disabled={busy}
                    onClick={() => chooseGender('female')}
                  >
                    <UserRound size={18} strokeWidth={2.25} aria-hidden />
                    {t('chats.consultOwnerGenderFemale')}
                  </button>
                  <button
                    type="button"
                    className="pepito-btn button-1 find-playmate-gender-btn"
                    data-testid="owner-consult-gender-male"
                    disabled={busy}
                    onClick={() => chooseGender('male')}
                  >
                    <UserRoundSearch size={18} strokeWidth={2.25} aria-hidden />
                    {t('chats.consultOwnerGenderMale')}
                  </button>
                </div>
                <p className="pepito-lead-modal__lead" style={{ marginTop: 12 }}>
                  هزینه: {formatCoins(cost)} سکه · موجودی: {formatCoins(balance)} سکه
                </p>
                <div className="pepito-lead-modal__actions">
                  <button
                    type="button"
                    className="pepito-btn button-2"
                    onClick={dismissGenderPick}
                    disabled={busy}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const resendModal = (
    <ConfirmModal
      open={confirmOpen}
      title="ارسال مجدد؟"
      confirmLabel="بله، دوباره بفرست"
      cancelLabel="نه"
      busy={busy}
      onCancel={() => setConfirmOpen(false)}
      onConfirm={() => {
        setConfirmOpen(false);
        void runConnect(true, pendingGender);
      }}
    >
      میخوای مجدد درخواست بدی به صاحبین؟
    </ConfirmModal>
  );

  const ctaLabel = busy ? 'در حال ارسال…' : t('chats.consultCta');
  const headerLabel = busy ? '…' : t('chats.consultCtaShort');

  if (variant === 'header') {
    return (
      <>
        <div className="find-playmate-header owner-consult-header">
          <button
            type="button"
            className="find-playmate-header-btn"
            onClick={openGenderPick}
            disabled={busy}
            aria-label={t('chats.consultCta')}
            title={`${t('chats.consultCta')} · ${formatCoins(cost)} سکه`}
            data-testid="owner-consult-header"
          >
            <span className="pepito-btn-icon find-playmate-paw" aria-hidden>
              <MessageCircleHeart size={18} strokeWidth={2.25} />
            </span>
            <span>{headerLabel}</span>
          </button>
        </div>
        {genderModal}
        {resendModal}
      </>
    );
  }

  return (
    <div className={`owner-consult-panel${compact ? ' owner-consult-panel--compact' : ''}`}>
      <div className="owner-consult-panel__visual" aria-hidden>
        <MessageCircleHeart size={compact ? 28 : 36} strokeWidth={1.75} />
      </div>
      <h2 className="owner-consult-panel__title">مشورت با صاحبین</h2>
      <p className="owner-consult-panel__lead">
        درباره نگهداری پت، هزینه‌ها و شروع زندگی با حیوان خانگی از صاحبین باتجربه بپرس.
      </p>
      <p className="owner-consult-panel__fee">
        هزینه: <strong>{formatCoins(cost)}</strong> سکه
        <span className="owner-consult-panel__fee-split">
          {' '}
          ({formatCoins(ownerShare)} صاحب + {formatCoins(cost - ownerShare)} پلتفرم)
        </span>
      </p>
      <p className="owner-consult-panel__balance">
        موجودی تو: <strong>{formatCoins(balance)}</strong> سکه
      </p>
      {statusLine ? <p className="owner-consult-panel__status">{statusLine}</p> : null}
      <button
        type="button"
        className="pepito-btn button-1 owner-consult-panel__cta"
        disabled={busy || balance < cost}
        onClick={openGenderPick}
        data-testid="owner-consult-cta"
      >
        <span className="pepito-btn-icon" aria-hidden>
          <MessageCircleHeart size={16} strokeWidth={2.25} />
        </span>
        {ctaLabel}
      </button>
      {balance < cost ? (
        <p className="owner-consult-panel__hint owner-consult-panel__hint--warn" role="alert">
          سکه کافی نیست — از کیف‌پول سکه بگیر.
        </p>
      ) : (
        <p className="owner-consult-panel__hint">
          اگر گفتگو زیر یک ثانیه قطع شود، هر {formatCoins(cost)} سکه برمی‌گردد.
        </p>
      )}
      {genderModal}
      {resendModal}
    </div>
  );
}

/** نقش فعال بدون پت / بدون نقش صاحب → CTA مشورت با صاحبین به‌جای همبازی */
export function shouldShowOwnerConsultCta(user?: {
  role?: string | null;
  roles?: string[] | null;
} | null): boolean {
  const active = primaryRole(
    (user?.roles as ('pet_owner' | 'vet' | 'trainer' | 'no_pet')[] | null | undefined) ?? null,
    (user?.role as 'pet_owner' | 'vet' | 'trainer' | 'no_pet' | null | undefined) ?? null
  );
  if (!active) return true;
  return active === 'no_pet';
}
