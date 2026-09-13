/**
 * Public homepage hero API — /api/hero/*
 */
import fs from 'fs';
import { Router } from 'express';
import { listResolvedHeroSlides } from '../services/hero-slides';
import { mimeFromHeroImageKey, resolveHeroImagePath } from '../services/hero-slide-store';

export const heroRouter = Router();

heroRouter.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.json({ slides: listResolvedHeroSlides() });
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
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.type(mimeFromHeroImageKey(storageKey));
  fs.createReadStream(abs).pipe(res);
});
