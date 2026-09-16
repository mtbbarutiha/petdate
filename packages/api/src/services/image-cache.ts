/**
 * Disk-backed WebP image cache — on-demand convert + long-lived public responses.
 * Used by GET /api/img and by API media send paths (pets, avatars, telegram proxy).
 */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { resolvePetPhotoPath } from './pet-photo-store';
import { resolveUserAvatarPath } from './user-avatar-store';
import { resolveHeroImagePath } from './hero-slide-store';
import { resolveMagazineImagePath } from './magazine-image-store';
import { resolveEventPhotoPath } from './event-photo-store';

export const IMAGE_CACHE_DEFAULT_QUALITY = 80;
export const IMAGE_CACHE_DEFAULT_MAX_EDGE = 1600;
export const IMAGE_CACHE_MAX_SOURCE_BYTES = 20 * 1024 * 1024;

const ALLOWED_STATIC_PREFIXES = [
  '/pepito/',
  '/media/',
  '/pets/',
  '/brand/',
  '/agents/',
] as const;

const ALLOWED_API_FILE_PREFIXES = [
  '/api/pets/photos/',
  '/api/auth/avatar/',
  '/api/hero/images/',
  '/api/magazine/images/',
  '/api/games/photos/',
] as const;

const RASTER_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
  '.heic',
  '.heif',
]);

export type ImageCacheTransform = {
  maxEdge?: number;
  quality?: number;
};

export type CachedWebpResult = {
  buffer: Buffer;
  contentType: 'image/webp' | 'image/gif';
  fromCache: boolean;
  cacheKey: string;
};

function dataRoot(): string {
  const raw = (process.env.DATABASE_PATH || '').trim();
  const dbFile =
    raw && path.isAbsolute(raw)
      ? raw
      : path.join(__dirname, '..', '..', 'data', 'petdate.db');
  return path.dirname(dbFile);
}

export function imageCacheRoot(): string {
  return path.join(dataRoot(), 'image-cache');
}

export function ensureImageCacheRoot(): string {
  const root = imageCacheRoot();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

/** Candidate roots for public web static files (dist preferred, then public). */
export function webPublicRoots(): string[] {
  const fromEnv = (process.env.WEB_PUBLIC_DIR || process.env.WEB_DIST_DIR || '').trim();
  const roots: string[] = [];
  if (fromEnv && path.isAbsolute(fromEnv)) roots.push(fromEnv);
  // packages/api/src/services → repo packages/web/{dist,public}
  const webPkg = path.resolve(__dirname, '..', '..', '..', 'web');
  roots.push(path.join(webPkg, 'dist'), path.join(webPkg, 'public'));
  // Deploy layout: /opt/petdate/packages/web/dist
  const optWeb = '/opt/petdate/packages/web';
  roots.push(path.join(optWeb, 'dist'), path.join(optWeb, 'public'));
  return [...new Set(roots)];
}

function underRoot(abs: string, root: string): boolean {
  const r = path.resolve(root);
  const a = path.resolve(abs);
  return a === r || a.startsWith(r + path.sep);
}

export function isAllowedImageSrcPath(srcPath: string): boolean {
  if (!srcPath.startsWith('/') || srcPath.includes('..') || srcPath.includes('\\')) return false;
  if (srcPath.length > 512) return false;
  for (const p of ALLOWED_STATIC_PREFIXES) {
    if (srcPath.startsWith(p)) return true;
  }
  for (const p of ALLOWED_API_FILE_PREFIXES) {
    if (srcPath.startsWith(p)) return true;
  }
  return false;
}

/** Strip query/hash; keep pathname only. */
export function normalizeImageSrcPath(raw: string): string | null {
  const t = String(raw || '').trim();
  if (!t) return null;
  let pathname = t;
  try {
    if (/^https?:\/\//i.test(t)) {
      const u = new URL(t);
      // Only same-site public hosts — never arbitrary remote fetch (SSRF).
      const host = u.hostname.replace(/^www\./, '').toLowerCase();
      if (host !== 'petdate.ir' && host !== 'localhost' && host !== '127.0.0.1') {
        return null;
      }
      pathname = u.pathname;
    } else {
      pathname = t.split('?')[0]?.split('#')[0] || '';
    }
  } catch {
    return null;
  }
  pathname = pathname.replace(/\/{2,}/g, '/');
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  if (!isAllowedImageSrcPath(pathname)) return null;
  const ext = path.extname(pathname).toLowerCase();
  if (ext === '.svg' || ext === '.ico' || ext === '.pdf') return null;
  if (ext && !RASTER_EXT.has(ext)) return null;
  return pathname;
}

function resolveApiFilePath(srcPath: string): string | null {
  if (srcPath.startsWith('/api/pets/photos/')) {
    return resolvePetPhotoPath(srcPath.slice('/api/pets/photos/'.length));
  }
  if (srcPath.startsWith('/api/auth/avatar/')) {
    return resolveUserAvatarPath(srcPath.slice('/api/auth/avatar/'.length));
  }
  if (srcPath.startsWith('/api/hero/images/')) {
    return resolveHeroImagePath(srcPath.slice('/api/hero/images/'.length));
  }
  if (srcPath.startsWith('/api/magazine/images/')) {
    return resolveMagazineImagePath(srcPath.slice('/api/magazine/images/'.length));
  }
  if (srcPath.startsWith('/api/games/photos/')) {
    return resolveEventPhotoPath(srcPath.slice('/api/games/photos/'.length));
  }
  return null;
}

export function resolveImageSourcePath(srcPath: string): string | null {
  const normalized = normalizeImageSrcPath(srcPath);
  if (!normalized) return null;

  if (normalized.startsWith('/api/')) {
    const abs = resolveApiFilePath(normalized);
    if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
    return abs;
  }

  for (const root of webPublicRoots()) {
    if (!fs.existsSync(root)) continue;
    const abs = path.resolve(root, normalized.replace(/^\//, ''));
    if (!underRoot(abs, root)) continue;
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }
  return null;
}

function clampEdge(n: number | undefined): number {
  if (n == null || !Number.isFinite(n) || n <= 0) return IMAGE_CACHE_DEFAULT_MAX_EDGE;
  return Math.min(4096, Math.max(64, Math.round(n)));
}

function clampQuality(n: number | undefined): number {
  if (n == null || !Number.isFinite(n)) return IMAGE_CACHE_DEFAULT_QUALITY;
  return Math.min(95, Math.max(40, Math.round(n)));
}

export function buildImageCacheKey(
  absPath: string,
  opts: { maxEdge: number; quality: number; mtimeMs: number; size: number }
): string {
  const h = createHash('sha256');
  h.update(absPath);
  h.update(`|${opts.mtimeMs}|${opts.size}|e${opts.maxEdge}|q${opts.quality}|webp1`);
  return h.digest('hex').slice(0, 40);
}

function cacheFilePath(cacheKey: string, ext: '.webp' | '.gif'): string {
  const root = ensureImageCacheRoot();
  const a = cacheKey.slice(0, 2);
  const b = cacheKey.slice(2, 4);
  return path.join(root, a, b, `${cacheKey}${ext}`);
}

function sniffIsGif(buffer: Buffer): boolean {
  if (buffer.length < 6) return false;
  const head = buffer.toString('ascii', 0, 6);
  return head === 'GIF89a' || head === 'GIF87a';
}

function sniffIsWebp(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  );
}

/**
 * Convert (or passthrough) to cached WebP. Animated GIF is preserved as GIF.
 */
export async function getOrCreateCachedWebp(
  absPath: string,
  transform: ImageCacheTransform = {}
): Promise<CachedWebpResult> {
  const st = fs.statSync(absPath);
  if (!st.isFile()) throw new Error('SOURCE_NOT_FOUND');
  if (st.size > IMAGE_CACHE_MAX_SOURCE_BYTES) throw new Error('SOURCE_TOO_LARGE');

  const maxEdge = clampEdge(transform.maxEdge);
  const quality = clampQuality(transform.quality);
  const cacheKey = buildImageCacheKey(absPath, {
    maxEdge,
    quality,
    mtimeMs: Math.floor(st.mtimeMs),
    size: st.size,
  });

  const sourceBuf = fs.readFileSync(absPath);
  if (sniffIsGif(sourceBuf)) {
    // Keep animated GIF — cache a copy for stable Cache-Control URLs.
    const gifPath = cacheFilePath(cacheKey, '.gif');
    if (fs.existsSync(gifPath)) {
      return {
        buffer: fs.readFileSync(gifPath),
        contentType: 'image/gif',
        fromCache: true,
        cacheKey,
      };
    }
    fs.mkdirSync(path.dirname(gifPath), { recursive: true });
    fs.writeFileSync(gifPath, sourceBuf);
    return {
      buffer: sourceBuf,
      contentType: 'image/gif',
      fromCache: false,
      cacheKey,
    };
  }

  const webpPath = cacheFilePath(cacheKey, '.webp');
  if (fs.existsSync(webpPath)) {
    return {
      buffer: fs.readFileSync(webpPath),
      contentType: 'image/webp',
      fromCache: true,
      cacheKey,
    };
  }

  // Already WebP and within edge — optional re-encode only when oversized.
  let pipeline = sharp(sourceBuf, { failOn: 'none', animated: false }).rotate();
  const meta = await pipeline.metadata();
  const needsResize =
    (typeof meta.width === 'number' && meta.width > maxEdge) ||
    (typeof meta.height === 'number' && meta.height > maxEdge);

  if (sniffIsWebp(sourceBuf) && !needsResize) {
    fs.mkdirSync(path.dirname(webpPath), { recursive: true });
    fs.writeFileSync(webpPath, sourceBuf);
    return {
      buffer: sourceBuf,
      contentType: 'image/webp',
      fromCache: false,
      cacheKey,
    };
  }

  pipeline = sharp(sourceBuf, { failOn: 'none', animated: false }).rotate();
  if (needsResize) {
    pipeline = pipeline.resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  const out = await pipeline.webp({ quality, effort: 4 }).toBuffer();
  if (!out.length) throw new Error('WEBP_EMPTY');
  fs.mkdirSync(path.dirname(webpPath), { recursive: true });
  fs.writeFileSync(webpPath, out);
  return {
    buffer: out,
    contentType: 'image/webp',
    fromCache: false,
    cacheKey,
  };
}

/**
 * Buffer → WebP cache (for Telegram proxy / in-memory sources).
 * `stableId` must be unique per logical source (e.g. file_id or pet photo key).
 */
export async function getOrCreateCachedWebpFromBuffer(
  buffer: Buffer,
  stableId: string,
  transform: ImageCacheTransform = {}
): Promise<CachedWebpResult> {
  if (!buffer.length) throw new Error('SOURCE_EMPTY');
  if (buffer.length > IMAGE_CACHE_MAX_SOURCE_BYTES) throw new Error('SOURCE_TOO_LARGE');
  const maxEdge = clampEdge(transform.maxEdge);
  const quality = clampQuality(transform.quality);
  const h = createHash('sha256');
  h.update(String(stableId));
  h.update(buffer.subarray(0, Math.min(buffer.length, 64 * 1024)));
  h.update(`|${buffer.length}|e${maxEdge}|q${quality}|webp1`);
  const cacheKey = h.digest('hex').slice(0, 40);

  if (sniffIsGif(buffer)) {
    const gifPath = cacheFilePath(cacheKey, '.gif');
    if (fs.existsSync(gifPath)) {
      return {
        buffer: fs.readFileSync(gifPath),
        contentType: 'image/gif',
        fromCache: true,
        cacheKey,
      };
    }
    fs.mkdirSync(path.dirname(gifPath), { recursive: true });
    fs.writeFileSync(gifPath, buffer);
    return { buffer, contentType: 'image/gif', fromCache: false, cacheKey };
  }

  const webpPath = cacheFilePath(cacheKey, '.webp');
  if (fs.existsSync(webpPath)) {
    return {
      buffer: fs.readFileSync(webpPath),
      contentType: 'image/webp',
      fromCache: true,
      cacheKey,
    };
  }

  let pipeline = sharp(buffer, { failOn: 'none', animated: false }).rotate();
  const meta = await pipeline.metadata();
  const needsResize =
    (typeof meta.width === 'number' && meta.width > maxEdge) ||
    (typeof meta.height === 'number' && meta.height > maxEdge);
  pipeline = sharp(buffer, { failOn: 'none', animated: false }).rotate();
  if (needsResize) {
    pipeline = pipeline.resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  const out = await pipeline.webp({ quality, effort: 4 }).toBuffer();
  fs.mkdirSync(path.dirname(webpPath), { recursive: true });
  fs.writeFileSync(webpPath, out);
  return {
    buffer: out,
    contentType: 'image/webp',
    fromCache: false,
    cacheKey,
  };
}

/** Express-friendly Cache-Control for public WebP variants. */
export const IMAGE_CACHE_CONTROL = 'public, max-age=2592000, immutable';

/**
 * Read a local image file, convert/cache to WebP, and send.
 * Returns false if conversion fails (caller may fall back to raw bytes).
 */
export async function trySendCachedWebpFile(
  res: {
    setHeader: (k: string, v: string) => void;
    send: (b: Buffer) => void;
    headersSent?: boolean;
  },
  absPath: string,
  transform?: ImageCacheTransform
): Promise<boolean> {
  try {
    const result = await getOrCreateCachedWebp(absPath, transform);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', IMAGE_CACHE_CONTROL);
    res.setHeader('X-PetDate-Img-Cache', result.fromCache ? 'HIT' : 'MISS');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(result.buffer);
    return true;
  } catch (err) {
    console.warn('cached webp send failed:', (err as Error).message);
    return false;
  }
}

/**
 * Convert in-memory image bytes to cached WebP and send.
 */
export async function trySendCachedWebpBuffer(
  res: {
    setHeader: (k: string, v: string) => void;
    send: (b: Buffer) => void;
  },
  buffer: Buffer,
  stableId: string,
  transform?: ImageCacheTransform
): Promise<boolean> {
  try {
    const result = await getOrCreateCachedWebpFromBuffer(buffer, stableId, transform);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', IMAGE_CACHE_CONTROL);
    res.setHeader('X-PetDate-Img-Cache', result.fromCache ? 'HIT' : 'MISS');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(result.buffer);
    return true;
  } catch (err) {
    console.warn('cached webp buffer send failed:', (err as Error).message);
    return false;
  }
}