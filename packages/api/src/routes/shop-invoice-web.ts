/**
 * Public shop invoice PDF downloads (SMS links on pdf.petdate.ir/inv/{token}.pdf).
 */
import fs from 'fs';
import { Router } from 'express';
import {
  findShopOrderIdByInvoiceToken,
  getShopOrderInvoiceMeta,
} from '../services/shop-invoice-pdf';
import { adminPlatform } from '../admin-platform';
import { ensureShopInvoicePdf } from '../services/shop-invoice-pdf';

export const shopInvoiceWebRouter = Router();

function sendInvoicePdfByToken(res: import('express').Response, token: string): void {
  const orderId = findShopOrderIdByInvoiceToken(token);
  if (orderId == null) {
    res.status(404).type('text').send('invoice not found');
    return;
  }
  const meta = getShopOrderInvoiceMeta(orderId);
  if (!meta?.pdfPath || !fs.existsSync(meta.pdfPath)) {
    const order = adminPlatform.getShopOrder(orderId);
    if (!order) {
      res.status(404).type('text').send('invoice not found');
      return;
    }
    void ensureShopInvoicePdf(order)
      .then((fresh) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="petdate-invoice-${orderId}.pdf"`
        );
        res.setHeader('Cache-Control', 'private, max-age=300');
        fs.createReadStream(fresh.pdfPath).pipe(res);
      })
      .catch(() => {
        res.status(500).type('text').send('invoice generate failed');
      });
    return;
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="petdate-invoice-${orderId}.pdf"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  fs.createReadStream(meta.pdfPath).pipe(res);
}

shopInvoiceWebRouter.get(/^\/([a-f0-9]{16,})\.pdf$/i, (req, res) => {
  sendInvoicePdfByToken(res, String(req.params[0] || ''));
});
