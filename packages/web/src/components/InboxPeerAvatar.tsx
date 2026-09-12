import { useState } from 'react';
import { Stethoscope } from 'lucide-react';
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
 * Consult / inbox row avatar: real peer photo when available,
 * initials when name is known but photo missing, stethoscope only as last resort.
 */
export function InboxPeerAvatar({
  avatarUrl,
  name,
  size = 42,
}: {
  avatarUrl?: string | null;
  name?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const resolved = resolvePublicAvatarUrl(avatarUrl);
  const showImg = Boolean(resolved) && !failed;
  const initials = initialsOf(name);

  if (showImg) {
    return (
      <span
        className="tg-chat-list-icon tg-chat-list-icon--photo"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <img
          src={resolved}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
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
