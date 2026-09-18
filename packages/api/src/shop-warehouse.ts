/**
 * Supplier purchases → stock on hand and shop COGS.
 * Stock drops when an order is shipped or completed. Profit uses these unit costs.
 */
import { getDb } from './db';

export type SupplierPurchase = {
  id: number;
  productId: string;
  productTitle: string;
  qty: number;
  unitCostToman: number;
  supplier: string;
  purchasedAt: string;
  note: string;
  createdAt: string;
};

export type StockRow = {
  productId: string;
  productTitle: string;
  purchasedQty: number;
  soldQty: number;
  onHand: number;
  unitCostToman: number;
};

export type ShopProfitSummary = {
  revenueToman: number;
  cogsToman: number;
  profitToman: number;
  purchaseCount: number;
  purchaseSpendToman: number;
};

const SHIPPED = new Set(['shipped', 'completed']);
const REVENUE = new Set(['paid', 'shipping', 'shipped', 'completed']);

type Item = { productId?: string; title?: string; qty?: number; priceToman?: number };

function parseItems(json: string): Item[] {
  try {
    const parsed = JSON.parse(json || '[]');
    return Array.isArray(parsed) ? (parsed as Item[]) : [];
  } catch {
    return [];
  }
}

export function ensureShopWarehouseSchema(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS shop_supplier_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      product_title TEXT NOT NULL DEFAULT '',
      qty INTEGER NOT NULL,
      unit_cost_toman INTEGER NOT NULL,
      supplier TEXT NOT NULL DEFAULT '',
      purchased_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  getDb().exec(
    `CREATE INDEX IF NOT EXISTS idx_shop_purchases_product ON shop_supplier_purchases(product_id)`
  );
}

function mapPurchase(row: Record<string, unknown>): SupplierPurchase {
  return {
    id: Number(row.id),
    productId: String(row.product_id),
    productTitle: String(row.product_title || ''),
    qty: Number(row.qty || 0),
    unitCostToman: Number(row.unit_cost_toman || 0),
    supplier: String(row.supplier || ''),
    purchasedAt: String(row.purchased_at || ''),
    note: String(row.note || ''),
    createdAt: String(row.created_at || ''),
  };
}

export function purchaseUnitCostMap(): Map<string, number> {
  try {
    ensureShopWarehouseSchema();
    const rows = getDb()
      .prepare(
        `SELECT product_id,
                SUM(qty) AS qty,
                SUM(qty * unit_cost_toman) AS spend
         FROM shop_supplier_purchases
         GROUP BY product_id`
      )
      .all() as Array<{ product_id: string; qty: number; spend: number }>;
    const map = new Map<string, number>();
    for (const row of rows) {
      const qty = Number(row.qty) || 0;
      if (qty <= 0) continue;
      map.set(String(row.product_id), Math.round(Number(row.spend) / qty));
    }
    return map;
  } catch {
    return new Map();
  }
}

function refreshProductCost(productId: string): void {
  const unit = purchaseUnitCostMap().get(productId);
  if (unit == null) return;
  try {
    getDb().prepare(`UPDATE shop_products SET cost_toman = ? WHERE id = ?`).run(unit, productId);
  } catch {
    /* catalog row may be missing */
  }
}

export function listSupplierPurchases(limit = 200): SupplierPurchase[] {
  ensureShopWarehouseSchema();
  const rows = getDb()
    .prepare(
      `SELECT * FROM shop_supplier_purchases ORDER BY datetime(purchased_at) DESC, id DESC LIMIT ?`
    )
    .all(Math.min(500, Math.max(1, limit))) as Record<string, unknown>[];
  return rows.map(mapPurchase);
}

export function createSupplierPurchase(input: {
  productId: string;
  qty: number;
  unitCostToman: number;
  supplier: string;
  purchasedAt?: string;
  note?: string;
  productTitle?: string;
}): SupplierPurchase {
  ensureShopWarehouseSchema();
  const productId = String(input.productId || '').trim();
  const qty = Math.floor(Number(input.qty));
  const unit = Math.floor(Number(input.unitCostToman));
  const supplier = String(input.supplier || '').trim();
  if (!productId) throw new Error('محصول الزامی است');
  if (!Number.isFinite(qty) || qty < 1) throw new Error('تعداد نامعتبر است');
  if (!Number.isFinite(unit) || unit < 0) throw new Error('بهای واحد نامعتبر است');
  if (!supplier) throw new Error('نام تأمین‌کننده الزامی است');

  let title = String(input.productTitle || '').trim();
  if (!title) {
    const row = getDb().prepare(`SELECT title FROM shop_products WHERE id = ?`).get(productId) as
      | { title: string }
      | undefined;
    title = row?.title || productId;
  }
  const purchasedAt = String(input.purchasedAt || '').trim() || new Date().toISOString();
  const result = getDb()
    .prepare(
      `INSERT INTO shop_supplier_purchases
        (product_id, product_title, qty, unit_cost_toman, supplier, purchased_at, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(productId, title, qty, unit, supplier, purchasedAt, String(input.note || '').trim());
  refreshProductCost(productId);
  const row = getDb()
    .prepare(`SELECT * FROM shop_supplier_purchases WHERE id = ?`)
    .get(result.lastInsertRowid) as Record<string, unknown>;
  return mapPurchase(row);
}

function soldQtyByProduct(): Map<string, number> {
  const map = new Map<string, number>();
  const rows = getDb()
    .prepare(`SELECT status, items_json FROM shop_orders`)
    .all() as Array<{ status: string; items_json: string }>;
  for (const row of rows) {
    if (!SHIPPED.has(String(row.status))) continue;
    for (const item of parseItems(row.items_json)) {
      const id = String(item.productId || '').trim();
      if (!id) continue;
      const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
      map.set(id, (map.get(id) || 0) + qty);
    }
  }
  return map;
}

export function listStockOnHand(): StockRow[] {
  ensureShopWarehouseSchema();
  const costs = purchaseUnitCostMap();
  const sold = soldQtyByProduct();
  const purchases = getDb()
    .prepare(
      `SELECT product_id, MAX(product_title) AS title, SUM(qty) AS qty
       FROM shop_supplier_purchases
       GROUP BY product_id`
    )
    .all() as Array<{ product_id: string; title: string; qty: number }>;
  return purchases
    .map((row) => {
      const purchasedQty = Number(row.qty) || 0;
      const soldQty = sold.get(String(row.product_id)) || 0;
      return {
        productId: String(row.product_id),
        productTitle: String(row.title || row.product_id),
        purchasedQty,
        soldQty,
        onHand: purchasedQty - soldQty,
        unitCostToman: costs.get(String(row.product_id)) || 0,
      };
    })
    .sort((a, b) => a.productTitle.localeCompare(b.productTitle, 'fa'));
}

export function shopProfitSummary(): ShopProfitSummary {
  ensureShopWarehouseSchema();
  const costs = purchaseUnitCostMap();
  const orders = getDb()
    .prepare(`SELECT status, total_toman, items_json FROM shop_orders`)
    .all() as Array<{ status: string; total_toman: number; items_json: string }>;
  let revenueToman = 0;
  let cogsToman = 0;
  for (const row of orders) {
    if (!REVENUE.has(String(row.status))) continue;
    revenueToman += Number(row.total_toman) || 0;
    for (const item of parseItems(row.items_json)) {
      const id = String(item.productId || '').trim();
      const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
      const unit = id ? costs.get(id) : undefined;
      if (unit != null) cogsToman += unit * qty;
    }
  }
  const spend = getDb()
    .prepare(
      `SELECT COUNT(*) AS c, COALESCE(SUM(qty * unit_cost_toman), 0) AS spend
       FROM shop_supplier_purchases`
    )
    .get() as { c: number; spend: number };
  return {
    revenueToman,
    cogsToman,
    profitToman: revenueToman - cogsToman,
    purchaseCount: Number(spend?.c || 0),
    purchaseSpendToman: Number(spend?.spend || 0),
  };
}

export function listWarehouseProducts(): Array<{ id: string; title: string }> {
  try {
    return getDb()
      .prepare(`SELECT id, title FROM shop_products ORDER BY title LIMIT 400`)
      .all() as Array<{ id: string; title: string }>;
  } catch {
    return [];
  }
}
