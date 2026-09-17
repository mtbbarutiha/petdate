/**
 * Public homepage hero API — /api/hero/*
 */
import fs from 'fs';
import { Router } from 'express';
import { getHeroSlidesCachedSync } from '../services/hero-public-cache';
import { mimeFromHeroImageKey, resolveHeroImagePath } from '../services/hero-slide-store';

export const heroRouter = Router();

heroRouter.get('/', (_req, res) => {
  // Cacheable: nginx must not override with no-store (see location = /api/hero).
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.setHeader('Vary', 'Accept-Encoding');
  res.json({ slides: getHeroSlidesCachedSync() });
});

heroRouter.get('/images/:day/:filename', (req, res) => {
  const day = String(req.params.day || '');
  const filename = String(req.params.filename || '');
  const storageKey = `${day}/${filename}`;
  const abs = resolveHeroImagePath(storageKey);
  if (!abs || !fs.existsSync(abs)) {
    res.status(404).json({ error: 'تصویر پیدا نشد' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.type(mimeFromHeroImageKey(storageKey));
  fs.createReadStream(abs).pipe(res);
});
