/**
 * Homepage hero slide image storage + auto crop/resize for the landing hero band.
 * Files live next to SQLite (survives web deploys). Served via /api/hero/images/*.
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

export const MAX_HERO_UPLOAD_BYTES = 12 * 1024 * 1024;

export const HERO_ROLES = [
  'playmate',
  'vet',
  'trainer',
  'no_pet',
  'adoption',
] as const;

export type HeroRole = (typeof HERO_ROLES)[number];

export type HeroSlideAssets = {
  webp800: string;
  webp1280: string;
  webp1920: string;
  jpeg: string;
  updatedAt: string;
  originalName?: string;
};

/** 16:9 — matches object-fit:cover; live CSS uses object-position:center top. */
const WEBP_SIZES = [
  { w: 800, h: 450, name: '800' as const },
  { w: 1280, h: 720, name: '1280' as const },
  { w: 1920, h: 1080, name: '1920' as const },
];
const JPEG_W = 2400;
const JPEG_H = 1350;
const WEBP_QUALITY = 90;
const JPEG_QUALITY = 90;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

export function isHeroRole(value: string): value is HeroRole {
  return (HERO_ROLES as readonly string[]).includes(value);
}

export function heroSlidesRoot(): string {
  const raw = (process.env.DATABASE_PATH || '').trim();
  const dbFile =
    raw && path.isAbsolute(raw)
      ? raw
      : path.join(__dirname, '..', '..', 'data', 'petdate.db');
  return path.join(path.dirname(dbFile), 'hero-slides');
}

export function ensureHeroSlidesRoot(): string {
  const root = heroSlidesRoot();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

export function isAllowedHeroImageMime(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  return ALLOWED_MIME.has(mimeType.toLowerCase());
}

/** storageKey like `20260913/<uuid>-playmate-1920.webp` */
export function resolveHeroImagePath(storageKey: string): string | null {
  if (!storageKey || storageKey.includes('..') || path.isAbsolute(storageKey)) return null;
  const parts = storageKey.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  if (!/^\d{8}$/.test(parts[0])) return null;
  if (!/^[\w.~-]+$/.test(parts[1])) return null;
  const root = ensureHeroSlidesRoot();
  const abs = path.resolve(root, storageKey);
  if (!abs.startsWith(path.resolve(root) + path.sep) && abs !== path.resolve(root)) {
    return null;
  }
  return abs;
}

export function mimeFromHeroImageKey(storageKey: string): string {
  const ext = path.extname(storageKey).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

function publicUrl(storageKey: string): string {
  return `/api/hero/images/${storageKey}`;
}

function dayStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Cover-crop to 16:9 from the top (matches live hero object-position: center top),
 * then emit WebP srcset + JPEG fallback.
 */
export async function processAndSaveHeroSlide(opts: {
  role: HeroRole;
  originalName: string;
  mimeType?: string;
  buffer: Buffer;
}): Promise<HeroSlideAssets> {
  if (opts.buffer.length > MAX_HERO_UPLOAD_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }
  if (!isAllowedHeroImageMime(opts.mimeType)) {
    throw new Error('INVALID_MIME');
  }

  try {
    const meta = await sharp(opts.buffer, { failOn: 'none', animated: false }).rotate().metadata();
    if (!meta.width || !meta.height) throw new Error('INVALID_IMAGE');
  } catch (err) {
    if (err instanceof Error && (err.message === 'FILE_TOO_LARGE' || err.message === 'INVALID_MIME')) {
      throw err;
    }
    throw new Error('INVALID_IMAGE');
  }

  const day = dayStamp();
  const id = randomUUID();
  const root = ensureHeroSlidesRoot();
  const dir = path.join(root, day);
  fs.mkdirSync(dir, { recursive: true });

  const urls: Partial<HeroSlideAssets> = {
    updatedAt: new Date().toISOString(),
    originalName: path.basename(opts.originalName || 'hero.jpg').slice(0, 120),
  };

  for (const size of WEBP_SIZES) {
    const file = `${id}-${opts.role}-${size.name}.webp`;
    const abs = path.join(dir, file);
    const key = `${day}/${file}`;
    await sharp(opts.buffer, { failOn: 'none', animated: false })
      .rotate()
      .resize(size.w, size.h, { fit: 'cover', position: 'top' })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toFile(abs);
    if (size.name === '800') urls.webp800 = publicUrl(key);
    if (size.name === '1280') urls.webp1280 = publicUrl(key);
    if (size.name === '1920') urls.webp1920 = publicUrl(key);
  }

  {
    const file = `${id}-${opts.role}-fallback.jpg`;
    const abs = path.join(dir, file);
    const key = `${day}/${file}`;
    await sharp(opts.buffer, { failOn: 'none', animated: false })
      .rotate()
      .resize(JPEG_W, JPEG_H, { fit: 'cover', position: 'top' })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true })
      .toFile(abs);
    urls.jpeg = publicUrl(key);
  }

  if (!urls.webp800 || !urls.webp1280 || !urls.webp1920 || !urls.jpeg) {
    throw new Error('SAVE_FAILED');
  }

  return urls as HeroSlideAssets;
}
