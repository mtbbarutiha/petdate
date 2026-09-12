import {
  PET_SPECIES_LABELS,
  VERIFICATION_STATUS_LABELS,
  WALLET_CURRENCY_LABELS_FA,
  type User,
  type VerificationStatus,
  type WalletCurrency,
} from '@petdate/shared';
import { formatNumFa } from './api';
import { tr } from '../i18n';

export type AdminUserPet = { id: number; name: string; species?: string };

const ADMIN_PETS_PREVIEW = 3;

/** Linked pet names from the API — empty → em-dash, never invented names. */
export function AdminPetsCell({ pets }: { pets?: AdminUserPet[] | null }) {
  const list = (pets || [])
    .map((p) => ({
      id: p.id,
      name: String(p.name || '').trim(),
      species: p.species,
    }))
    .filter((p) => p.name);
  if (!list.length) return <span className="admin-muted">—</span>;
  const shown = list.slice(0, ADMIN_PETS_PREVIEW);
  const extra = list.length - shown.length;
  return (
    <div className="admin-pets-cell">
      {shown.map((p) => {
        const speciesLabel =
          p.species && PET_SPECIES_LABELS[p.species] ? PET_SPECIES_LABELS[p.species] : null;
        return (
          <span
            key={p.id}
            className="admin-pet-chip"
            title={speciesLabel ? `${p.name} · ${speciesLabel}` : p.name}
          >
            {p.name}
          </span>
        );
      })}
      {extra > 0 ? (
        <span className="admin-muted admin-pet-chip-more" title={list.map((p) => p.name).join('، ')}>
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

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
  /** Stacked label/value chips for dense tables (no overflow). */
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

/** Phone / Telegram / email — consistent em-dash when nothing is on file. */
export function AdminContactCell({
  phone,
  email,
  username,
  telegramId,
}: {
  phone?: string | null;
  email?: string | null;
  username?: string | null;
  telegramId?: string | number | null;
}) {
  const p = phone?.trim() || null;
  const e = email?.trim() || null;
  const handle = username?.trim() ? `@${username.trim().replace(/^@+/, '')}` : null;
  const tgId =
    telegramId != null && String(telegramId).trim() ? String(telegramId).trim() : null;
  if (!p && !e && !handle && !tgId) return <span className="admin-muted">—</span>;
  return (
    <div
      className="admin-cell-compact"
      title={tgId ? `Telegram ID: ${tgId}` : undefined}
    >
      {p ? (
        <span className="admin-mono admin-contact-line" dir="ltr" title={p}>
          {p}
        </span>
      ) : null}
      {handle ? (
        <span className="admin-mono admin-contact-line" dir="ltr" title={handle}>
          {handle}
        </span>
      ) : tgId && !p ? (
        <span className="admin-muted admin-mono admin-contact-line" dir="ltr" title={`tg:${tgId}`}>
          tg:{tgId}
        </span>
      ) : null}
      {e ? (
        <span className="admin-muted admin-ellipsis" dir="ltr" title={e}>
          {e}
        </span>
      ) : null}
    </div>
  );
}
