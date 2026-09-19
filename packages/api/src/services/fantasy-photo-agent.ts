/**
 * Fantasy photo agent — restyle a member upload to a studio sample.
 * Tries Pollinations (image reference) then falls back to a local studio composite.
 * Coins are debited only after a photo is produced; refunded if both engines fail.
 */
import sharp from 'sharp';
import {
  FANTASY_PHOTO_AI_COST,
  FANTASY_PHOTO_AI_REASON,
  fantasyPhotoStyleById,
  type FantasyPhotoStyle,
} from '@petdate/shared';
import { dbService } from '../db';
import { savePetLoverReviewImage } from './pet-lover-review-image-store';

const AI_TIMEOUT_MS = 28_000;

export type FantasyPhotoResult = {
  photoUrl: string;
  coins: number;
  cost: number;
  styleId: string;
  engine: 'ai' | 'studio';
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Local studio look: user photo on the chosen solid background. Preserves identity. */
export async function composeStudioPortrait(buffer: Buffer, background: string): Promise<Buffer> {
  const rgb = hexToRgb(background);
  const portrait = await sharp(buffer)
    .rotate()
    .resize(620, 620, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 88 })
    .toBuffer();
  return sharp({
    create: {
      width: 800,
      height: 800,
      channels: 3,
      background: rgb,
    },
  })
    .composite([{ input: portrait, top: 90, left: 90 }])
    .jpeg({ quality: 86 })
    .toBuffer();
}

async function pollinationsRestyle(opts: {
  prompt: string;
  imageUrl: string;
}): Promise<Buffer> {
  const q = new URLSearchParams({
    width: '800',
    height: '800',
    nologo: 'true',
    model: 'flux',
    image: opts.imageUrl,
    enhance: 'false',
  });
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(opts.prompt)}?${q}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`AI ${res.status}`);
    const mime = (res.headers.get('content-type') || '').toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    if (!mime.includes('image') || buf.length < 4000) throw new Error('AI_BAD_IMAGE');
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateFantasyPhoto(opts: {
  userId: number;
  styleId: string;
  buffer: Buffer;
  mimeType?: string;
  originalName?: string;
  /** Absolute origin so the image model can fetch the source, e.g. https://petdate.ir */
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
    const source = savePetLoverReviewImage({
      originalName: opts.originalName || 'source.jpg',
      mimeType: opts.mimeType,
      buffer: opts.buffer,
    });
    const forceStudio = process.env.FANTASY_PHOTO_FORCE_STUDIO === '1';
    let out: Buffer;
    let engine: 'ai' | 'studio' = 'studio';
    if (!forceStudio) {
      try {
        const imageUrl = `${opts.publicOrigin.replace(/\/$/, '')}${source.urlPath}`;
        out = await pollinationsRestyle({ prompt: style.prompt, imageUrl });
        engine = 'ai';
      } catch (err) {
        console.warn('fantasy photo AI fallback:', (err as Error).message);
        out = await composeStudioPortrait(opts.buffer, style.background);
      }
    } else {
      out = await composeStudioPortrait(opts.buffer, style.background);
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
    throw err;
  }
}
