import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export const MAX_MAGAZINE_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/** Magazine cover/body images live next to the SQLite database. */
export function magazineImagesRoot(): string {
  const raw = (process.env.DATABASE_PATH || '').trim();
  const dbFile =
    raw && path.isAbsolute(raw)
      ? raw
      : path.join(__dirname, '..', '..', 'data', 'petdate.db');
  return path.join(path.dirname(dbFile), 'magazine-images');
}

export function ensureMagazineImagesRoot(): string {
  const root = magazineImagesRoot();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

export function buildMagazineImageKey(originalName: string, mimeType?: string): string {
  let ext = path.extname(originalName || '').slice(0, 16).replace(/[^\w.~-]/gi, '');
  if (!ext) {
    const mime = (mimeType || '').toLowerCase();
    if (mime.includes('png')) ext = '.png';
    else if (mime.includes('webp')) ext = '.webp';
    else if (mime.includes('gif')) ext = '.gif';
    else ext = '.jpg';
  }
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${day}/${randomUUID()}${ext}`;
}

export function resolveMagazineImagePath(storageKey: string): string | null {
  if (!storageKey || storageKey.includes('..') || path.isAbsolute(storageKey)) return null;
  const parts = storageKey.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  if (!/^\d{8}$/.test(parts[0])) return null;
  if (!/^[\w.~-]+$/.test(parts[1])) return null;

  const root = ensureMagazineImagesRoot();
  const abs = path.resolve(root, storageKey);
  if (!abs.startsWith(path.resolve(root) + path.sep) && abs !== path.resolve(root)) {
    return null;
  }
  return abs;
}

export function isAllowedMagazineImageMime(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  return ALLOWED_MIME.has(mimeType.toLowerCase());
}

export function saveMagazineImage(opts: {
  originalName: string;
  mimeType?: string;
  buffer: Buffer;
}): { storageKey: string; absolutePath: string; urlPath: string } {
  if (opts.buffer.length > MAX_MAGAZINE_IMAGE_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }
  if (!isAllowedMagazineImageMime(opts.mimeType)) {
    throw new Error('INVALID_MIME');
  }
  const storageKey = buildMagazineImageKey(opts.originalName, opts.mimeType);
  const abs = resolveMagazineImagePath(storageKey);
  if (!abs) throw new Error('INVALID_STORAGE_KEY');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, opts.buffer);
  return {
    storageKey,
    absolutePath: abs,
    urlPath: `/api/magazine/images/${storageKey}`,
  };
}

export function mimeFromMagazineImageKey(storageKey: string): string {
  const ext = path.extname(storageKey).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}
