/**
 * Shop suppliers used by warehouse purchase invoices.
 * Legacy free-text supplier names (including «دیجی‌کالا» variants) are migrated
 * onto rows so old invoices resolve to an id.
 */
import { getDb } from './db';
import { canonicalSupplierName, normalizeSupplierKey } from './shop-supplier-names';

export type ShopSupplier = {
  id: number;
  name: string;
  phone: string;
  contactPerson: string;
  addressNotes: string;
  active: boolean;
  createdAt: string;
};

let ensuringSuppliers = false;

function columnNames(table: string): Set<string> {
  try {
    const rows = getDb().prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return new Set(rows.map((row) => row.name));
  } catch {
    return new Set();
  }
}

export function ensureShopSuppliersSchema(): void {
  if (ensuringSuppliers) return;
  ensuringSuppliers = true;
  try {
    getDb().exec(`
      CREATE TABLE IF NOT EXISTS shop_supplier_purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id TEXT NOT NULL,
        product_title TEXT NOT NULL DEFAULT '',
        qty INTEGER NOT NULL,
        unit_cost_toman INTEGER NOT NULL,
        supplier TEXT NOT NULL DEFAULT '',
        supplier_id INTEGER,
        purchased_at TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    getDb().exec(`
      CREATE TABLE IF NOT EXISTS shop_suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        contact_person TEXT NOT NULL DEFAULT '',
        address_notes TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    const purchaseCols = columnNames('shop_supplier_purchases');
    if (purchaseCols.size && !purchaseCols.has('supplier_id')) {
      try {
        getDb().exec(`ALTER TABLE shop_supplier_purchases ADD COLUMN supplier_id INTEGER`);
      } catch { /* already present */ }
    }
    migrateLegacyPurchaseSuppliers();
  } finally {
    ensuringSuppliers = false;
  }
}

function mapSupplier(row: Record<string, unknown>): ShopSupplier {
  return {
    id: Number(row.id),
    name: String(row.name || ''),
    phone: String(row.phone || ''),
    contactPerson: String(row.contact_person || ''),
    addressNotes: String(row.address_notes || ''),
    active: Number(row.active) !== 0,
    createdAt: String(row.created_at || ''),
  };
}

export function listShopSuppliers(opts?: { includeInactive?: boolean }): ShopSupplier[] {
  ensureShopSuppliersSchema();
  const rows = getDb()
    .prepare(
      `SELECT * FROM shop_suppliers
       ${opts?.includeInactive === false ? 'WHERE active = 1' : ''}
       ORDER BY active DESC, name COLLATE NOCASE, id`
    )
    .all() as Record<string, unknown>[];
  return rows.map(mapSupplier);
}

export function getShopSupplier(id: number): ShopSupplier | null {
  ensureShopSuppliersSchema();
  const row = getDb().prepare(`SELECT * FROM shop_suppliers WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapSupplier(row) : null;
}

function findByKey(key: string): ShopSupplier | null {
  if (!key) return null;
  for (const row of listShopSuppliers({ includeInactive: true })) {
    if (normalizeSupplierKey(row.name) === key) return row;
  }
  return null;
}

export function createShopSupplier(input: {
  name: string;
  phone?: string;
  contactPerson?: string;
  addressNotes?: string;
  active?: boolean;
}): ShopSupplier {
  ensureShopSuppliersSchema();
  const name = canonicalSupplierName(input.name);
  if (!name) throw new Error('نام تأمین‌کننده الزامی است');
  const existing = findByKey(normalizeSupplierKey(name));
  if (existing) throw new Error('این تأمین‌کننده قبلاً ثبت شده');
  const result = getDb()
    .prepare(
      `INSERT INTO shop_suppliers (name, phone, contact_person, address_notes, active)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      name,
      String(input.phone || '').trim(),
      String(input.contactPerson || '').trim(),
      String(input.addressNotes || '').trim(),
      input.active === false ? 0 : 1
    );
  const row = getShopSupplier(Number(result.lastInsertRowid));
  if (!row) throw new Error('ثبت تأمین‌کننده ناموفق بود');
  return row;
}

export function updateShopSupplier(
  id: number,
  input: {
    name?: string;
    phone?: string;
    contactPerson?: string;
    addressNotes?: string;
    active?: boolean;
  }
): ShopSupplier {
  ensureShopSuppliersSchema();
  const current = getShopSupplier(id);
  if (!current) throw new Error('تأمین‌کننده پیدا نشد');
  const name = input.name != null ? canonicalSupplierName(input.name) : current.name;
  if (!name) throw new Error('نام تأمین‌کننده الزامی است');
  const clash = findByKey(normalizeSupplierKey(name));
  if (clash && clash.id !== id) throw new Error('این تأمین‌کننده قبلاً ثبت شده');
  getDb()
    .prepare(
      `UPDATE shop_suppliers
       SET name = ?, phone = ?, contact_person = ?, address_notes = ?, active = ?
       WHERE id = ?`
    )
    .run(
      name,
      input.phone != null ? String(input.phone).trim() : current.phone,
      input.contactPerson != null ? String(input.contactPerson).trim() : current.contactPerson,
      input.addressNotes != null ? String(input.addressNotes).trim() : current.addressNotes,
      input.active == null ? (current.active ? 1 : 0) : input.active ? 1 : 0,
      id
    );
  try {
    getDb().prepare(`UPDATE shop_supplier_purchases SET supplier = ? WHERE supplier_id = ?`).run(name, id);
  } catch { /* purchases table may be missing */ }
  const row = getShopSupplier(id);
  if (!row) throw new Error('تأمین‌کننده پیدا نشد');
  return row;
}

export function deleteShopSupplier(id: number): { ok: true; deactivated: boolean } {
  ensureShopSuppliersSchema();
  if (!getShopSupplier(id)) throw new Error('تأمین‌کننده پیدا نشد');
  let used = 0;
  try {
    const row = getDb()
      .prepare(`SELECT COUNT(*) AS c FROM shop_supplier_purchases WHERE supplier_id = ?`)
      .get(id) as { c: number };
    used = Number(row?.c || 0);
  } catch { used = 0; }
  if (used > 0) {
    getDb().prepare(`UPDATE shop_suppliers SET active = 0 WHERE id = ?`).run(id);
    return { ok: true, deactivated: true };
  }
  getDb().prepare(`DELETE FROM shop_suppliers WHERE id = ?`).run(id);
  return { ok: true, deactivated: false };
}

export function resolveSupplierForPurchase(input: {
  supplierId?: number;
  supplier?: string;
}): { id: number; name: string } {
  ensureShopSuppliersSchema();
  const supplierId = Number(input.supplierId);
  if (Number.isFinite(supplierId) && supplierId > 0) {
    const row = getShopSupplier(supplierId);
    if (!row) throw new Error('تأمین‌کننده پیدا نشد');
    if (!row.active) throw new Error('تأمین‌کننده غیرفعال است');
    return { id: row.id, name: row.name };
  }
  const name = canonicalSupplierName(String(input.supplier || ''));
  if (!name) throw new Error('نام تأمین‌کننده الزامی است');
  const existing = findByKey(normalizeSupplierKey(name));
  if (existing) {
    if (!existing.active) throw new Error('تأمین‌کننده غیرفعال است');
    return { id: existing.id, name: existing.name };
  }
  const created = createShopSupplier({ name, active: true });
  return { id: created.id, name: created.name };
}

export function migrateLegacyPurchaseSuppliers(): void {
  let purchases: Array<{ id: number; supplier: string; supplier_id: number | null }> = [];
  try {
    purchases = getDb()
      .prepare(
        `SELECT id, supplier, supplier_id FROM shop_supplier_purchases
         WHERE TRIM(COALESCE(supplier, '')) != ''`
      )
      .all() as Array<{ id: number; supplier: string; supplier_id: number | null }>;
  } catch {
    return;
  }
  const upd = getDb().prepare(
    `UPDATE shop_supplier_purchases SET supplier_id = ?, supplier = ? WHERE id = ?`
  );
  for (const purchase of purchases) {
    if (purchase.supplier_id != null && Number(purchase.supplier_id) > 0) continue;
    const name = canonicalSupplierName(purchase.supplier);
    if (!name) continue;
    let supplier = findByKey(normalizeSupplierKey(name));
    if (!supplier) {
      const inserted = getDb()
        .prepare(
          `INSERT INTO shop_suppliers (name, phone, contact_person, address_notes, active)
           VALUES (?, '', '', '', 1)`
        )
        .run(name);
      supplier = getShopSupplier(Number(inserted.lastInsertRowid));
    }
    if (!supplier) continue;
    upd.run(supplier.id, supplier.name, purchase.id);
  }
}
