/**
 * Fantasy photo — keep the uploaded person and pet.
 * The background is replaced with the chosen studio color and a light mood tint.
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
const SUBJECT_MAX = 720;
/** Soft-light wash of the template color. Stays inside 8–12%. */
const MOOD_ALPHA = 0.1;
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
  const src = path.join(dir, 'source.jpg');
  const out = path.join(dir, 'cutout.png');
  try {
    const jpeg = await sharp(buffer).rotate().jpeg({ quality: 95 }).toBuffer();
    fs.writeFileSync(src, jpeg);
    await runCutout(src, out);
    const png = fs.readFileSync(out);
    if (png.length < 800) throw new Error('برش سوژه ناموفق بود');
    return png;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function sizedSubject(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input).rotate().metadata();
  const chain = sharp(input).rotate().ensureAlpha();
  if (meta.hasAlpha) chain.trim({ threshold: 12 });
  try {
    return await chain
      .resize(SUBJECT_MAX, SUBJECT_MAX, { fit: 'inside', withoutEnlargement: false })
      .modulate({ saturation: 1.06 })
      .png()
      .toBuffer();
  } catch {
    return sharp(input)
      .rotate()
      .resize(SUBJECT_MAX, SUBJECT_MAX, { fit: 'inside', withoutEnlargement: false })
      .modulate({ saturation: 1.06 })
      .png()
      .toBuffer();
  }
}

/** Place the untouched cutout on the template color and add a faint mood tint. */
export async function placeOnStudioBackground(subject: Buffer, background: string): Promise<Buffer> {
  const rgb = hexToRgb(background);
  const sized = await sizedSubject(subject);
  const meta = await sharp(sized).metadata();
  const w = meta.width || SUBJECT_MAX;
  const h = meta.height || SUBJECT_MAX;
  const left = Math.max(0, Math.round((CANVAS - w) / 2));
  const top = Math.max(0, Math.round((CANVAS - h) / 2));
  const tint = await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { ...rgb, alpha: MOOD_ALPHA },
    },
  })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { ...rgb, alpha: 1 },
    },
  })
    .composite([
      { input: sized, left, top },
      { input: tint, blend: 'soft-light' },
    ])
    .jpeg({ quality: 90 })
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
