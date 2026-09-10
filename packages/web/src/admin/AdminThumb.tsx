import { useState, type ReactNode } from 'react';
import { resolvePublicMediaUrl } from '../lib/api';
import { EMPTY_STATE_PHOTO } from '../data/petImages';

type Kind = 'user' | 'pet';

function initialsOf(label?: string | null): string {
  const t = String(label ?? '').trim();
  if (!t) return '؟';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.slice(0, 2);
  return t.slice(0, 2);
}

/**
 * Compact row thumbnail for admin tables — live photo or placeholder.
 * Keeps IDs/names in the sibling cell; this is only the image.
 */
export function AdminThumb({
  src,
  alt,
  label,
  petId,
  kind = 'user',
  size = 40,
}: {
  src?: string | null;
  alt?: string;
  /** Used for initials placeholder when no photo */
  label?: string | null;
  petId?: number | null;
  kind?: Kind;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const resolved = resolvePublicMediaUrl(src, petId != null ? { petId } : undefined);
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
        onError={(e) => {
          const el = e.currentTarget;
          if (kind === 'pet' && el.dataset.fallback !== '1') {
            el.dataset.fallback = '1';
            el.src = EMPTY_STATE_PHOTO;
            return;
          }
          setFailed(true);
        }}
      />
    );
  }

  if (kind === 'pet') {
    return (
      <img
        src={EMPTY_STATE_PHOTO}
        alt=""
        className="admin-thumb admin-thumb--pet admin-thumb--placeholder"
        width={size}
        height={size}
      />
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
