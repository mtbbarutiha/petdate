/**
 * Admin magazine CMS — /api/admin/magazine/*
 */
import { Router } from 'express';
import multer from 'multer';
import { requirePermission } from '../admin-auth';
import {
  createMagazineArticle,
  getMagazineArticleById,
  listMagazineArticles,
  setMagazineArticleStatus,
  softDeleteMagazineArticle,
  updateMagazineArticle,
  type MagazineStatus,
} from '../magazine-service';
import {
  MAX_MAGAZINE_IMAGE_BYTES,
  saveMagazineImage,
} from '../services/magazine-image-store';

export const magazineAdminRouter = Router();

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MAGAZINE_IMAGE_BYTES },
});

magazineAdminRouter.use(requirePermission('platform.write'));

magazineAdminRouter.post('/upload', (req, res) => {
  imageUpload.single('file')(req, res, (uploadErr) => {
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
      res.status(400).json({ error: 'فایل تصویر الزامی است' });
      return;
    }
    try {
      const saved = saveMagazineImage({
        originalName: file.originalname || 'image.jpg',
        mimeType: file.mimetype,
        buffer: file.buffer,
      });
      res.status(201).json({
        ok: true,
        url: saved.urlPath,
        storageKey: saved.storageKey,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'FILE_TOO_LARGE') {
        res.status(413).json({ error: 'حجم تصویر بیش از حد مجاز است (حداکثر ۸ مگابایت)' });
        return;
      }
      if (err instanceof Error && err.message === 'INVALID_MIME') {
        res.status(400).json({ error: 'فقط عکس (JPG، PNG، WebP، GIF) مجاز است' });
        return;
      }
      console.warn('magazine image upload failed:', (err as Error).message);
      res.status(500).json({ error: 'ذخیره تصویر ناموفق بود' });
    }
  });
});

magazineAdminRouter.get('/', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const statusRaw = typeof req.query.status === 'string' ? req.query.status : 'all';
  const status =
    statusRaw === 'draft' || statusRaw === 'published' || statusRaw === 'scheduled'
      ? statusRaw
      : 'all';
  const featured =
    req.query.featured === '1' || req.query.featured === 'true' ? true : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  try {
    const result = listMagazineArticles({
      q,
      status,
      featured,
      limit: Number.isFinite(limit) ? limit : 100,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

magazineAdminRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const article = getMagazineArticleById(id);
  if (!article) {
    res.status(404).json({ error: 'مقاله پیدا نشد' });
    return;
  }
  res.json({ article });
});

magazineAdminRouter.post('/', (req, res) => {
  try {
    const article = createMagazineArticle(req.body || {});
    res.status(201).json({ article });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

magazineAdminRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  try {
    const article = updateMagazineArticle(id, req.body || {});
    if (!article) {
      res.status(404).json({ error: 'مقاله پیدا نشد' });
      return;
    }
    res.json({ article });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

magazineAdminRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  if (!softDeleteMagazineArticle(id)) {
    res.status(404).json({ error: 'مقاله پیدا نشد' });
    return;
  }
  res.json({ ok: true });
});

magazineAdminRouter.post('/:id/publish', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const publishAt =
    typeof req.body?.publishAt === 'string' ? req.body.publishAt : new Date().toISOString();
  const article = setMagazineArticleStatus(id, 'published', publishAt);
  if (!article) {
    res.status(404).json({ error: 'مقاله پیدا نشد' });
    return;
  }
  res.json({ article });
});

magazineAdminRouter.post('/:id/unpublish', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const article = setMagazineArticleStatus(id, 'draft');
  if (!article) {
    res.status(404).json({ error: 'مقاله پیدا نشد' });
    return;
  }
  res.json({ article });
});

magazineAdminRouter.post('/:id/status', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const status = String(req.body?.status || '') as MagazineStatus;
  if (status !== 'draft' && status !== 'published' && status !== 'scheduled') {
    res.status(400).json({ error: 'وضعیت نامعتبر' });
    return;
  }
  const publishAt =
    typeof req.body?.publishAt === 'string' ? req.body.publishAt : undefined;
  const article = setMagazineArticleStatus(id, status, publishAt);
  if (!article) {
    res.status(404).json({ error: 'مقاله پیدا نشد' });
    return;
  }
  res.json({ article });
});
