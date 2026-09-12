/**
 * Profile / chat avatar URL selection.
 * Face-verify videos and other non-image clips must never be used as avatars.
 * Pending profile photos still go through photo-moderation placeholders.
 */
import type { PhotoModerationStatus } from './petdate';
import { publicFacingPhotoUrl } from './photo-moderation';

/** Telegram Bot API prefixes that are never a still profile photo. */
const TELEGRAM_NON_PHOTO_PREFIX = /^(BAAC|DQAC|AwAC|CQAC|CgAC)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi|mkv|3gp|ogv)(?:$|[?#])/i;
const MEDIA_PROXY = /\/api\/media\/telegram\/([^/?#]+)/i;

/**
 * True when a stored avatar/media ref is a video (or other non-image) clip.
 * Covers Telegram video / video-note file_ids, `/api/media/telegram/…` proxies,
 * and disk paths with video extensions (e.g. face-verify uploads).
 */
export function isNonImageAvatarRef(value?: string | null): boolean {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  if (VIDEO_EXT.test(raw)) return true;
  if (TELEGRAM_NON_PHOTO_PREFIX.test(raw)) return true;
  const proxy = raw.match(MEDIA_PROXY);
  if (proxy?.[1]) {
    try {
      const id = decodeURIComponent(proxy[1]);
      if (TELEGRAM_NON_PHOTO_PREFIX.test(id) || VIDEO_EXT.test(id)) return true;
    } catch {
      /* ignore malformed encoding */
    }
  }
  return false;
}

/**
 * Avatar URL for display / API mapping.
 * Drops face-verify videos and any non-image clip. Still photos pass through
 * (including when the user reused their existing profile photo for verify).
 */
export function profileAvatarUrl(
  avatarUrl?: string | null,
  opts?: { verificationPhotoFileId?: string | null }
): string | undefined {
  const raw = String(avatarUrl ?? '').trim();
  if (!raw || isNonImageAvatarRef(raw)) return undefined;
  const verify = String(opts?.verificationPhotoFileId ?? '').trim();
  if (verify && raw === verify && isNonImageAvatarRef(verify)) return undefined;
  return raw;
}

/**
 * Peer/public avatar: approved still photo only.
 * Pending/rejected photos stay on the placeholder path (#328).
 * Face-verify media is never returned.
 */
export function publicFacingAvatarUrl(
  url?: string | null,
  status?: PhotoModerationStatus | null,
  verificationPhotoFileId?: string | null
): string | undefined {
  return publicFacingPhotoUrl(profileAvatarUrl(url, { verificationPhotoFileId }), status);
}
