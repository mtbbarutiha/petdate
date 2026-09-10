import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/** Job-ad payment receipts (image or PDF), stored next to the DB. */
export const MAX_HR_OPENING_RECEIPT_BYTES = 8 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

export function hrOpeningReceiptsRoot(): string {
  const raw = (process.env.DATABASE_PATH || '').trim();
  const dbFile =
    raw && path.isAbsolute(raw)
      ? raw
      : path.join(__dirname, '..', '..', 'data', 'petdate.db');
  return path.join(path.dirname(dbFile), 'hr-opening-receipts');
}

export function ensureHrOpeningReceiptsRoot(): string {
  const root = hrOpeningReceiptsRoot();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

export function buildHrOpeningReceiptKey(
  openingId: number,
  originalName: string,
  mimeType?: string
): string {
  let ext = path.extname(originalName || '').slice(0, 16).replace(/[^\w.~-]/gi, '');
  if (!ext) {
    const mime = (mimeType || '').toLowerCase();
    if (mime.includes('png')) ext = '.png';
    else if (mime.includes('webp')) ext = '.webp';
    else if (mime.includes('gif')) ext = '.gif';
    else if (mime.includes('pdf')) ext = '.pdf';
    else ext = '.jpg';
  }
  return `${openingId}/${randomUUID()}${ext}`;
}

export function resolveHrOpeningReceiptPath(storageKey: string): string | null {
  if (!storageKey || storageKey.includes('..') || path.isAbsolute(storageKey)) return null;
  const parts = storageKey.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  if (!/^\d+$/.test(parts[0])) return null;
  if (!/^[\w.~-]+$/.test(parts[1])) return null;

  const root = ensureHrOpeningReceiptsRoot();
  const abs = path.resolve(root, storageKey);
  if (!abs.startsWith(path.resolve(root) + path.sep) && abs !== path.resolve(root)) {
    return null;
  }
  return abs;
}

export function isAllowedHrOpeningReceiptMime(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  return ALLOWED_MIME.has(mimeType.toLowerCase());
}

export function saveHrOpeningReceipt(opts: {
  openingId: number;
  originalName: string;
  mimeType?: string;
  buffer: Buffer;
}): { storageKey: string; absolutePath: string; urlPath: string } {
  if (opts.buffer.length > MAX_HR_OPENING_RECEIPT_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }
  if (!isAllowedHrOpeningReceiptMime(opts.mimeType)) {
    throw new Error('INVALID_MIME');
  }
  const storageKey = buildHrOpeningReceiptKey(
    opts.openingId,
    opts.originalName,
    opts.mimeType
  );
  const abs = resolveHrOpeningReceiptPath(storageKey);
  if (!abs) throw new Error('INVALID_STORAGE_KEY');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, opts.buffer);
  return {
    storageKey,
    absolutePath: abs,
    urlPath: `/api/admin/hr/opening-receipts/${storageKey}`,
  };
}

export function mimeFromHrOpeningReceiptKey(storageKey: string): string {
  const ext = path.extname(storageKey).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.pdf') return 'application/pdf';
  return 'image/jpeg';
}
