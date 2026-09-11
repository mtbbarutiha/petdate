import fs from 'fs';
import { Router } from 'express';
import { dbService } from '../db';
import { getUserFromBearer } from '../services/web-otp';
import {
  mimeFromPaymentReceiptKey,
  paymentReceiptStorageKeyFromUrl,
  resolvePaymentReceiptPath,
} from '../services/payment-receipt-store';

export const paymentsRouter = Router();

function isAdminRequest(req: { header: (name: string) => string | undefined }): boolean {
  const key = String(process.env.ADMIN_API_KEY || process.env.ADMIN_PASSWORD || '').trim();
  if (!key) return false;
  const provided =
    String(req.header('x-admin-key') || '').trim() ||
    String(req.header('authorization') || '')
      .replace(/^Bearer\s+/i, '')
      .trim();
  return Boolean(provided) && provided === key;
}

function orderReceiptAccessToken(order: { adminNote?: string }): string | null {
  const raw = String(order.adminNote || '').trim();
  if (!raw.startsWith('{')) return null;
  try {
    const meta = JSON.parse(raw) as { receiptToken?: unknown };
    const token = typeof meta.receiptToken === 'string' ? meta.receiptToken.trim() : '';
    return token || null;
  } catch {
    return null;
  }
}

paymentsRouter.get('/receipts/:orderId/:filename', (req, res) => {
  const orderId = Number(req.params.orderId);
  const filename = String(req.params.filename || '').trim();
  if (!Number.isFinite(orderId) || orderId <= 0 || !filename) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const storageKey = `${orderId}/${filename}`;
  const order = dbService.getPaymentOrder(orderId);
  if (!order) {
    res.status(404).json({ error: 'یافت نشد' });
    return;
  }

  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  const ownerOk = Boolean(session && session.user.id === order.userId);
  const adminOk = isAdminRequest(req);
  const receiptRef = order.receiptFileId || order.receiptUrl || '';
  const keyFromOrder = paymentReceiptStorageKeyFromUrl(receiptRef);
  const referer = String(req.header('referer') || '');
  const adminReferer = /\/admin(\/|$)/i.test(referer);
  /** Shop card-pay pages pass ?t=receiptToken so <img src> works without Bearer. */
  const queryToken = String(req.query.t ?? req.query.token ?? '').trim();
  const storedToken = orderReceiptAccessToken(order);
  const tokenOk = Boolean(queryToken && storedToken && queryToken === storedToken);

  if (!ownerOk && !adminOk && !tokenOk && !(adminReferer && keyFromOrder === storageKey)) {
    res.status(401).json({ error: 'دسترسی ندارید' });
    return;
  }
  if (keyFromOrder && keyFromOrder !== storageKey) {
    res.status(404).json({ error: 'فایل پیدا نشد' });
    return;
  }

  const abs = resolvePaymentReceiptPath(storageKey);
  if (!abs || !fs.existsSync(abs)) {
    res.status(404).json({ error: 'فایل پیدا نشد' });
    return;
  }
  res.setHeader('Content-Type', mimeFromPaymentReceiptKey(storageKey));
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(abs).pipe(res);
});
