/**
 * Admin homepage hero CMS — /api/admin/hero/*
 */
import { Router } from 'express';
import multer from 'multer';
import { requirePermission } from '../admin-auth';
import {
  getResolvedHeroSlide,
  heroRoleLabelsFa,
  listResolvedHeroSlides,
  resetCustomHeroSlide,
  setCustomHeroSlide,
} from '../services/hero-slides';
import {
  HERO_ROLES,
  MAX_HERO_UPLOAD_BYTES,
  isHeroRole,
  processAndSaveHeroSlide,
} from '../services/hero-slide-store';

export const heroAdminRouter = Router();

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_HERO_UPLOAD_BYTES },
});

heroAdminRouter.use(requirePermission('content.write'));

heroAdminRouter.get('/', (_req, res) => {
  res.json({
    slides: listResolvedHeroSlides(),
    roles: HERO_ROLES,
    labels: heroRoleLabelsFa(),
    cropNote:
      'عکس به‌صورت خودکار برش ۱۶:۹ از بالای کادر می‌شود تا با هیرو هدر (پوشش کامل از بالا) یکی باشد.',
  });
});

heroAdminRouter.post('/:role/upload', (req, res) => {
  const role = String(req.params.role || '');
  if (!isHeroRole(role)) {
    res.status(400).json({ error: 'نقش اسلاید نامعتبر است' });
    return;
  }

  imageUpload.single('file')(req, res, (uploadErr) => {
    void (async () => {
      if (uploadErr) {
        const tooLarge =
          uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE';
        res.status(tooLarge ? 413 : 400).json({
          error: tooLarge
            ? 'حجم تصویر بیش از حد مجاز است (حداکثر ۱۲ مگابایت)'
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
        const assets = await processAndSaveHeroSlide({
          role,
          originalName: file.originalname || 'hero.jpg',
          mimeType: file.mimetype,
          buffer: file.buffer,
        });
        const slide = setCustomHeroSlide(role, assets);
        res.status(201).json({ ok: true, slide });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'FILE_TOO_LARGE') {
          res.status(413).json({ error: 'حجم تصویر بیش از حد مجاز است (حداکثر ۱۲ مگابایت)' });
          return;
        }
        if (msg === 'INVALID_MIME') {
          res.status(400).json({ error: 'فقط عکس (JPG، PNG، WebP، HEIC) مجاز است' });
          return;
        }
        if (msg === 'INVALID_IMAGE') {
          res.status(400).json({ error: 'فایل تصویر معتبر نیست یا خوانده نشد' });
          return;
        }
        console.warn('hero slide upload failed:', msg);
        res.status(500).json({ error: 'ذخیره و ریسایز تصویر ناموفق بود' });
      }
    })();
  });
});

heroAdminRouter.post('/:role/reset', (req, res) => {
  const role = String(req.params.role || '');
  if (!isHeroRole(role)) {
    res.status(400).json({ error: 'نقش اسلاید نامعتبر است' });
    return;
  }
  const slide = resetCustomHeroSlide(role);
  res.json({ ok: true, slide });
});

heroAdminRouter.get('/:role', (req, res) => {
  const role = String(req.params.role || '');
  if (!isHeroRole(role)) {
    res.status(400).json({ error: 'نقش اسلاید نامعتبر است' });
    return;
  }
  res.json({ slide: getResolvedHeroSlide(role) });
});
