/**
 * Face-verify media (selfie photo OR short selfie video) for admin review.
 * Stored under user-avatars next to the DB — never copied onto avatar_url.
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  isAllowedUploadImageMime,
  normalizeProfileImage,
} from './image-normalize';
import {
  ensureUserAvatarsRoot,
  MAX_USER_AVATAR_BYTES,
  resolveUserAvatarPath,
} from './user-avatar-store';
import { sniffTelegramMediaContentType } from './telegram-media';

/** Short selfie clips — same ballpark as chat video notes. */
export const MAX_FACE_VERIFY_BYTES = 15 * 1024 * 1024;

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(?:$|[?#])/i;

export function isFaceVerifyVideoMime(
  mimeType?: string | null,
  fileName?: string | null,
  buffer?: Buffer
): boolean {
  const mime = String(mimeType || '')
    .toLowerCase()
    .split(';')[0]!
    .trim();
  if (mime.startsWith('video/')) return true;
  const name = String(fileName || '').toLowerCase();
  if (VIDEO_EXT.test(name)) return true;
  if (buffer && buffer.length >= 4) {
    const sniffed = sniffTelegramMediaContentType(buffer, mime, name);
    return sniffed.startsWith('video/');
  }
  return false;
}

export function isAllowedFaceVerifyMime(
  mimeType?: string | null,
  fileName?: string | null,
  buffer?: Buffer
): boolean {
  if (isFaceVerifyVideoMime(mimeType, fileName, buffer)) return true;
  return isAllowedUploadImageMime(mimeType ?? undefined, fileName ?? undefined, buffer);
}

function buildFaceVerifyKey(
  userId: number,
  originalName: string,
  mimeType?: string
): string {
  let ext = path.extname(originalName || '').slice(0, 16).replace(/[^\w.~-]/gi, '');
  if (!ext) {
    const mime = (mimeType || '').toLowerCase();
    if (mime.includes('webm')) ext = '.webm';
    else if (mime.includes('mp4') || mime.includes('m4v')) ext = '.mp4';
    else if (mime.includes('quicktime') || mime.includes('mov')) ext = '.mov';
    else if (mime.includes('png')) ext = '.png';
    else if (mime.includes('webp')) ext = '.webp';
    else if (mime.includes('gif')) ext = '.gif';
    else if (mime.includes('heic') || mime.includes('heif')) ext = '.heic';
    else ext = '.jpg';
  }
  return `${userId}/${randomUUID()}${ext}`;
}

export function mimeFromFaceVerifyKey(storageKey: string): string {
  const ext = path.extname(storageKey).toLowerCase();
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mp4' || ext === '.m4v') return 'video/mp4';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.heic' || ext === '.heif') return 'image/heic';
  return 'image/jpeg';
}

/**
 * Persist a face-verify selfie image or short video.
 * Images are normalized like avatars; videos are stored as-is (size-capped).
 */
export async function saveFaceVerifyMedia(opts: {
  userId: number;
  originalName: string;
  mimeType?: string;
  buffer: Buffer;
}): Promise<{
  storageKey: string;
  absolutePath: string;
  urlPath: string;
  mimeType: string;
  kind: 'image' | 'video';
}> {
  if (!opts.buffer?.length) throw new Error('EMPTY_FILE');
  if (opts.buffer.length > MAX_FACE_VERIFY_BYTES) throw new Error('FILE_TOO_LARGE');

  const asVideo = isFaceVerifyVideoMime(opts.mimeType, opts.originalName, opts.buffer);
  if (!isAllowedFaceVerifyMime(opts.mimeType, opts.originalName, opts.buffer)) {
    throw new Error('INVALID_MIME');
  }

  ensureUserAvatarsRoot();

  if (asVideo) {
    const mime =
      sniffTelegramMediaContentType(opts.buffer, opts.mimeType, opts.originalName) ||
      'video/webm';
    if (!mime.startsWith('video/')) throw new Error('INVALID_MIME');
    const storageKey = buildFaceVerifyKey(opts.userId, opts.originalName || 'verify.webm', mime);
    const abs = resolveUserAvatarPath(storageKey);
    if (!abs) throw new Error('INVALID_STORAGE_KEY');
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, opts.buffer);
    return {
      storageKey,
      absolutePath: abs,
      urlPath: `/api/auth/avatar/${storageKey}`,
      mimeType: mime,
      kind: 'video',
    };
  }

  const normalized = await normalizeProfileImage({
    buffer: opts.buffer,
    mimeType: opts.mimeType,
    originalName: opts.originalName || 'verify.jpg',
    maxBytes: Math.min(MAX_USER_AVATAR_BYTES, MAX_FACE_VERIFY_BYTES),
    maxEdge: 1024,
  });
  const storageKey = buildFaceVerifyKey(
    opts.userId,
    normalized.originalName,
    normalized.mimeType
  );
  const abs = resolveUserAvatarPath(storageKey);
  if (!abs) throw new Error('INVALID_STORAGE_KEY');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, normalized.buffer);
  return {
    storageKey,
    absolutePath: abs,
    urlPath: `/api/auth/avatar/${storageKey}`,
    mimeType: normalized.mimeType,
    kind: 'image',
  };
}
