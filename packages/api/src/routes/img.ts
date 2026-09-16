import { Router } from 'express';
import { rateLimit } from '../middleware/rate-limit';
import {
  getOrCreateCachedWebp,
  IMAGE_CACHE_CONTROL,
  normalizeImageSrcPath,
  resolveImageSourcePath,
} from '../services/image-cache';

export const imgRouter = Router();

const imgLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  message: 'تعداد درخواست تصویر زیاد است.',
});

function parsePositiveInt(raw: unknown, fallback: number): number {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n);
}

/**
 * On-demand WebP (or GIF passthrough) for allowlisted public/API image paths.
 * Example: GET /api/img?src=/pepito/uploads/foo.jpg&w=800
 */
imgRouter.get('/', imgLimit, async (req, res) => {
  try {
    const srcRaw =
      typeof req.query.src === 'string'
        ? req.query.src
        : typeof req.query.u === 'string'
          ? req.query.u
          : '';
    const srcPath = normalizeImageSrcPath(srcRaw);
    if (!srcPath) {
      res.status(400).json({ error: 'مسیر تصویر نامعتبر است' });
      return;
    }

    const abs = resolveImageSourcePath(srcPath);
    if (!abs) {
      res.status(404).json({ error: 'تصویر پیدا نشد' });
      return;
    }

    const w = parsePositiveInt(req.query.w ?? req.query.width, 0);
    const q = parsePositiveInt(req.query.q ?? req.query.quality, 0);
    const result = await getOrCreateCachedWebp(abs, {
      maxEdge: w > 0 ? w : undefined,
      quality: q > 0 ? q : undefined,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', IMAGE_CACHE_CONTROL);
    res.setHeader('X-PetDate-Img-Cache', result.fromCache ? 'HIT' : 'MISS');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(result.buffer);
  } catch (err) {
    const msg = (err as Error).message || 'img_error';
    if (msg === 'SOURCE_TOO_LARGE') {
      res.status(413).json({ error: 'فایل تصویر خیلی بزرگ است' });
      return;
    }
    console.warn('img cache failed:', msg);
    res.status(500).json({ error: 'تبدیل تصویر ناموفق بود' });
  }
});
