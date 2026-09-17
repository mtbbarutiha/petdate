import {
  isGenderDefaultAvatarPath,
  isNonImageAvatarRef,
  resolveProfileDisplayAvatarUrl,
  type PhotoModerationStatus,
  type UserGender,
} from '@petdate/shared';

/** Empty = same-origin (Vite proxies /api → API). Override with VITE_API_URL if needed. */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

/**
 * Resolve stored media paths for <img src> / CSS backgrounds.
 * Relative `/api/...` must be prefixed with VITE_API_URL when the web origin differs.
 * Opaque Telegram file_ids are mapped to the pet/media image proxy when possible.
 */
export function resolvePublicMediaUrl(
  url?: string | null,
  opts?: { petId?: number }
): string {
  const raw = String(url ?? '').trim();
  if (!raw) return '';
  if (
    /^https?:\/\//i.test(raw) ||
    raw.startsWith('blob:') ||
    raw.startsWith('data:')
  ) {
    return raw;
  }
  // Bundled web static files (hero LCP, pepito uploads, agent personas, defaults, stock pets).
  // Do not prefix VITE_API_URL; the API host does not serve these paths.
  if (
    raw.startsWith('/media/') ||
    raw.startsWith('/pepito/') ||
    raw.startsWith('/assets/') ||
    raw.startsWith('/agents/') ||
    raw.startsWith('/images/') ||
    raw.startsWith('/pets/') ||
    raw.startsWith('/brand/') ||
    raw.startsWith('/fonts/')
  ) {
    return raw;
  }
  if (raw.startsWith('/')) return `${API_BASE}${raw}`;
  // Telegram Bot API file_id — not a browser URL
  if (/^(AgAC|AQAD|BAAC|BQAC|AwAC|CQAC|DQAC)/.test(raw) || /^[A-Za-z0-9_-]{24,}$/.test(raw)) {
    if (opts?.petId != null && Number.isFinite(opts.petId) && opts.petId > 0) {
      return `${API_BASE}/api/pets/${opts.petId}/image`;
    }
    return `${API_BASE}/api/media/telegram/${encodeURIComponent(raw)}`;
  }
  return '';
}

/**
 * Avatar <img src>: uploaded still photo, else gender default, else empty
 * (initials fallback). Face-verify videos never resolve as photos.
 */
export function resolvePublicAvatarUrl(
  url?: string | null,
  opts?: {
    verificationPhotoFileId?: string | null;
    gender?: UserGender | string | null;
    moderationStatus?: PhotoModerationStatus | null;
    publicFacing?: boolean;
  }
): string {
  const usable = resolveProfileDisplayAvatarUrl(url, {
    gender: opts?.gender,
    verificationPhotoFileId: opts?.verificationPhotoFileId,
    moderationStatus: opts?.moderationStatus,
    publicFacing: opts?.publicFacing,
  });
  if (!usable || isNonImageAvatarRef(usable)) return '';
  // Bundled web static files — do not prefix VITE_API_URL.
  if (isGenderDefaultAvatarPath(usable) && usable.startsWith('/')) return usable;
  return resolvePublicMediaUrl(usable);
}
