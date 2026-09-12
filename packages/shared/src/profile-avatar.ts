/**
 * Profile / chat avatar URL selection.
 * Face-verify videos and other non-image clips must never be used as avatars.
 * Pending profile photos still go through photo-moderation placeholders.
 * Missing / unapproved photos fall back to gender defaults when sex is known.
 */
import type { PhotoModerationStatus, UserGender } from './petdate';
import { publicFacingPhotoUrl } from './photo-moderation';

/** Public static defaults — `packages/web/public/images/defaults/`. */
export const DEFAULT_AVATAR_FEMALE_PATH = '/images/defaults/avatar-female.jpg';
export const DEFAULT_AVATAR_MALE_PATH = '/images/defaults/avatar-male.jpg';

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

export function parseUserGenderValue(value?: unknown): UserGender | undefined {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'female') return 'female';
  if (raw === 'male') return 'male';
  return undefined;
}

/** Gender stock photo when the user has no usable uploaded still. */
export function defaultAvatarUrlForGender(
  gender?: UserGender | string | null
): string | undefined {
  const parsed = parseUserGenderValue(gender);
  if (parsed === 'female') return DEFAULT_AVATAR_FEMALE_PATH;
  if (parsed === 'male') return DEFAULT_AVATAR_MALE_PATH;
  return undefined;
}

export function isGenderDefaultAvatarPath(url?: string | null): boolean {
  const raw = String(url ?? '').trim();
  if (!raw) return false;
  try {
    const path = raw.startsWith('http://') || raw.startsWith('https://')
      ? new URL(raw).pathname
      : raw.split('?')[0] ?? raw;
    return path === DEFAULT_AVATAR_FEMALE_PATH || path === DEFAULT_AVATAR_MALE_PATH;
  } catch {
    return raw.includes(DEFAULT_AVATAR_FEMALE_PATH) || raw.includes(DEFAULT_AVATAR_MALE_PATH);
  }
}

export type ResolveProfileDisplayAvatarOpts = {
  gender?: UserGender | string | null;
  verificationPhotoFileId?: string | null;
  moderationStatus?: PhotoModerationStatus | null;
  /** Hide pending/rejected uploads (peer / public payloads). */
  publicFacing?: boolean;
};

/**
 * Display URL: uploaded still photo, else female/male default, else undefined
 * (callers keep the existing initials / empty fallback).
 * Does not invent a third custom photo when gender is missing.
 */
export function resolveProfileDisplayAvatarUrl(
  url?: string | null,
  opts?: ResolveProfileDisplayAvatarOpts
): string | undefined {
  const photo = opts?.publicFacing
    ? publicFacingAvatarUrl(url, opts.moderationStatus, opts.verificationPhotoFileId)
    : profileAvatarUrl(url, { verificationPhotoFileId: opts?.verificationPhotoFileId });
  if (photo && !isGenderDefaultAvatarPath(photo)) return photo;
  return defaultAvatarUrlForGender(opts?.gender) ?? photo;
}
