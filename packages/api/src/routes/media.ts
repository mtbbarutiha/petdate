import { Router } from 'express';
import {
  fetchTelegramFileBytes,
  looksLikeTelegramFileId,
  sniffTelegramMediaContentType,
} from '../services/telegram-media';

export const mediaRouter = Router();

/**
 * Proxy a Telegram Bot API file_id as media bytes (avatars / KYC selfie or video).
 * Prefer materializing pet photos via GET /api/pets/:id/image when a pet id exists.
 */
mediaRouter.get('/telegram/:fileId', async (req, res) => {
  const fileId = decodeURIComponent(String(req.params.fileId || '').trim());
  if (!fileId || !looksLikeTelegramFileId(fileId)) {
    res.status(400).json({ error: 'file_id نامعتبر است' });
    return;
  }

  const bytes = await fetchTelegramFileBytes(fileId);
  if (!bytes) {
    res.status(404).json({ error: 'فایل تلگرام پیدا نشد' });
    return;
  }

  const contentType = sniffTelegramMediaContentType(
    bytes.buffer,
    bytes.contentType,
    fileId
  );

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(bytes.buffer);
});
