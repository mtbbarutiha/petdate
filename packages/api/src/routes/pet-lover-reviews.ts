/**
 * Public + member pet-lover reviews — /api/pet-lover-reviews/*
 */
import fs from 'fs';
import { Router } from 'express';
import multer from 'multer';
import {
  listFeaturedPetLoverReviews,
  listPublicPetLoverReviews,
  submitPetLoverReview,
} from '../pet-lover-reviews-service';
import {
  MAX_PET_LOVER_REVIEW_IMAGE_BYTES,
  mimeFromPetLoverReviewImageKey,
  resolvePetLoverReviewImagePath,
  savePetLoverReviewImage,
} from '../services/pet-lover-review-image-store';
import { getUserFromBearer } from '../services/web-otp';
import { FANTASY_PHOTO_AI_COST, FANTASY_PHOTO_STYLES } from '@petdate/shared';
import { generateFantasyPhoto } from '../services/fantasy-photo-agent';

export const petLoverReviewsRouter = Router();

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PET_LOVER_REVIEW_IMAGE_BYTES },
});

petLoverReviewsRouter.get('/images/:day/:filename', (req, res) => {
  const day = String(req.params.day || '');
  const filename = String(req.params.filename || '');
  const storageKey = `${day}/${filename}`;
  const abs = resolvePetLoverReviewImagePath(storageKey);
  if (!abs || !fs.existsSync(abs)) {
    res.status(404).json({ error: 'تصویر پیدا نشد' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.type(mimeFromPetLoverReviewImageKey(storageKey));
  fs.createReadStream(abs).pipe(res);
});

petLoverReviewsRouter.get('/styles', (_req, res) => {
  res.json({
    styles: FANTASY_PHOTO_STYLES.map((s) => ({
      id: s.id,
      labelFa: s.labelFa,
      labelEn: s.labelEn,
      background: s.background,
      sampleUrl: s.sampleUrl,
    })),
    cost: FANTASY_PHOTO_AI_COST,
  });
});

function publicOrigin(req: { headers: Record<string, unknown>; protocol: string }): string {
  const env = String(process.env.PUBLIC_BASE_URL || process.env.SITE_URL || '').trim();
  if (env) return env.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'petdate.ir').split(',')[0];
  return `${proto}://${host}`;
}

/** Member AI restyle — 5 coins. Result can be attached to a review submission. */
petLoverReviewsRouter.post('/ai-photo', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session?.user?.id) {
    res.status(401).json({ error: 'برای ساخت عکس باید وارد حساب شوید' });
    return;
  }
  const userId = session.user.id;
  imageUpload.single('photo')(req, res, (uploadErr) => {
    if (uploadErr) {
      const tooLarge =
        uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({
        error: tooLarge ? 'حجم تصویر بیش از حد مجاز است (حداکثر ۸ مگابایت)' : 'آپلود تصویر ناموفق بود',
      });
      return;
    }
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: 'عکس خودت را انتخاب کن' });
      return;
    }
    const styleId = String(req.body?.styleId || '').trim();
    void generateFantasyPhoto({
      userId,
      styleId,
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      publicOrigin: publicOrigin(req),
    })
      .then((result) => {
        res.status(201).json({
          ...result,
          message: 'عکس فانتزی آماده است. می‌توانی همان را در نظر منتشر کنی.',
        });
      })
      .catch((err: Error & { status?: number }) => {
        const status = Number(err.status) || 400;
        res.status(status).json({ error: err.message || 'ساخت عکس ناموفق بود' });
      });
  });
});

petLoverReviewsRouter.get('/featured', (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 4;
  const reviews = listFeaturedPetLoverReviews(Number.isFinite(limit) ? limit : 4);
  res.json({ reviews });
});

petLoverReviewsRouter.get('/', (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 30;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const { reviews, total } = listPublicPetLoverReviews({
    limit: Number.isFinite(limit) ? limit : 30,
    offset: Number.isFinite(offset) ? offset : 0,
  });
  res.json({ reviews, total });
});

/** Member submit — login required; published only after admin approve. */
petLoverReviewsRouter.post('/', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session?.user?.id) {
    res.status(401).json({ error: 'برای ارسال نظر باید وارد حساب شوید' });
    return;
  }
  const userId = session.user.id;
  imageUpload.single('photo')(req, res, (uploadErr) => {
    if (uploadErr) {
      const tooLarge =
        uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({
        error: tooLarge
          ? 'حجم تصویر بیش از حد مجاز است (حداکثر ۸ مگابایت)'
          : 'آپلود تصویر ناموفق بود',
      });
      return;
    }
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: 'عکس فانتزی پت الزامی است' });
      return;
    }
    try {
      const saved = savePetLoverReviewImage({
        originalName: file.originalname || 'review.jpg',
        mimeType: file.mimetype,
        buffer: file.buffer,
      });
      const body = typeof req.body?.body === 'string' ? req.body.body : '';
      const handle =
        typeof req.body?.displayHandle === 'string'
          ? req.body.displayHandle
          : typeof req.body?.handle === 'string'
            ? req.body.handle
            : '';
      const rating = req.body?.rating != null ? Number(req.body.rating) : 5;
      const review = submitPetLoverReview({
        userId,
        displayHandle: handle,
        body,
        rating,
        photoUrl: saved.urlPath,
      });
      res.status(201).json({
        review,
        message: 'نظرت ثبت شد و پس از تأیید ادمین منتشر می‌شود',
      });
    } catch (err) {
      const status = Number((err as { status?: number }).status) || 400;
      const msg = (err as Error).message;
      if (msg === 'FILE_TOO_LARGE') {
        res.status(413).json({ error: 'حجم تصویر بیش از حد مجاز است (حداکثر ۸ مگابایت)' });
        return;
      }
      if (msg === 'INVALID_MIME') {
        res.status(400).json({ error: 'فقط تصویر JPG، PNG یا WebP مجاز است' });
        return;
      }
      res.status(status).json({ error: msg || 'ثبت نظر ناموفق بود' });
    }
  });
});
