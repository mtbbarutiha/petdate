import { useState } from 'react';

type PublicIdBadgeProps = {
  /** Canonical public id e.g. PD-P00012 / PD-U00038 */
  value: string;
  /** Persian label shown before the id */
  label: string;
  className?: string;
  /** Compact inline (pet tiles) vs block row */
  size?: 'sm' | 'md';
};

/** Copyable public id chip — pet / owner profiles and request cards. */
export function PublicIdBadge({
  value,
  label,
  className = '',
  size = 'md',
}: PublicIdBadgeProps) {
  const [copied, setCopied] = useState(false);
  const id = String(value ?? '').trim();
  if (!id) return null;

  async function onCopy() {
    try {
      await navigator.clipboard?.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  return (
    <span
      className={`pepito-public-id-badge pepito-public-id-badge--${size}${className ? ` ${className}` : ''}`}
    >
      <span className="pepito-public-id-badge__label">{label}</span>
      <button
        type="button"
        className="pepito-profile-public-id"
        dir="ltr"
        title={copied ? 'کپی شد' : 'کپی آیدی'}
        aria-label={`${label} ${id} — کپی`}
        onClick={() => void onCopy()}
      >
        <code>{id}</code>
      </button>
      {copied ? (
        <span className="pepito-public-id-badge__copied" aria-live="polite">
          کپی شد
        </span>
      ) : null}
    </span>
  );
}
