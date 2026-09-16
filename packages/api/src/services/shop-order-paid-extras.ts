/**
 * On paid shop order: generate invoice PDF, SMS download link, admin notif, sales lead.
 */
import { formatIranMobileDisplay, normalizeIranMobile, orderPublicIdOf } from '@petdate/shared';
import type { ShopOrderRow } from '../admin-platform';
import { dbService, getDb } from '../db';
import { pushAdminHeaderNotification } from '../admin-notifications';
import { ensureSalesSchema } from '../sales-service';
import { candooSendWithSrcFallback, isCandooConfigured } from './candoo';
import {
  buildShopInvoiceSmsBody,
  ensureShopInvoicePdf,
} from './shop-invoice-pdf';

function nowIso(): string {
  return new Date().toISOString();
}

function splitName(full: string): { first: string; last: string } {
  const parts = String(full || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { first: 'مشتری', last: 'فروشگاه' };
  if (parts.length === 1) return { first: parts[0], last: 'فروشگاه' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function firstShopItemTitle(items: unknown[]): string {
  const first = Array.isArray(items) ? items[0] : null;
  if (first && typeof first === 'object') {
    const rec = first as { title?: unknown; name?: unknown };
    const title = String(rec.title || rec.name || '').trim();
    if (title) return title;
  }
  return 'خرید فروشگاه';
}

function createShopSaleLead(order: ShopOrderRow): number | null {
  try {
    ensureSalesSchema();
    const mobileRaw = String(order.customerPhone || '').trim();
    const normalized = normalizeIranMobile(mobileRaw);
    if (!normalized) return null;
    const mobile = formatIranMobileDisplay(normalized);
    const { first, last } = splitName(order.customerName || '');
    const product = firstShopItemTitle(order.items);
    const value = Math.floor(Number(order.totalToman) || 0);
    const publicId = orderPublicIdOf(order);
    const db = getDb();
    const dup = db
      .prepare(
        `SELECT id FROM sales_items
         WHERE kind = 'lead' AND source = 'فروشگاه' AND mobile = ?
           AND product = ? AND ABS(value - ?) < 1
           AND datetime(created_at) > datetime('now', '-2 days')
         ORDER BY id DESC LIMIT 1`
      )
      .get(mobile, product, value) as { id?: number } | undefined;
    if (dup?.id) return Number(dup.id);

    const info = db
      .prepare(
        `INSERT INTO sales_items (
          kind, first_name, last_name, mobile, email, product, source, score,
          owner_id, owner_name, stage, value, discount, created_at, last_activity, customer_id, pay_status
        ) VALUES ('lead', ?, ?, ?, NULL, ?, 'فروشگاه', 80, NULL, NULL, '0', ?, 0, ?, ?, NULL, 'پرداخت‌شده')`
      )
      .run(first, last, mobile, product, value, nowIso(), nowIso());
    const id = Number(info.lastInsertRowid);
    db.prepare('INSERT INTO sales_activities (item_id, at, text, kind) VALUES (?, ?, ?, ?)').run(
      id,
      nowIso(),
      `لید خودکار از فروش فروشگاه ${publicId} (سفارش #${order.id})`,
      'sys'
    );
    return id;
  } catch (err) {
    console.warn('shop sale lead skipped:', (err as Error).message);
    return null;
  }
}

function notifyShopSale(order: ShopOrderRow, salesLeadId: number | null): void {
  const publicId = orderPublicIdOf(order);
  const product = firstShopItemTitle(order.items);
  try {
    pushAdminHeaderNotification({
      title: `فروش فروشگاه ${publicId}`,
      body: `${order.customerName || 'مشتری'} · ${product} · ${Math.floor(order.totalToman).toLocaleString('fa-IR')} تومان`,
      kind: 'success',
      href: '/admin/shop/orders',
      module: 'shop',
      permission: 'shop.read',
      sourceKey: `shop-paid:${order.id}`,
    });
  } catch (err) {
    console.warn('shop sale shop-notif skipped:', (err as Error).message);
  }
  try {
    pushAdminHeaderNotification({
      title: `فروش فروشگاه ${publicId}`,
      body: `${order.customerName || 'مشتری'} · ${product} · صف لیدها`,
      kind: 'success',
      href: salesLeadId ? `/admin/sales/leads/${salesLeadId}` : '/admin/sales/leads',
      module: 'sales',
      permission: 'sales.read',
      sourceKey: `shop-sale-lead:${order.id}`,
    });
  } catch (err) {
    console.warn('shop sale sales-notif skipped:', (err as Error).message);
  }
}

async function sendInvoiceSms(order: ShopOrderRow, pdfUrl: string): Promise<void> {
  if (!isCandooConfigured()) {
    console.warn(`[shop-invoice] SMS skipped: Candoo not configured (order=${order.id})`);
    return;
  }
  let phone = String(order.customerPhone || '').trim();
  if (!phone && order.userId) {
    const user = dbService.getUserById(order.userId);
    phone = String(user?.phone || '').trim();
  }
  const normalized = normalizeIranMobile(phone);
  if (!normalized) {
    console.warn(`[shop-invoice] SMS skipped: no phone (order=${order.id})`);
    return;
  }
  const display = formatIranMobileDisplay(normalized);
  const body = buildShopInvoiceSmsBody({
    publicId: orderPublicIdOf(order),
    pdfUrl,
  });
  try {
    await candooSendWithSrcFallback({
      recipient: display,
      body,
      type: 0,
    });
    console.log(`[shop-invoice] SMS sent order=${order.id} to=${display.slice(0, 4)}***`);
  } catch (err) {
    console.warn('[shop-invoice] SMS failed:', (err as Error).message);
  }
}

/** Fire-and-forget side effects after a shop order becomes paid. */
export function deliverPaidShopOrderExtras(order: ShopOrderRow): void {
  queueMicrotask(() => {
    void (async () => {
      try {
        const salesLeadId = createShopSaleLead(order);
        notifyShopSale(order, salesLeadId);
        const pdf = await ensureShopInvoicePdf(order);
        await sendInvoiceSms(order, pdf.pdfUrl);
      } catch (err) {
        console.warn('paid shop order extras failed:', (err as Error).message);
      }
    })();
  });
}
