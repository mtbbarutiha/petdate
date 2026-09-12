import { useState } from 'react';
import { MessageCircleHeart } from 'lucide-react';
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
import { quickVetConnect } from '../lib/api';
import { authStore } from '../data/authStore';

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
 * هزینه ۶ سکه؛ قطع زیر ۱ ثانیه → بازگشت کامل (سمت API).
 */
export function OwnerConsultPanel({
  compact = false,
  variant = 'panel',
  onSent,
}: OwnerConsultPanelProps) {
  const { user } = useUserStore();
  const { user: authUser, token, isLoggedIn, refreshMe } = useAuthStore();
  const { toastError, toastSuccess } = useAppToast();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [statusLine, setStatusLine] = useState<string | null>(null);

  const myUserId = authUser?.id ?? user.id;
  const balance = authUser?.coins ?? user.coins ?? 0;
  const cost = SEEKER_ADVICE_COST;
  const ownerShare = SEEKER_OWNER_SHARE;

  async function runConnect(confirmResend = false) {
    if (!myUserId || !isLoggedIn) {
      toastError('خطا', 'اول وارد شو');
      return;
    }
    if (balance < cost) {
      toastError(
        'سکه کافی نیست',
        `برای مشورت با صاحبین حداقل ${formatCoins(cost)} سکه لازم داری. موجودی: ${formatCoins(balance)}`
      );
      return;
    }
    setBusy(true);
    setStatusLine('در حال ارسال درخواست…');
    try {
      const res = await quickVetConnect(myUserId, token ?? authStore.token, {
        kind: 'seeker_advice',
        confirmResend,
        humanOnly: true,
      });
      await refreshMe().catch(() => undefined);
      setStatusLine(res.message || `درخواست ارسال شد · ${formatCoins(res.cost)} سکه`);
      toastSuccess('درخواست ارسال شد', res.message);
      onSent?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ارسال ناموفق بود';
      if (/مجدد درخواست|resend/i.test(msg)) {
        setConfirmOpen(true);
        setStatusLine(null);
        return;
      }
      setStatusLine(null);
      toastError('مشورت با صاحبین', msg);
    } finally {
      setBusy(false);
    }
  }

  if (variant === 'header') {
    return (
      <>
        <button
          type="button"
          className="tg-icon-btn find-playmate-header owner-consult-header"
          onClick={() => void runConnect(false)}
          disabled={busy}
          aria-label="مشورت با صاحبین"
          title={`مشورت با صاحبین · ${formatCoins(cost)} سکه`}
        >
          <MessageCircleHeart size={18} />
          <span className="find-playmate-header__label">مشورت</span>
        </button>
        <ConfirmModal
          open={confirmOpen}
          title="ارسال مجدد؟"
          confirmLabel="بله، دوباره بفرست"
          cancelLabel="نه"
          busy={busy}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            void runConnect(true);
          }}
        >
          میخوای مجدد درخواست بدی به صاحبین؟
        </ConfirmModal>
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
        onClick={() => void runConnect(false)}
        data-testid="owner-consult-cta"
      >
        {busy ? 'در حال ارسال…' : `شروع مشورت · ${formatCoins(cost)} سکه`}
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
      <ConfirmModal
        open={confirmOpen}
        title="ارسال مجدد؟"
        confirmLabel="بله، دوباره بفرست"
        cancelLabel="نه"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void runConnect(true);
        }}
      >
        میخوای مجدد درخواست بدی به صاحبین؟
      </ConfirmModal>
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
