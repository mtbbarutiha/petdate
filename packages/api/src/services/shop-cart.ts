/**
 * Shared shop cart — single source of truth for web + Telegram bot.
 *
 * Merge rule on login / guest sync:
 *   merge-then-persist — sum quantities for the same productId, then write server.
 *   Guest localStorage is a draft until auth; after merge it mirrors the server cart.
 *
 * Live-SKU DELETE guard:
 *   Stale SPA tabs (pre-#440 ghost-prune) still call DELETE for any cart line
 *   `getProduct()` cannot resolve — often from /chats — wiping items that just
 *   POSTed successfully. Deleting an in-catalog / live SKU requires explicit
 *   user intent (`userIntent: true`). Missing/retired demo ids may still be
 *   cleaned without intent.
 */
import { getDb } from '../db';
import { adminPlatform } from '../admin-platform';
import { isLiveShopProductIdOrSlug } from '../data/shop-zero-margin-slugs';

/** Header / body value clients send for intentional remove (not ghost-prune). */
export const SHOP_CART_USER_REMOVE_INTENT = 'user-remove' as const;

export type ShopCartLine = { productId: string; qty: number };

export type ShopCartLineView = ShopCartLine & {
  title?: string;
  slug?: string;
  priceToman?: number;
  image?: string;
  inStock?: boolean;
};

const MAX_QTY = 99;

export function normalizeCartLines(raw: unknown): ShopCartLine[] {
  if (!Array.isArray(raw)) return [];
  const map = new Map<string, number>();
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const productId = String((it as { productId?: unknown }).productId ?? '').trim();
    const qty = Math.floor(Number((it as { qty?: unknown }).qty ?? 0));
    if (!productId || qty <= 0) continue;
    map.set(productId, Math.min(MAX_QTY, (map.get(productId) ?? 0) + qty));
  }
  return [...map.entries()].map(([productId, qty]) => ({ productId, qty }));
}

/** Sum quantities for matching productIds (guest ∪ server). */
export function mergeCartLines(
  server: ShopCartLine[],
  guest: ShopCartLine[]
): ShopCartLine[] {
  const map = new Map<string, number>();
  for (const line of [...normalizeCartLines(server), ...normalizeCartLines(guest)]) {
    map.set(line.productId, Math.min(MAX_QTY, (map.get(line.productId) ?? 0) + line.qty));
  }
  return [...map.entries()].map(([productId, qty]) => ({ productId, qty }));
}

export function cartItemCount(lines: ShopCartLine[]): number {
  return normalizeCartLines(lines).reduce((s, l) => s + l.qty, 0);
}

function ensureShopCartTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop_carts (
      user_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, product_id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_shop_carts_user ON shop_carts (user_id)`);
}

let tableReady = false;
function withTable(): ReturnType<typeof getDb> {
  if (!tableReady) {
    ensureShopCartTable();
    tableReady = true;
  }
  return getDb();
}

/** Drop lines whose product no longer exists in catalog (keeps badge aligned with UI). */
export function pruneMissingProducts(lines: ShopCartLine[]): ShopCartLine[] {
  return normalizeCartLines(lines).filter((l) => Boolean(adminPlatform.getShopProduct(l.productId)));
}

export function getShopCartLines(userId: number): ShopCartLine[] {
  const db = withTable();
  const rows = db
    .prepare(
      `SELECT product_id, qty FROM shop_carts WHERE user_id = ? ORDER BY updated_at DESC, product_id ASC`
    )
    .all(userId) as Array<{ product_id: string; qty: number }>;
  return pruneMissingProducts(
    rows.map((r) => ({ productId: String(r.product_id), qty: Number(r.qty) || 0 }))
  );
}

export function enrichCartLines(lines: ShopCartLine[]): ShopCartLineView[] {
  return pruneMissingProducts(lines).map((l) => {
    const p = adminPlatform.getShopProduct(l.productId);
    return {
      productId: l.productId,
      qty: l.qty,
      title: p?.title,
      slug: p?.slug,
      priceToman: p?.priceToman,
      image: p?.image,
      inStock: p?.inStock,
    };
  });
}

export function replaceShopCart(userId: number, lines: ShopCartLine[]): ShopCartLine[] {
  const db = withTable();
  const next = pruneMissingProducts(lines);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM shop_carts WHERE user_id = ?').run(userId);
    const ins = db.prepare(
      `INSERT INTO shop_carts (user_id, product_id, qty, updated_at)
       VALUES (?, ?, ?, datetime('now'))`
    );
    for (const line of next) {
      ins.run(userId, line.productId, line.qty);
    }
  });
  tx();
  return getShopCartLines(userId);
}

export function clearShopCart(userId: number): void {
  withTable().prepare('DELETE FROM shop_carts WHERE user_id = ?').run(userId);
}

export function setShopCartLine(
  userId: number,
  productId: string,
  qtyRaw: number
): { ok: true; lines: ShopCartLine[] } | { ok: false; reason: 'bad_product' | 'missing'; error: string } {
  const id = String(productId || '').trim();
  if (!id) {
    return { ok: false, reason: 'bad_product', error: 'شناسه محصول نامعتبر است.' };
  }
  const product = adminPlatform.getShopProduct(id);
  if (!product) {
    return { ok: false, reason: 'missing', error: 'محصول پیدا نشد.' };
  }
  const qty = Math.floor(Number(qtyRaw) || 0);
  const db = withTable();
  if (qty <= 0) {
    db.prepare('DELETE FROM shop_carts WHERE user_id = ? AND product_id = ?').run(userId, product.id);
  } else {
    db.prepare(
      `INSERT INTO shop_carts (user_id, product_id, qty, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, product_id) DO UPDATE SET
         qty = excluded.qty,
         updated_at = datetime('now')`
    ).run(userId, product.id, Math.min(MAX_QTY, qty));
  }
  return { ok: true, lines: getShopCartLines(userId) };
}

export function addShopCartLine(
  userId: number,
  productId: string,
  qtyRaw = 1
): { ok: true; lines: ShopCartLine[] } | { ok: false; reason: 'bad_product' | 'missing' | 'out_of_stock'; error: string } {
  const id = String(productId || '').trim();
  const product = adminPlatform.getShopProduct(id);
  if (!product) {
    return { ok: false, reason: 'missing', error: 'محصول پیدا نشد.' };
  }
  if (!product.inStock) {
    return { ok: false, reason: 'out_of_stock', error: 'محصول ناموجود است.' };
  }
  const add = Math.max(1, Math.min(MAX_QTY, Math.floor(Number(qtyRaw) || 1)));
  const existing = getShopCartLines(userId).find((l) => l.productId === product.id);
  const nextQty = Math.min(MAX_QTY, (existing?.qty ?? 0) + add);
  return setShopCartLine(userId, product.id, nextQty);
}

/**
 * Remove one cart line.
 * Without `userIntent`, refuse to delete products that still exist in the live
 * catalog (or known live id/slug list) — neutralizes stale ghost-prune clients.
 */
export function removeShopCartLine(
  userId: number,
  productId: string,
  opts?: { userIntent?: boolean }
): ShopCartLine[] {
  const id = String(productId || '').trim();
  if (!id) return getShopCartLines(userId);

  if (!opts?.userIntent) {
    const inCatalog = Boolean(adminPlatform.getShopProduct(id));
    if (inCatalog || isLiveShopProductIdOrSlug(id)) {
      return getShopCartLines(userId);
    }
  }

  withTable()
    .prepare('DELETE FROM shop_carts WHERE user_id = ? AND product_id = ?')
    .run(userId, id);
  return getShopCartLines(userId);
}

/** True when request carries explicit user-remove intent (header or JSON body). */
export function requestHasShopCartUserRemoveIntent(req: {
  headers?: Record<string, unknown> | { get?: (name: string) => string | null | undefined };
  body?: unknown;
}): boolean {
  const headers = req.headers;
  let headerVal = '';
  if (headers && typeof (headers as { get?: unknown }).get === 'function') {
    headerVal = String(
      (headers as { get: (name: string) => string | null | undefined }).get('x-petdate-cart-intent') ??
        ''
    );
  } else if (headers && typeof headers === 'object') {
    const raw = (headers as Record<string, unknown>)['x-petdate-cart-intent'];
    headerVal = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '');
  }
  if (headerVal.trim().toLowerCase() === SHOP_CART_USER_REMOVE_INTENT) return true;

  const body = req.body;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const intent = String((body as { intent?: unknown }).intent ?? '').trim().toLowerCase();
    if (intent === SHOP_CART_USER_REMOVE_INTENT) return true;
  }
  return false;
}

/**
 * Merge guest (or bot session) lines into the server cart, persist, return enriched view.
 * Rule: merge-then-persist (sum qtys).
 */
export function mergeAndPersistShopCart(
  userId: number,
  guestLines: ShopCartLine[]
): { lines: ShopCartLine[]; itemCount: number; merged: boolean } {
  const server = getShopCartLines(userId);
  const guest = pruneMissingProducts(guestLines);
  if (!guest.length) {
    return { lines: server, itemCount: cartItemCount(server), merged: false };
  }
  const merged = mergeCartLines(server, guest);
  const lines = replaceShopCart(userId, merged);
  return { lines, itemCount: cartItemCount(lines), merged: true };
}

export function publicCartPayload(userId: number) {
  const lines = getShopCartLines(userId);
  const views = enrichCartLines(lines);
  return {
    ok: true as const,
    lines: views,
    itemCount: cartItemCount(views),
    syncRule: 'merge-then-persist' as const,
  };
}
