/**
 * Public pet-purchase consultation request — POST /api/pet-purchase-leads
 */
import { Router } from 'express';
import { rateLimit } from '../middleware/rate-limit';
import { submitPetPurchaseLead } from '../pet-purchase-leads';

export const petPurchaseLeadsRouter = Router();

const submitLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyFn: (req) => String(req.body?.mobile ?? req.ip ?? '').trim().toLowerCase(),
  message: 'درخواست زیاد شده. کمی بعد دوباره تلاش کن.',
});

petPurchaseLeadsRouter.post('/', submitLimit, (req, res) => {
  try {
    const lead = submitPetPurchaseLead({
      firstName: typeof req.body?.firstName === 'string' ? req.body.firstName : '',
      lastName: typeof req.body?.lastName === 'string' ? req.body.lastName : '',
      mobile: typeof req.body?.mobile === 'string' ? req.body.mobile : '',
      sourcePage: typeof req.body?.sourcePage === 'string' ? req.body.sourcePage : undefined,
    });
    res.status(201).json({
      ok: true,
      id: lead.id,
      publicId: lead.publicId,
      message: 'درخواست ثبت شد — مشاور پت‌دیت به‌زودی با شما تماس می‌گیرد.',
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
