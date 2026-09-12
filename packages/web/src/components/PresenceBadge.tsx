import type { UserPresence } from '@petdate/shared';
import { formatPresenceLabel } from '../hooks/usePresence';

type PresenceBadgeProps = {
  presence: UserPresence | null | undefined;
  className?: string;
  /** Override label when peer is online (e.g. consult: «در حال پت»). */
  onlineLabel?: string;
  /**
   * When true, treat missing/offline presence as online so active consults
   * never flash grey «آفلاین» for AI agents or in-session peers.
   */
  forceOnline?: boolean;
};

/** Compact online/offline badge for chat headers. */
export function PresenceBadge({
  presence,
  className = '',
  onlineLabel,
  forceOnline = false,
}: PresenceBadgeProps) {
  const effective: UserPresence | null | undefined =
    forceOnline && (!presence || !presence.online)
      ? {
          userId: presence?.userId ?? 0,
          online: true,
          lastSeenAt: presence?.lastSeenAt ?? new Date().toISOString(),
        }
      : presence;

  if (!effective) return null;
  const label =
    effective.online && onlineLabel
      ? onlineLabel
      : formatPresenceLabel(effective);
  if (!label) return null;
  return (
    <span
      className={`tg-presence${effective.online ? ' is-online' : ' is-offline'}${className ? ` ${className}` : ''}`}
      title={label}
    >
      <i className="tg-presence-dot" aria-hidden />
      {label}
    </span>
  );
}
