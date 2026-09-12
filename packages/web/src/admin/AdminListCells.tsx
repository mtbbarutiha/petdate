import {
  VERIFICATION_STATUS_LABELS,
  WALLET_CURRENCY_LABELS_FA,
  type User,
  type VerificationStatus,
  type WalletCurrency,
} from '@petdate/shared';
import { formatNumFa } from './api';
import { tr } from '../i18n';

/** Compact labeled wallet balances — avoids cramped C:/T:/★/₮ vertical soup. */
export function AdminWalletCell({
  coins = 0,
  toman = 0,
  stars = 0,
  ton = 0,
  compact = false,
  onOpenCredit,
}: {
  coins?: number | null;
  toman?: number | null;
  stars?: number | null;
  ton?: number | null;
  /** 2×2 chip grid for dense tables (less horizontal scroll). */
  compact?: boolean;
  /** Optional: open «اعتبار» modal instead of a separate action button. */
  onOpenCredit?: () => void;
}) {
  const rows: { key: WalletCurrency; value: number; short: string }[] = [
    { key: 'coins', value: Number(coins) || 0, short: tr('سکه') },
    { key: 'toman', value: Number(toman) || 0, short: tr('تومان') },
    { key: 'stars', value: Number(stars) || 0, short: tr('ستاره') },
    { key: 'ton', value: Number(ton) || 0, short: tr('تون') },
  ];
  const className = [
    'admin-wallet-grid',
    compact ? 'admin-wallet-grid--compact' : '',
    onOpenCredit ? 'admin-wallet-grid--action' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const chips = rows.map((r) => (
    <div
      key={r.key}
      className={`admin-wallet-chip${r.value ? '' : ' admin-wallet-chip--zero'}`}
      title={tr(WALLET_CURRENCY_LABELS_FA[r.key])}
    >
      <span className="admin-wallet-chip-label">{tr(r.short)}</span>
      <span className="admin-wallet-chip-value admin-mono" dir="ltr">
        {formatNumFa(r.value)}
      </span>
    </div>
  ));

  if (onOpenCredit) {
    return (
      <button
        type="button"
        className={className}
        dir="rtl"
        title={tr("موجودی کیف پول — برای شارژ کلیک کنید")}
        onClick={onOpenCredit}
      >
        {chips}
      </button>
    );
  }

  return (
    <div className={className} dir="rtl" title={tr("موجودی کیف پول")}>
      {chips}
    </div>
  );
}

export function adminVerifyLabel(status?: VerificationStatus | string | null): string {
  if (!status) return '—';
  if (status in VERIFICATION_STATUS_LABELS) {
    return tr(VERIFICATION_STATUS_LABELS[status as VerificationStatus]);
  }
  return String(status);
}

export function adminVerifyClass(status?: VerificationStatus | string | null): string {
  if (status === 'verified') return 'admin-badge admin-badge--ok';
  if (status === 'pending') return 'admin-badge admin-badge--warn';
  if (status === 'rejected') return 'admin-badge admin-badge--error';
  return 'admin-badge';
}

/** Gender · age one-liner for user rows. */
export function adminUserDemographics(u: Pick<User, 'gender' | 'age'>): string | null {
  const parts = [
    u.gender === 'male' ? tr('مرد') : u.gender === 'female' ? tr('زن') : null,
    u.age != null ? tr('{n}س', { n: u.age }) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** Telegram handle only; raw tg id stays in title for copy/debug. */
export function AdminTelegramCell({
  username,
  telegramId,
}: {
  username?: string | null;
  telegramId?: string | number | null;
}) {
  const handle = username ? `@${username}` : null;
  const tg = telegramId != null && String(telegramId).trim() ? String(telegramId) : null;
  if (!handle && !tg) return <span className="admin-muted">—</span>;
  return (
    <div className="admin-cell-compact" dir="ltr" title={tg ? `Telegram ID: ${tg}` : undefined}>
      <span className="admin-mono">{handle || '—'}</span>
      {!handle && tg ? <span className="admin-muted admin-mono">{tg}</span> : null}
    </div>
  );
}

/** Phone + email on two tight lines (skip empty). */
export function AdminContactCell({
  phone,
  email,
}: {
  phone?: string | null;
  email?: string | null;
}) {
  const p = phone?.trim() || null;
  const e = email?.trim() || null;
  if (!p && !e) return <span className="admin-muted">—</span>;
  return (
    <div className="admin-cell-compact">
      {p ? (
        <span className="admin-mono" dir="ltr">
          {p}
        </span>
      ) : (
        <span className="admin-muted">{tr('بدون موبایل')}</span>
      )}
      {e ? (
        <span className="admin-muted admin-ellipsis" dir="ltr" title={e}>
          {e}
        </span>
      ) : null}
    </div>
  );
}
