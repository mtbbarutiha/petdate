import { Router } from 'express';
import { getPublicPlatformConfig } from '../runtime-settings';

export const platformRouter = Router();

/**
 * Public runtime config for site + bot.
 * No auth — only feature flags and active announcements (no secrets).
 */
platformRouter.get('/config', (_req, res) => {
  res.json({ ok: true, ...getPublicPlatformConfig() });
});
