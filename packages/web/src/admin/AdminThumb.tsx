import { useState, type ReactNode } from 'react';
import type { UserGender } from '@petdate/shared';
import { resolvePublicAvatarUrl, resolvePublicMediaUrl } from '../lib/api';

type Kind = 'user' | 'pet';

function initialsOf(label?: string | null): string {
  const t = String(label ?? '').trim();
  if (!t) return '؟';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.slice(0, 2);
  return t.slice(0, 2);
}

/**
 * Compact row thumbnail for admin tables — live photo only.
 * Never invents stock/default pet images when missing.
 */
export function AdminThumb({
  src,
  alt,
  label,
  gender,
  petId,
  kind = 'user',
  size = 40,
}: {
  src?: string | null;
  alt?: string;
  /** Used for initials placeholder when no photo (users only) */
  label?: string | null;
  /** When set and photo is missing, show the shared gender default (users only). */
  gender?: UserGender | string | null;
  petId?: number | null;
  kind?: Kind;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const resolved =
    kind === 'user'
      ? resolvePublicAvatarUrl(src, { gender })
      : resolvePublicMediaUrl(src, petId != null ? { petId } : undefined);
  const showImg = Boolean(resolved) && !failed;

  if (showImg) {
    return (
      <img
        src={resolved}
        alt={alt || label || ''}
        className={`admin-thumb admin-thumb--${kind}`}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  if (kind === 'pet') {
    return (
      <span
        className="admin-thumb admin-thumb--pet admin-thumb--placeholder admin-thumb--empty"
        style={{ width: size, height: size }}
        aria-hidden
      >
        —
      </span>
    );
  }

  return (
    <span
      className="admin-thumb admin-thumb--user admin-thumb--placeholder"
      style={{ width: size, height: size }}
      aria-hidden
      title={label || undefined}
    >
      {initialsOf(label)}
    </span>
  );
}

/** Name + optional thumb stacked horizontally in a table cell. */
export function AdminEntityCell({
  thumb,
  title,
  subtitle,
}: {
  thumb: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="admin-entity-cell">
      {thumb}
      <div className="admin-entity-cell-text">
        <div className="admin-entity-cell-title">{title}</div>
        {subtitle ? <div className="admin-muted">{subtitle}</div> : null}
      </div>
    </div>
  );
}
