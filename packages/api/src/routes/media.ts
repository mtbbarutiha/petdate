import { Router } from 'express';
import {
  fetchTelegramFileBytes,
  looksLikeTelegramFileId,
} from '../services/telegram-media';

export const mediaRouter = Router();

/**
 * Proxy a Telegram Bot API file_id as image bytes (avatars / generic).
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

  let contentType = bytes.contentType || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    // Telegram sometimes returns application/octet-stream
    if (bytes.buffer[0] === 0xff && bytes.buffer[1] === 0xd8) contentType = 'image/jpeg';
    else if (bytes.buffer[0] === 0x89 && bytes.buffer[1] === 0x50) contentType = 'image/png';
    else if (bytes.buffer[0] === 0x52 && bytes.buffer[1] === 0x49) contentType = 'image/webp';
    else contentType = 'image/jpeg';
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(bytes.buffer);
});
