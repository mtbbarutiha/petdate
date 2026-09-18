import { useEffect, useState } from 'react';
import { Stethoscope } from 'lucide-react';
import {
  defaultAvatarUrlForGender,
  isGenderDefaultAvatarPath,
  type UserGender,
} from '@petdate/shared';
import { resolvePublicAvatarUrl } from '../lib/api';

function initialsOf(label?: string | null): string {
  const t = String(label ?? '').trim();
  if (!t) return '؟';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.slice(0, 2);
  }
  return t.slice(0, 2);
}

/**
 * Consult / inbox / search row avatar.
 * Real per-user photo when the URL is a still image.
 * Initials when there is no photo or the image 404s.
 * A shared gender stock face is opt-in (`allowStockFallback`) — never the default
 * owner picture, so two people do not share one placeholder portrait.
 */
export function InboxPeerAvatar({
  avatarUrl,
  name,
  gender,
  size = 42,
  allowStockFallback = false,
}: {
  avatarUrl?: string | null;
  name?: string | null;
  gender?: UserGender | string | null;
  size?: number;
  /** When true, missing/broken photos may use the gender default JPG. Owner rows leave this off. */
  allowStockFallback?: boolean;
}) {
  const genderFallback = allowStockFallback ? defaultAvatarUrlForGender(gender) || '' : '';
  const cleaned = (() => {
    const raw = String(avatarUrl ?? '').trim();
    if (!raw) return '';
    if (!allowStockFallback && isGenderDefaultAvatarPath(raw)) return '';
    return raw;
  })();
  const primary = resolvePublicAvatarUrl(cleaned, allowStockFallback ? { gender } : undefined);
  const [src, setSrc] = useState(primary || genderFallback);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setSrc(primary || genderFallback);
    setExhausted(false);
  }, [primary, genderFallback]);

  const showImg = Boolean(src) && !exhausted;
  const initials = initialsOf(name);

  if (showImg) {
    return (
      <span
        className="tg-chat-list-icon tg-chat-list-icon--photo"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            if (genderFallback && src !== genderFallback) {
              setSrc(genderFallback);
              return;
            }
            setExhausted(true);
          }}
        />
      </span>
    );
  }

  if (String(name || '').trim()) {
    return (
      <span
        className="tg-chat-list-icon tg-chat-list-icon--initials"
        style={{ width: size, height: size }}
        aria-hidden
        title={name || undefined}
      >
        {initials}
      </span>
    );
  }

  return (
    <span className="tg-chat-list-icon" aria-hidden>
      <Stethoscope size={Math.round(size * 0.52)} strokeWidth={2} />
    </span>
  );
}
