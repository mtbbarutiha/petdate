import { Router } from 'express';
import {
  fetchTelegramFileBytes,
  looksLikeTelegramFileId,
  sniffTelegramMediaContentType,
} from '../services/telegram-media';
import { trySendCachedWebpBuffer } from '../services/image-cache';

export const mediaRouter = Router();

/**
 * Proxy a Telegram Bot API file_id as media bytes (avatars / KYC selfie or video).
 * Prefer materializing pet photos via GET /api/pets/:id/image when a pet id exists.
 * Still images are converted to cached WebP.
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

  if (contentType.startsWith('image/') && contentType !== 'image/svg+xml') {
    if (
      await trySendCachedWebpBuffer(res, bytes.buffer, `tgmedia:${fileId.slice(0, 64)}`, {
        maxEdge: 1600,
      })
    ) {
      return;
    }
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(bytes.buffer);
});
