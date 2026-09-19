/**
 * Fantasy photo — keep the uploaded person and pet.
 * The full original frame is letterboxed onto the chosen studio color.
 * Coins are refunded if background removal fails. No generative restyle.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import {
  FANTASY_PHOTO_AI_COST,
  FANTASY_PHOTO_AI_REASON,
  fantasyPhotoStyleById,
  type FantasyPhotoStyle,
} from '@petdate/shared';
import { dbService } from '../db';
import { savePetLoverReviewImage } from './pet-lover-review-image-store';

const CANVAS = 800;
/** Full original frame sits inside the square. No trim, no upscale. */
const FRAME_MARGIN = 28;
const FIT_MAX = CANVAS - FRAME_MARGIN * 2;
/** Soft-light wash of the template color, background only. Stays inside 8–12%. */
const MOOD_ALPHA = 0.1;
const JPEG_QUALITY = 95;
/** Light sharpen. Low cap so edges do not grow a halo. */
const SHARPEN = { sigma: 0.8, m1: 0.35, m2: 0.6, x1: 2, y2: 5, y3: 6 } as const;
const BG_FAIL_FA =
  'حذف پس‌زمینه انجام نشد. شخص و پت همان می‌مانند و تصویر جدید ساخته نمی‌شود. ۵ سکه برگردانده شد.';

export type FantasyPhotoResult = {
  photoUrl: string;
  coins: number;
  cost: number;
  styleId: string;
  engine: 'background' | 'studio';
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Child script lives next to source and is copied into dist on build. */
function cutoutScriptPath(): string {
  const candidates = [
    path.join(__dirname, '../scripts/bg-cutout.mjs'),
    path.join(__dirname, '../../scripts/bg-cutout.mjs'),
    path.join(process.cwd(), 'scripts/bg-cutout.mjs'),
    path.join(process.cwd(), 'packages/api/scripts/bg-cutout.mjs'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('اسکریپت حذف بک‌گراند پیدا نشد');
}

function runCutout(input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cutoutScriptPath(), input, output], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('حذف بک‌گراند بیش از حد طول کشید'));
    }, 180_000);
    child.stderr.on('data', (chunk) => {
      err += String(chunk);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error((err || `cutout exit ${code}`).slice(0, 400)));
    });
  });
}

/**
 * Cut out the foreground together — the person and the pet they are holding.
 * Runs in a child process so the segmentation model does not crash next to sharp.
 */
async function cutoutPersonAndPet(buffer: Buffer): Promise<Buffer> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'petdate-fantasy-'));
  const src = path.join(dir, 'source.png');
  const out = path.join(dir, 'cutout.png');
  try {
    const prepared = await sharp(buffer).rotate().png().toBuffer();
    fs.writeFileSync(src, prepared);
    await runCutout(src, out);
    const png = fs.readFileSync(out);
    if (png.length < 800) throw new Error('برش سوژه ناموفق بود');
    return png;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Scale the whole frame down so it fits, including empty space around the person.
 * Never trim (that zooms and clips the legs) and never enlarge past the source.
 */
async function fitFullFrame(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input).rotate().metadata();
  const srcW = meta.width || 1;
  const srcH = meta.height || 1;
  const scale = Math.min(1, FIT_MAX / srcW, FIT_MAX / srcH);
  const pipeline = sharp(input).rotate().ensureAlpha();
  if (scale < 0.999) {
    pipeline.resize(Math.max(1, Math.round(srcW * scale)), Math.max(1, Math.round(srcH * scale)), {
      fit: 'fill',
      withoutEnlargement: true,
      kernel: 'lanczos3',
    });
  }
  return pipeline.png().toBuffer();
}

/**
 * Pull the old wall color out of semi-transparent edge pixels.
 * Interior colors of the person and pet are left alone.
 */
async function defringeBuffer(input: Buffer): Promise<Buffer> {
  const stats = await sharp(input).stats();
  const alphaStats = stats.channels[3];
  if (!alphaStats || alphaStats.min >= 250) return input;
  const meta = await sharp(input).metadata();
  const width = meta.width || 1;
  const height = meta.height || 1;
  const raw = await sharp(input).ensureAlpha().raw().toBuffer();
  defringeCutout(raw, width, height);
  return sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

function defringeCutout(raw: Buffer, width: number, height: number): void {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const pixels = width * height;
  for (let i = 0; i < pixels; i++) {
    const a = raw[i * 4 + 3]!;
    if (a > 0 && a < 20) {
      r += raw[i * 4]!;
      g += raw[i * 4 + 1]!;
      b += raw[i * 4 + 2]!;
      n++;
    }
  }
  if (n < 40) return;
  const bgR = r / n;
  const bgG = g / n;
  const bgB = b / n;
  for (let i = 0; i < pixels; i++) {
    const a8 = raw[i * 4 + 3]!;
    if (a8 < 28 || a8 > 245) continue;
    const a = a8 / 255;
    const inv = 1 - a;
    const channels = [bgR, bgG, bgB];
    for (let c = 0; c < 3; c++) {
      const fg = (raw[i * 4 + c]! - inv * channels[c]!) / a;
      raw[i * 4 + c] = Math.max(0, Math.min(255, Math.round(fg)));
    }
  }
}

/**
 * Soften the cutout edge without letting the old wall halo past the mask.
 * Opaque photos (no cutout) are left alone. Runs at output size so the feather stays small.
 */
async function featherCutout(input: Buffer): Promise<Buffer> {
  const stats = await sharp(input).ensureAlpha().stats();
  const alphaStats = stats.channels[3];
  if (!alphaStats || alphaStats.min >= 250) return input;

  const meta = await sharp(input).metadata();
  const width = meta.width || 1;
  const height = meta.height || 1;
  const raw = await sharp(input).ensureAlpha().raw().toBuffer();
  const alpha = Buffer.alloc(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = raw[i * 4 + 3]!;

  const blurred = await sharp(alpha, { raw: { width, height, channels: 1 } })
    .blur(0.9)
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  for (let i = 0; i < alpha.length; i++) {
    const original = alpha[i]!;
    raw[i * 4 + 3] = original === 0 ? 0 : Math.min(original, blurred[i] ?? 0);
  }
  return sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/** Subtle darker band at the bottom of the backdrop, never on the subject. */
async function floorFalloff(rgb: { r: number; g: number; b: number }): Promise<Buffer> {
  const raw = Buffer.alloc(CANVAS * CANVAS * 4);
  const start = Math.round(CANVAS * 0.8);
  const span = Math.max(1, CANVAS - 1 - start);
  for (let y = start; y < CANVAS; y++) {
    const t = (y - start) / span;
    const a = Math.round(36 * t * t);
    const row = y * CANVAS * 4;
    const r = Math.round(rgb.r * 0.45);
    const g = Math.round(rgb.g * 0.45);
    const b = Math.round(rgb.b * 0.45);
    for (let x = 0; x < CANVAS; x++) {
      const i = row + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  return sharp(raw, { raw: { width: CANVAS, height: CANVAS, channels: 4 } }).png().toBuffer();
}

/** Soft contact shadow on the backdrop, blurred past the subject box so it is not clipped. */
async function contactShadow(subject: Buffer, left: number, top: number): Promise<Buffer | null> {
  const meta = await sharp(subject).metadata();
  const w = meta.width || 1;
  const h = meta.height || 1;
  const mask = await sharp(subject).ensureAlpha().extractChannel(3).png().toBuffer();
  const dy = 5;
  let placeLeft = left;
  let placeTop = top + dy;
  let input = mask;
  if (placeLeft < 0 || placeTop < 0 || placeLeft + w > CANVAS || placeTop + h > CANVAS) {
    const cropLeft = Math.max(0, -placeLeft);
    const cropTop = Math.max(0, -placeTop);
    const cropW = Math.min(w - cropLeft, CANVAS - Math.max(0, placeLeft));
    const cropH = Math.min(h - cropTop, CANVAS - Math.max(0, placeTop));
    if (cropW < 2 || cropH < 2) return null;
    input = await sharp(mask)
      .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
      .png()
      .toBuffer();
    placeLeft = Math.max(0, placeLeft);
    placeTop = Math.max(0, placeTop);
  }
  const placed = await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([{ input, left: placeLeft, top: placeTop }])
    .removeAlpha()
    .toColourspace('b-w')
    .png()
    .toBuffer();
  // Blur in a second pipeline. Chaining it after composite is reordered and the edge stays hard.
  const spread = await sharp(placed).blur(16).linear(0.36, 0).png().toBuffer();
  return sharp({
    create: { width: CANVAS, height: CANVAS, channels: 3, background: { r: 58, g: 36, b: 28 } },
  })
    .joinChannel(spread)
    .png()
    .toBuffer();
}

/** Place the untouched cutout on the template color. Pose and colors stay. */
export async function placeOnStudioBackground(subject: Buffer, background: string): Promise<Buffer> {
  const rgb = hexToRgb(background);
  const oriented = await sharp(subject).rotate().ensureAlpha().png().toBuffer();
  const cleaned = await defringeBuffer(oriented);
  const fitted = await featherCutout(await fitFullFrame(cleaned));
  const meta = await sharp(fitted).metadata();
  const w = meta.width || 1;
  const h = meta.height || 1;
  const left = Math.round((CANVAS - w) / 2);
  const top = Math.round((CANVAS - h) / 2);

  const wash = await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { ...rgb, alpha: MOOD_ALPHA },
    },
  })
    .png()
    .toBuffer();
  const falloff = await floorFalloff(rgb);
  const shadow = await contactShadow(fitted, left, top);
  const layers: sharp.OverlayOptions[] = [
    { input: falloff, left: 0, top: 0 },
    { input: wash, left: 0, top: 0, blend: 'soft-light' },
  ];
  if (shadow) layers.push({ input: shadow, left: 0, top: 0 });
  layers.push({ input: fitted, left, top });

  return sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { ...rgb, alpha: 1 },
    },
  })
    .composite(layers)
    .sharpen(SHARPEN)
    .jpeg({ quality: JPEG_QUALITY, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

export async function restyleKeepingSubject(buffer: Buffer, background: string): Promise<Buffer> {
  const cutout = await cutoutPersonAndPet(buffer);
  return placeOnStudioBackground(cutout, background);
}

export async function generateFantasyPhoto(opts: {
  userId: number;
  styleId: string;
  buffer: Buffer;
  mimeType?: string;
  originalName?: string;
  publicOrigin: string;
}): Promise<FantasyPhotoResult> {
  const style: FantasyPhotoStyle | null = fantasyPhotoStyleById(opts.styleId);
  if (!style) {
    throw Object.assign(new Error('نمونه انتخاب‌شده معتبر نیست'), { status: 400 });
  }
  const user = dbService.getUserById(opts.userId);
  if (!user) throw Object.assign(new Error('کاربر پیدا نشد'), { status: 401 });
  const balance = Number(user.coins ?? 0);
  if (balance < FANTASY_PHOTO_AI_COST) {
    throw Object.assign(
      new Error(`برای ساخت عکس ${FANTASY_PHOTO_AI_COST} سکه لازم است`),
      { status: 402 },
    );
  }

  const debited = dbService.debitCoins(opts.userId, FANTASY_PHOTO_AI_COST, {
    reason: FANTASY_PHOTO_AI_REASON,
    refType: 'fantasy_photo',
  });
  if (!debited) {
    throw Object.assign(
      new Error(`برای ساخت عکس ${FANTASY_PHOTO_AI_COST} سکه لازم است`),
      { status: 402 },
    );
  }

  try {
    const forceStudio = process.env.FANTASY_PHOTO_FORCE_STUDIO === '1';
    let out: Buffer;
    let engine: FantasyPhotoResult['engine'] = 'background';
    if (forceStudio) {
      engine = 'studio';
      out = await placeOnStudioBackground(opts.buffer, style.background);
    } else {
      out = await restyleKeepingSubject(opts.buffer, style.background);
    }
    const saved = savePetLoverReviewImage({
      originalName: `fantasy-${style.id}.jpg`,
      mimeType: 'image/jpeg',
      buffer: out,
    });
    return {
      photoUrl: saved.urlPath,
      coins: Number(debited.coins ?? balance - FANTASY_PHOTO_AI_COST),
      cost: FANTASY_PHOTO_AI_COST,
      styleId: style.id,
      engine,
    };
  } catch (err) {
    dbService.creditCoins(opts.userId, FANTASY_PHOTO_AI_COST, undefined, {
      reason: 'بازگشت سکه ساخت عکس فانتزی',
      refType: 'fantasy_photo_refund',
    });
    console.warn('fantasy photo background removal failed:', err instanceof Error ? err.message : err);
    throw Object.assign(new Error(BG_FAIL_FA), { status: 502 });
  }
}
