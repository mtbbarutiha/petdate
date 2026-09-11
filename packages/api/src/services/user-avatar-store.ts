import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  isAllowedUploadImageMime,
  normalizeProfileImage,
} from './image-normalize';

export const MAX_USER_AVATAR_BYTES = 8 * 1024 * 1024;

/** User avatars live next to the SQLite database (same pattern as pet-photos). */
export function userAvatarsRoot(): string {
  const raw = (process.env.DATABASE_PATH || '').trim();
  const dbFile =
    raw && path.isAbsolute(raw)
      ? raw
      : path.join(__dirname, '..', '..', 'data', 'petdate.db');
  return path.join(path.dirname(dbFile), 'user-avatars');
}

export function ensureUserAvatarsRoot(): string {
  const root = userAvatarsRoot();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

/** Safe relative key: `{userId}/{uuid}{ext}` — never absolute or with `..`. */
export function buildUserAvatarKey(userId: number, originalName: string, mimeType?: string): string {
  let ext = path.extname(originalName || '').slice(0, 16).replace(/[^\w.~-]/gi, '');
  if (!ext) {
    const mime = (mimeType || '').toLowerCase();
    if (mime.includes('png')) ext = '.png';
    else if (mime.includes('webp')) ext = '.webp';
    else if (mime.includes('gif')) ext = '.gif';
    else if (mime.includes('heic') || mime.includes('heif')) ext = '.heic';
    else ext = '.jpg';
  }
  return `${userId}/${randomUUID()}${ext}`;
}

export function resolveUserAvatarPath(storageKey: string): string | null {
  if (!storageKey || storageKey.includes('..') || path.isAbsolute(storageKey)) return null;
  const parts = storageKey.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  if (!/^\d+$/.test(parts[0])) return null;
  if (!/^[\w.~-]+$/.test(parts[1])) return null;

  const root = ensureUserAvatarsRoot();
  const abs = path.resolve(root, storageKey);
  if (!abs.startsWith(path.resolve(root) + path.sep) && abs !== path.resolve(root)) {
    return null;
  }
  return abs;
}

export function isAllowedUserAvatarMime(
  mimeType: string | undefined,
  fileName?: string,
  buffer?: Buffer
): boolean {
  return isAllowedUploadImageMime(mimeType, fileName, buffer);
}

export async function saveUserAvatar(opts: {
  userId: number;
  originalName: string;
  mimeType?: string;
  buffer: Buffer;
}): Promise<{ storageKey: string; absolutePath: string; urlPath: string; mimeType: string }> {
  const normalized = await normalizeProfileImage({
    buffer: opts.buffer,
    mimeType: opts.mimeType,
    originalName: opts.originalName || 'avatar.jpg',
    maxBytes: MAX_USER_AVATAR_BYTES,
    maxEdge: 1024,
  });
  const storageKey = buildUserAvatarKey(opts.userId, normalized.originalName, normalized.mimeType);
  const abs = resolveUserAvatarPath(storageKey);
  if (!abs) throw new Error('INVALID_STORAGE_KEY');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, normalized.buffer);
  return {
    storageKey,
    absolutePath: abs,
    urlPath: `/api/auth/avatar/${storageKey}`,
    mimeType: normalized.mimeType,
  };
}

export function mimeFromUserAvatarKey(storageKey: string): string {
  const ext = path.extname(storageKey).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.heic' || ext === '.heif') return 'image/heic';
  return 'image/jpeg';
}
