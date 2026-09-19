import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export const MAX_PET_LOVER_REVIEW_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export function petLoverReviewImagesRoot(): string {
  const raw = (process.env.DATABASE_PATH || '').trim();
  const dbFile =
    raw && path.isAbsolute(raw)
      ? raw
      : path.join(__dirname, '..', '..', 'data', 'petdate.db');
  return path.join(path.dirname(dbFile), 'pet-lover-review-images');
}

export function ensurePetLoverReviewImagesRoot(): string {
  const root = petLoverReviewImagesRoot();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

export function buildPetLoverReviewImageKey(originalName: string, mimeType?: string): string {
  let ext = path.extname(originalName || '').slice(0, 16).replace(/[^\w.~-]/gi, '');
  if (!ext) {
    const mime = (mimeType || '').toLowerCase();
    if (mime.includes('png')) ext = '.png';
    else if (mime.includes('webp')) ext = '.webp';
    else ext = '.jpg';
  }
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${day}/${randomUUID()}${ext}`;
}

export function resolvePetLoverReviewImagePath(storageKey: string): string | null {
  if (!storageKey || storageKey.includes('..') || path.isAbsolute(storageKey)) return null;
  const parts = storageKey.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  if (!/^\d{8}$/.test(parts[0])) return null;
  if (!/^[\w.~-]+$/.test(parts[1])) return null;

  const root = ensurePetLoverReviewImagesRoot();
  const abs = path.resolve(root, storageKey);
  if (!abs.startsWith(path.resolve(root) + path.sep) && abs !== path.resolve(root)) {
    return null;
  }
  return abs;
}

export function isAllowedPetLoverReviewImageMime(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  return ALLOWED_MIME.has(mimeType.toLowerCase());
}

export function savePetLoverReviewImage(opts: {
  originalName: string;
  mimeType?: string;
  buffer: Buffer;
}): { storageKey: string; absolutePath: string; urlPath: string } {
  if (opts.buffer.length > MAX_PET_LOVER_REVIEW_IMAGE_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }
  if (!isAllowedPetLoverReviewImageMime(opts.mimeType)) {
    throw new Error('INVALID_MIME');
  }
  const storageKey = buildPetLoverReviewImageKey(opts.originalName, opts.mimeType);
  const abs = resolvePetLoverReviewImagePath(storageKey);
  if (!abs) throw new Error('INVALID_STORAGE_KEY');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, opts.buffer);
  return {
    storageKey,
    absolutePath: abs,
    urlPath: `/api/pet-lover-reviews/images/${storageKey}`,
  };
}

export function mimeFromPetLoverReviewImageKey(storageKey: string): string {
  const ext = path.extname(storageKey).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}
