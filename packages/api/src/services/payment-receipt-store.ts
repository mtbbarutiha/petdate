import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/** رسیدهای کارت‌به‌کارت وب — کنار دیتابیس */
export const MAX_PAYMENT_RECEIPT_BYTES = 8 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export function paymentReceiptsRoot(): string {
  const raw = (process.env.DATABASE_PATH || '').trim();
  const dbFile =
    raw && path.isAbsolute(raw)
      ? raw
      : path.join(__dirname, '..', '..', 'data', 'petdate.db');
  return path.join(path.dirname(dbFile), 'payment-receipts');
}

export function ensurePaymentReceiptsRoot(): string {
  const root = paymentReceiptsRoot();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

export function buildPaymentReceiptKey(
  orderId: number,
  originalName: string,
  mimeType?: string
): string {
  let ext = path.extname(originalName || '').slice(0, 16).replace(/[^\w.~-]/gi, '');
  if (!ext) {
    const mime = (mimeType || '').toLowerCase();
    if (mime.includes('png')) ext = '.png';
    else if (mime.includes('webp')) ext = '.webp';
    else if (mime.includes('gif')) ext = '.gif';
    else ext = '.jpg';
  }
  return `${orderId}/${randomUUID()}${ext}`;
}

export function resolvePaymentReceiptPath(storageKey: string): string | null {
  if (!storageKey || storageKey.includes('..') || path.isAbsolute(storageKey)) return null;
  const parts = storageKey.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  if (!/^\d+$/.test(parts[0])) return null;
  if (!/^[\w.~-]+$/.test(parts[1])) return null;
  const root = ensurePaymentReceiptsRoot();
  const abs = path.resolve(root, storageKey);
  if (!abs.startsWith(path.resolve(root) + path.sep) && abs !== path.resolve(root)) {
    return null;
  }
  return abs;
}

export function isAllowedPaymentReceiptMime(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  return ALLOWED_MIME.has(mimeType.toLowerCase());
}

export function paymentReceiptStorageKeyFromUrl(url: string): string | null {
  const pathOnly = String(url || '').trim().split('?')[0] ?? '';
  const m = /^\/api\/payments\/receipts\/(\d+\/[\w.~-]+)$/.exec(pathOnly);
  return m?.[1] ?? null;
}

export function savePaymentReceipt(opts: {
  orderId: number;
  originalName: string;
  mimeType?: string;
  buffer: Buffer;
}): { storageKey: string; absolutePath: string; urlPath: string } {
  if (opts.buffer.length > MAX_PAYMENT_RECEIPT_BYTES) throw new Error('FILE_TOO_LARGE');
  if (!isAllowedPaymentReceiptMime(opts.mimeType)) throw new Error('INVALID_MIME');
  const storageKey = buildPaymentReceiptKey(opts.orderId, opts.originalName, opts.mimeType);
  const abs = resolvePaymentReceiptPath(storageKey);
  if (!abs) throw new Error('BAD_KEY');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, opts.buffer);
  return {
    storageKey,
    absolutePath: abs,
    urlPath: `/api/payments/receipts/${storageKey}`,
  };
}

export function mimeFromPaymentReceiptKey(storageKey: string): string {
  const ext = path.extname(storageKey).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}
