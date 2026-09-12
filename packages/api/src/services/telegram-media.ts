import fs from 'fs';
import path from 'path';
import { resolveTelegramFile } from './telegram-chat-notify';
import {
  mimeFromPetPhotoKey,
  resolvePetPhotoPath,
  savePetPhoto,
} from './pet-photo-store';

/**
 * Telegram Bot API file_ids are opaque tokens (not http URLs).
 * Bot stores them in pets.image_url / users.avatar_url — web <img> cannot load them directly.
 *
 * Note: do not import dbService at module top-level (mapPet in db.ts imports these helpers).
 */
export function looksLikeTelegramFileId(value: string | undefined | null): boolean {
  const v = String(value ?? '').trim();
  if (!v) return false;
  if (/^https?:\/\//i.test(v)) return false;
  if (v.startsWith('/')) return false;
  // Common Telegram prefixes + generic long opaque tokens
  if (/^(AgAC|AQAD|BAAC|BQAC|AwAC|CQAC|DQAC)/.test(v)) return true;
  return /^[A-Za-z0-9_-]{24,}$/.test(v);
}

/** Public web URL for a stored image field (http path, local api path, or telegram file_id). */
export function publicImageUrlForStored(
  raw: string | undefined | null,
  opts?: { petId?: number }
): string | undefined {
  const v = String(raw ?? '').trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v) || v.startsWith('/')) return v;
  if (looksLikeTelegramFileId(v)) {
    if (opts?.petId != null && Number.isFinite(opts.petId) && opts.petId > 0) {
      return `/api/pets/${opts.petId}/image`;
    }
    return `/api/media/telegram/${encodeURIComponent(v)}`;
  }
  return v;
}

function mimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.mp4' || ext === '.m4v') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.heic' || ext === '.heif') return 'image/heic';
  return 'image/jpeg';
}

/**
 * Infer browser-safe Content-Type for Telegram-proxied bytes.
 * KYC / face-verify may be a selfie photo OR a short video (mp4/webm/mov).
 * Do not force non-image payloads to image/jpeg — that breaks `<video>` playback.
 */
export function sniffTelegramMediaContentType(
  buffer: Buffer,
  declared?: string | null,
  filePath?: string | null
): string {
  const declaredMime = String(declared || '')
    .toLowerCase()
    .split(';')[0]!
    .trim();
  const name = String(filePath || '').toLowerCase();

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 3) === 'GIF') {
    return 'image/gif';
  }
  // EBML — WebM / Matroska (Telegram video + video_note often land here or as mp4)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return 'video/webm';
  }
  // ISO BMFF — mp4 / mov / heic
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).toLowerCase();
    if (brand.startsWith('heic') || brand.startsWith('heif') || brand.startsWith('mif1')) {
      return 'image/heic';
    }
    if (brand.includes('qt') || name.endsWith('.mov')) return 'video/quicktime';
    return 'video/mp4';
  }

  if (declaredMime.startsWith('video/') || declaredMime.startsWith('image/')) {
    return declaredMime;
  }
  if (/\.(mp4|m4v)(\?|$)/i.test(name)) return 'video/mp4';
  if (/\.webm(\?|$)/i.test(name)) return 'video/webm';
  if (/\.mov(\?|$)/i.test(name)) return 'video/quicktime';
  if (/\.(jpe?g|png|gif|webp|heic|heif)(\?|$)/i.test(name)) return mimeFromPath(name);

  return declaredMime && declaredMime !== 'application/octet-stream'
    ? declaredMime
    : 'application/octet-stream';
}

/**
 * Download a Telegram file_id once, save under pet-photos, update pets.image_url.
 * Returns the public /api/pets/photos/... path or null on failure.
 */
export async function materializePetTelegramPhoto(
  petId: number,
  ownerId: number,
  fileId: string
): Promise<string | null> {
  const file = await resolveTelegramFile(fileId);
  if (!file) return null;
  try {
    const upstream = await fetch(file.downloadUrl);
    if (!upstream.ok) return null;
    const buf = Buffer.from(await upstream.arrayBuffer());
    const mime =
      upstream.headers.get('content-type')?.split(';')[0]?.trim() ||
      mimeFromPath(file.filePath);
    const saved = await savePetPhoto({
      ownerId,
      originalName: path.basename(file.filePath) || 'telegram-pet.jpg',
      mimeType: mime.startsWith('image/') ? mime : 'image/jpeg',
      buffer: buf,
    });
    const { dbService } = await import('../db');
    dbService.updatePet(petId, { imageUrl: saved.urlPath });
    return saved.urlPath;
  } catch (err) {
    console.warn('materialize pet telegram photo failed:', (err as Error).message);
    return null;
  }
}

/** Fetch telegram file bytes for streaming (no persist). */
export async function fetchTelegramFileBytes(fileId: string): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  const file = await resolveTelegramFile(fileId);
  if (!file) return null;
  try {
    const upstream = await fetch(file.downloadUrl);
    if (!upstream.ok) return null;
    const buffer = Buffer.from(await upstream.arrayBuffer());
    const declared =
      upstream.headers.get('content-type') || mimeFromPath(file.filePath);
    const contentType = sniffTelegramMediaContentType(buffer, declared, file.filePath);
    return { buffer, contentType };
  } catch (err) {
    console.warn('fetch telegram file bytes failed:', (err as Error).message);
    return null;
  }
}

/** True if path is a local pet-photos API URL we can stream from disk. */
export function petPhotoStorageKeyFromUrl(url: string): string | null {
  const m = url.trim().match(/^\/api\/pets\/photos\/(\d+\/[\w.~-]+)$/);
  return m?.[1] ?? null;
}

export function readLocalPetPhoto(
  storageKey: string
): { buffer: Buffer; contentType: string } | null {
  const abs = resolvePetPhotoPath(storageKey);
  if (!abs || !fs.existsSync(abs)) return null;
  return {
    buffer: fs.readFileSync(abs),
    contentType: mimeFromPetPhotoKey(storageKey),
  };
}
