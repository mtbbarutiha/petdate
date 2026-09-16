/**
 * Shop purchase invoice PDF (PD-O) — pdfkit + Vazirmatn, same RTL approach as prescriptions.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { BRAND, SITE, orderPublicIdOf } from '@petdate/shared';
import type { ShopOrderRow } from '../admin-platform';
import { getDb } from '../db';
import { toAsciiDigits } from './prescription-pdf';
import { publicPdfOrigin } from './prescription-html';

const INK = '#1e293b';
const MUTED = '#64748b';
const RULE = '#e2e8f0';
const PAPER = '#ffffff';

export type ShopInvoicePdfItem = {
  title: string;
  qty: number;
  unitPriceToman: number;
  lineTotalToman: number;
};

function resolveFont(fileName: string): string | null {
  const candidates = [
    path.join(__dirname, '..', 'assets', 'fonts', fileName),
    path.join(__dirname, '..', '..', 'assets', 'fonts', fileName),
    path.join(process.cwd(), 'assets', 'fonts', fileName),
    path.join(process.cwd(), 'packages', 'api', 'assets', 'fonts', fileName),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function fontPaths(): { regular: string; bold: string } {
  const regular = resolveFont('Vazirmatn-Regular.ttf');
  if (!regular) {
    throw new Error('فونت Vazirmatn پیدا نشد — packages/api/assets/fonts/Vazirmatn-Regular.ttf');
  }
  const bold = resolveFont('Vazirmatn-Bold.ttf') || regular;
  return { regular, bold };
}

function hasArabicScript(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/** Reverse token order for multi-word RTL lines (pdfkit/fontkit). */
function rtlLine(text: string): string {
  const raw = toAsciiDigits(String(text ?? '').trim());
  if (!raw || !hasArabicScript(raw)) return raw;
  return raw.split(/\s+/).reverse().join(' ');
}

function paint(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  opts: {
    width?: number;
    align?: 'left' | 'center' | 'right';
    size: number;
    color: string;
    bold?: boolean;
  }
): void {
  doc.font(opts.bold ? 'VazirBold' : 'Vazir').fontSize(opts.size).fillColor(opts.color);
  doc.text(rtlLine(text), x, y, {
    width: opts.width,
    align: opts.align ?? 'right',
    lineBreak: false,
    continued: false,
  });
}

function formatTomanFa(n: number): string {
  return `${Math.floor(Number(n) || 0).toLocaleString('en-US')} تومان`;
}

function normalizeItems(items: unknown[]): ShopInvoicePdfItem[] {
  return (Array.isArray(items) ? items : []).map((raw) => {
    const it = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const qty = Math.max(1, Math.floor(Number(it.qty ?? it.quantity) || 1));
    const unitPriceToman = Math.max(
      0,
      Math.floor(Number(it.unitPriceToman ?? it.priceToman ?? it.unitPrice) || 0)
    );
    const lineTotalToman = Math.max(
      0,
      Math.floor(Number(it.lineTotalToman ?? it.lineTotal) || unitPriceToman * qty)
    );
    return {
      title: String(it.title || it.name || it.productId || 'کالا').trim() || 'کالا',
      qty,
      unitPriceToman,
      lineTotalToman,
    };
  });
}

function payLabel(order: ShopOrderRow): string {
  const cur = order.paymentCurrency || 'toman';
  const amt = Number(order.paymentAmount ?? order.totalToman) || 0;
  if (cur === 'stars_xtr') return `${amt.toLocaleString('en-US')} Stars`;
  if (cur === 'stars') return `${amt.toLocaleString('en-US')} ستاره`;
  if (cur === 'coins') return `${amt.toLocaleString('en-US')} سکه`;
  return formatTomanFa(order.totalToman);
}

export function shopInvoicesDir(): string {
  const dir = path.join(__dirname, '..', '..', 'data', 'shop-invoices');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function shopInvoicePdfPublicPath(token: string): string {
  return `/inv/${encodeURIComponent(token)}.pdf`;
}

export function shopInvoicePdfPublicUrl(token: string): string {
  return `${publicPdfOrigin()}${shopInvoicePdfPublicPath(token)}`;
}

export function buildShopInvoiceSmsBody(opts: {
  publicId: string;
  pdfUrl: string;
}): string {
  const parts = [
    'پت‌دیت — فاکتور خرید',
    `شماره فاکتور: ${opts.publicId}`,
    'دانلود PDF:',
    opts.pdfUrl,
  ];
  let body = parts.join('\n');
  if (body.length > 880) body = body.slice(0, 877) + '...';
  return body;
}

export async function generateShopInvoicePdf(
  order: ShopOrderRow,
  outPath: string
): Promise<void> {
  const { regular, bold } = fontPaths();
  const publicId = orderPublicIdOf(order);
  const items = normalizeItems(order.items);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 48, bottom: 48, left: 40, right: 40 },
      info: {
        Title: `Invoice ${publicId}`,
        Author: BRAND.displayNameFa,
      },
    });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);
    doc.registerFont('Vazir', regular);
    doc.registerFont('VazirBold', bold);

    const pageW = doc.page.width;
    const right = pageW - 40;
    const left = 40;
    const contentW = right - left;
    let y = 48;

    doc.rect(0, 0, pageW, doc.page.height).fill(PAPER);

    paint(doc, 'فاکتور فروشگاه', left, y, {
      width: contentW,
      align: 'right',
      size: 18,
      color: INK,
      bold: true,
    });
    y += 28;
    paint(doc, `${BRAND.displayNameFa} — پت‌شاپ`, left, y, {
      width: contentW,
      align: 'right',
      size: 12,
      color: MUTED,
    });
    y += 22;
    paint(doc, publicId, left, y, {
      width: contentW,
      align: 'left',
      size: 14,
      color: INK,
      bold: true,
    });
    y += 20;
    paint(doc, SITE.domain, left, y, {
      width: contentW,
      align: 'left',
      size: 10,
      color: MUTED,
    });
    y += 18;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(RULE).lineWidth(1).stroke();
    y += 16;

    paint(doc, `خریدار: ${order.customerName?.trim() || '—'}`, left, y, {
      width: contentW,
      align: 'right',
      size: 11,
      color: INK,
    });
    y += 16;
    if (order.customerPhone) {
      paint(doc, `موبایل: ${order.customerPhone}`, left, y, {
        width: contentW,
        align: 'right',
        size: 11,
        color: INK,
      });
      y += 16;
    }
    paint(doc, `وضعیت: ${order.status}`, left, y, {
      width: contentW,
      align: 'right',
      size: 11,
      color: INK,
    });
    y += 22;

    paint(doc, 'کالا', left + contentW * 0.45, y, {
      width: contentW * 0.55,
      align: 'right',
      size: 10,
      color: MUTED,
      bold: true,
    });
    paint(doc, 'تعداد', left + contentW * 0.28, y, {
      width: contentW * 0.15,
      align: 'center',
      size: 10,
      color: MUTED,
      bold: true,
    });
    paint(doc, 'جمع', left, y, {
      width: contentW * 0.26,
      align: 'left',
      size: 10,
      color: MUTED,
      bold: true,
    });
    y += 14;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(RULE).stroke();
    y += 10;

    for (const it of items) {
      paint(doc, it.title, left + contentW * 0.45, y, {
        width: contentW * 0.55,
        align: 'right',
        size: 10,
        color: INK,
      });
      paint(doc, String(it.qty), left + contentW * 0.28, y, {
        width: contentW * 0.15,
        align: 'center',
        size: 10,
        color: INK,
      });
      paint(doc, formatTomanFa(it.lineTotalToman), left, y, {
        width: contentW * 0.26,
        align: 'left',
        size: 10,
        color: INK,
      });
      y += 18;
      if (y > doc.page.height - 120) {
        doc.addPage();
        y = 48;
      }
    }

    y += 8;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(RULE).stroke();
    y += 14;
    paint(doc, `جمع کل: ${formatTomanFa(order.totalToman)}`, left, y, {
      width: contentW,
      align: 'right',
      size: 12,
      color: INK,
      bold: true,
    });
    y += 18;
    paint(doc, `پرداخت: ${payLabel(order)}`, left, y, {
      width: contentW,
      align: 'right',
      size: 11,
      color: MUTED,
    });
    y += 24;
    paint(doc, 'شماره سفارش با پیشوند PD-O است.', left, y, {
      width: contentW,
      align: 'right',
      size: 9,
      color: MUTED,
    });

    doc.end();
    stream.on('finish', () => resolve());
    stream.on('error', reject);
    doc.on('error', reject);
  });
}

export function persistShopInvoicePdfMeta(
  orderId: number,
  pdfPath: string,
  token: string
): void {
  getDb()
    .prepare(
      `UPDATE shop_orders
       SET invoice_pdf_path = ?, invoice_pdf_token = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(pdfPath, token, orderId);
}

export function getShopOrderInvoiceMeta(orderId: number): {
  pdfPath: string | null;
  token: string | null;
} | null {
  const row = getDb()
    .prepare(`SELECT invoice_pdf_path, invoice_pdf_token FROM shop_orders WHERE id = ?`)
    .get(orderId) as { invoice_pdf_path?: string; invoice_pdf_token?: string } | undefined;
  if (!row) return null;
  return {
    pdfPath: row.invoice_pdf_path ? String(row.invoice_pdf_path) : null,
    token: row.invoice_pdf_token ? String(row.invoice_pdf_token) : null,
  };
}

export function findShopOrderIdByInvoiceToken(token: string): number | null {
  const t = String(token || '').trim();
  if (!t || t.length < 16) return null;
  const row = getDb()
    .prepare(`SELECT id FROM shop_orders WHERE invoice_pdf_token = ? LIMIT 1`)
    .get(t) as { id?: number } | undefined;
  const id = Number(row?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function ensureShopInvoicePdf(order: ShopOrderRow): Promise<{
  pdfPath: string;
  token: string;
  pdfUrl: string;
  created: boolean;
}> {
  const existing = getShopOrderInvoiceMeta(order.id);
  if (existing?.pdfPath && existing.token && fs.existsSync(existing.pdfPath)) {
    return {
      pdfPath: existing.pdfPath,
      token: existing.token,
      pdfUrl: shopInvoicePdfPublicUrl(existing.token),
      created: false,
    };
  }
  const token =
    existing?.token && existing.token.length >= 16
      ? existing.token
      : crypto.randomBytes(24).toString('hex');
  const fileName = `inv-${order.id}-${token.slice(0, 8)}.pdf`;
  const pdfPath = path.join(shopInvoicesDir(), fileName);
  await generateShopInvoicePdf(order, pdfPath);
  persistShopInvoicePdfMeta(order.id, pdfPath, token);
  return {
    pdfPath,
    token,
    pdfUrl: shopInvoicePdfPublicUrl(token),
    created: true,
  };
}
