import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  isAllowedUploadImageMime,
  normalizeProfileImage,
} from './image-normalize';

const MAX_PET_PHOTO_BYTES = 8 * 1024 * 1024;

/** Pet profile photos live next to the SQLite database (same pattern as chat-uploads). */
export function petPhotosRoot(): string {
  const raw = (process.env.DATABASE_PATH || '').trim();
  const dbFile =
    raw && path.isAbsolute(raw)
      ? raw
      : path.join(__dirname, '..', '..', 'data', 'petdate.db');
  return path.join(path.dirname(dbFile), 'pet-photos');
}

export function ensurePetPhotosRoot(): string {
  const root = petPhotosRoot();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

/** Safe relative key: `{ownerId}/{uuid}{ext}` — never absolute or with `..`. */
export function buildPetPhotoKey(ownerId: number, originalName: string, mimeType?: string): string {
  let ext = path.extname(originalName || '').slice(0, 16).replace(/[^\w.~-]/gi, '');
  if (!ext) {
    const mime = (mimeType || '').toLowerCase();
    if (mime.includes('png')) ext = '.png';
    else if (mime.includes('webp')) ext = '.webp';
    else if (mime.includes('gif')) ext = '.gif';
    else if (mime.includes('heic') || mime.includes('heif')) ext = '.heic';
    else ext = '.jpg';
  }
  return `${ownerId}/${randomUUID()}${ext}`;
}

export function resolvePetPhotoPath(storageKey: string): string | null {
  if (!storageKey || storageKey.includes('..') || path.isAbsolute(storageKey)) return null;
  // Expect ownerId/filename only
  const parts = storageKey.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  if (!/^\d+$/.test(parts[0])) return null;
  if (!/^[\w.~-]+$/.test(parts[1])) return null;

  const root = ensurePetPhotosRoot();
  const abs = path.resolve(root, storageKey);
  if (!abs.startsWith(path.resolve(root) + path.sep) && abs !== path.resolve(root)) {
    return null;
  }
  return abs;
}

export function isAllowedPetPhotoMime(
  mimeType: string | undefined,
  fileName?: string,
  buffer?: Buffer
): boolean {
  return isAllowedUploadImageMime(mimeType, fileName, buffer);
}

export async function savePetPhoto(opts: {
  ownerId: number;
  originalName: string;
  mimeType?: string;
  buffer: Buffer;
}): Promise<{ storageKey: string; absolutePath: string; urlPath: string; mimeType: string }> {
  const normalized = await normalizeProfileImage({
    buffer: opts.buffer,
    mimeType: opts.mimeType,
    originalName: opts.originalName || 'pet.jpg',
    maxBytes: MAX_PET_PHOTO_BYTES,
    maxEdge: 1600,
  });
  const storageKey = buildPetPhotoKey(opts.ownerId, normalized.originalName, normalized.mimeType);
  const abs = resolvePetPhotoPath(storageKey);
  if (!abs) throw new Error('INVALID_STORAGE_KEY');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, normalized.buffer);
  return {
    storageKey,
    absolutePath: abs,
    urlPath: `/api/pets/photos/${storageKey}`,
    mimeType: normalized.mimeType,
  };
}

export function deletePetPhoto(storageKey: string | null | undefined): void {
  if (!storageKey) return;
  const abs = resolvePetPhotoPath(storageKey);
  if (!abs) return;
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    /* ignore */
  }
}

export function mimeFromPetPhotoKey(storageKey: string): string {
  const ext = path.extname(storageKey).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.heic' || ext === '.heif') return 'image/heic';
  return 'image/jpeg';
}

export { MAX_PET_PHOTO_BYTES };
