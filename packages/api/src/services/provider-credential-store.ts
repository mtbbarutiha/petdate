import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/** Same size cap as avatars — credential photos / scans. */
export const MAX_PROVIDER_CREDENTIAL_BYTES = 8 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

export function providerCredentialsRoot(): string {
  const raw = (process.env.DATABASE_PATH || '').trim();
  const dbFile =
    raw && path.isAbsolute(raw)
      ? raw
      : path.join(__dirname, '..', '..', 'data', 'petdate.db');
  return path.join(path.dirname(dbFile), 'provider-credentials');
}

export function ensureProviderCredentialsRoot(): string {
  const root = providerCredentialsRoot();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

export function buildProviderCredentialKey(
  userId: number,
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
    else if (mime.includes('heic') || mime.includes('heif')) ext = '.heic';
    else ext = '.jpg';
  }
  return `${userId}/${randomUUID()}${ext}`;
}

export function resolveProviderCredentialPath(storageKey: string): string | null {
  if (!storageKey || storageKey.includes('..') || path.isAbsolute(storageKey)) return null;
  const parts = storageKey.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  if (!/^\d+$/.test(parts[0])) return null;
  if (!/^[\w.~-]+$/.test(parts[1])) return null;

  const root = ensureProviderCredentialsRoot();
  const abs = path.resolve(root, storageKey);
  if (!abs.startsWith(path.resolve(root) + path.sep) && abs !== path.resolve(root)) {
    return null;
  }
  return abs;
}

export function isAllowedProviderCredentialMime(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  return ALLOWED_MIME.has(mimeType.toLowerCase());
}

export function saveProviderCredential(opts: {
  userId: number;
  originalName: string;
  mimeType?: string;
  buffer: Buffer;
}): { storageKey: string; absolutePath: string; urlPath: string } {
  if (opts.buffer.length > MAX_PROVIDER_CREDENTIAL_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }
  if (!isAllowedProviderCredentialMime(opts.mimeType)) {
    throw new Error('INVALID_MIME');
  }
  const storageKey = buildProviderCredentialKey(
    opts.userId,
    opts.originalName,
    opts.mimeType
  );
  const abs = resolveProviderCredentialPath(storageKey);
  if (!abs) throw new Error('INVALID_STORAGE_KEY');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, opts.buffer);
  return {
    storageKey,
    absolutePath: abs,
    urlPath: `/api/auth/provider-credential-file/${storageKey}`,
  };
}

export function mimeFromProviderCredentialKey(storageKey: string): string {
  const ext = path.extname(storageKey).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.heic' || ext === '.heif') return 'image/heic';
  return 'image/jpeg';
}

/** True when stored value is a web upload path (not a Telegram file_id). */
export function isWebProviderCredentialRef(ref?: string | null): boolean {
  const v = String(ref ?? '').trim();
  return v.startsWith('/api/auth/provider-credential-file/');
}
