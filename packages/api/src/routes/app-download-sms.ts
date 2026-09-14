/**
 * Public app-download SMS — POST /api/app-download-sms
 */
import { Router } from 'express';
import { rateLimit } from '../middleware/rate-limit';
import { sendAppDownloadSms } from '../services/app-download-sms';

export const appDownloadSmsRouter = Router();

const sendLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyFn: (req) => String(req.body?.mobile ?? req.ip ?? '').trim().toLowerCase(),
  message: 'درخواست پیامک زیاد شده. کمی بعد دوباره تلاش کن.',
});

appDownloadSmsRouter.post('/', sendLimit, async (req, res) => {
  const mobile = typeof req.body?.mobile === 'string' ? req.body.mobile : '';
  const result = await sendAppDownloadSms(mobile);
  if (!result.ok) {
    res.status(400).json({ ok: false, error: result.error });
    return;
  }
  if (result.sent) {
    res.json({
      ok: true,
      sent: true,
      phone: result.phone,
      message: 'لینک دانلود با پیامک برات ارسال شد.',
    });
    return;
  }
  res.json({
    ok: true,
    sent: false,
    fallback: true,
    phone: result.phone,
    smsBody: result.body,
    message: 'برنامه پیامک باز می‌شود تا لینک را خودت بفرستی.',
  });
});
