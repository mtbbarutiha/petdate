/**
 * Public pet-purchase consultation leads — additive table + Sales CRM handoff.
 * Never wipes existing data.
 */
import {
  formatIranMobileDisplay,
  isPetPurchaseLeadStatus,
  makePetPurchaseLeadPublicId,
  normalizeIranMobile,
  PET_PURCHASE_LEAD_SOURCE,
  PET_PURCHASE_LEAD_STATUSES,
  PET_PURCHASE_PRODUCT_NAME,
  type PetPurchaseLead,
  type PetPurchaseLeadStatus,
} from '@petdate/shared';
import { getDb } from './db';
import type { AdminAuthActor } from './hr-service';
import { ensureSalesSchema, assignSalesItem, claimSalesItem, getSalesItem } from './sales-service';

function db() {
  return getDb();
}

function nowIso(): string {
  return new Date().toISOString();
}

function mapRow(row: Record<string, unknown>): PetPurchaseLead {
  const id = Number(row.id);
  const statusRaw = String(row.status || 'جدید');
  const status: PetPurchaseLeadStatus = isPetPurchaseLeadStatus(statusRaw) ? statusRaw : 'جدید';
  return {
    id,
    publicId: makePetPurchaseLeadPublicId(id),
    firstName: String(row.first_name || ''),
    lastName: String(row.last_name || ''),
    mobile: String(row.mobile || ''),
    status,
    assigneeId: row.assignee_id != null ? String(row.assignee_id) : null,
    assigneeName: row.assignee_name != null ? String(row.assignee_name) : null,
    salesItemId: row.sales_item_id != null ? Number(row.sales_item_id) : null,
    sourcePage: String(row.source_page || ''),
    note: String(row.note || ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function ensurePetPurchaseLeadsSchema(): void {
  ensureSalesSchema();
  const d = db();
  d.exec(`
    CREATE TABLE IF NOT EXISTS pet_purchase_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      mobile TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'جدید',
      assignee_id TEXT,
      assignee_name TEXT,
      sales_item_id INTEGER,
      source_page TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pet_purchase_leads_status ON pet_purchase_leads(status);
    CREATE INDEX IF NOT EXISTS idx_pet_purchase_leads_created ON pet_purchase_leads(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pet_purchase_leads_mobile ON pet_purchase_leads(mobile);
  `);

  const productName = PET_PURCHASE_PRODUCT_NAME || 'مشاوره خرید پت';
  const product = d
    .prepare('SELECT id FROM sales_products WHERE name = ? LIMIT 1')
    .get(productName) as { id: number } | undefined;
  if (!product) {
    d.prepare('INSERT INTO sales_products (name, price, active) VALUES (?, ?, 1)').run(productName, 0);
  }
}

function actorLabel(actor: AdminAuthActor): string {
  return actor.displayName || actor.username || actor.role || 'admin';
}

function actorId(actor: AdminAuthActor): string {
  return actor.username || actor.role || 'admin';
}

function createUnassignedSalesLead(input: {
  first: string;
  last: string;
  mobile: string;
}): number {
  ensureSalesSchema();
  const info = db()
    .prepare(
      `INSERT INTO sales_items (
        kind, first_name, last_name, mobile, email, product, source, score,
        owner_id, owner_name, stage, value, discount, created_at, last_activity, customer_id, pay_status
      ) VALUES ('lead', ?, ?, ?, NULL, ?, ?, 70, NULL, NULL, '0', 0, 0, ?, ?, NULL, 'بدون پرداخت')`
    )
    .run(
      input.first,
      input.last,
      input.mobile,
      PET_PURCHASE_PRODUCT_NAME,
      PET_PURCHASE_LEAD_SOURCE,
      nowIso(),
      nowIso()
    );
  const id = Number(info.lastInsertRowid);
  db()
    .prepare('INSERT INTO sales_activities (item_id, at, text, kind) VALUES (?, ?, ?, ?)')
    .run(id, nowIso(), 'لید از فرم درخواست خرید پت (وبسایت)', 'sys');
  return id;
}

function notifySalesOfNewLead(lead: PetPurchaseLead): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { pushAdminHeaderNotification } =
      require('./admin-notifications') as typeof import('./admin-notifications');
    pushAdminHeaderNotification({
      title: 'درخواست خرید پت جدید',
      body: `${lead.firstName} ${lead.lastName} · ${formatIranMobileDisplay(lead.mobile)}`,
      kind: 'info',
      href: `/admin/sales/pet-purchase-requests`,
      module: 'sales',
      permission: 'sales.read',
      sourceKey: `pet-purchase-lead:${lead.id}`,
    });
  } catch {
    /* optional */
  }
}

export function submitPetPurchaseLead(input: {
  firstName: string;
  lastName: string;
  mobile: string;
  sourcePage?: string;
}): PetPurchaseLead {
  ensurePetPurchaseLeadsSchema();
  const firstName = String(input.firstName || '').trim();
  const lastName = String(input.lastName || '').trim();
  if (!firstName) throw new Error('نام الزامی است');
  if (!lastName) throw new Error('نام خانوادگی الزامی است');
  const normalized = normalizeIranMobile(String(input.mobile || ''));
  if (!normalized) throw new Error('شماره موبایل ایران معتبر نیست');
  const mobileDisplay = formatIranMobileDisplay(normalized);
  const sourcePage = String(input.sourcePage || '').trim().slice(0, 120) || 'web';

  const salesItemId = createUnassignedSalesLead({
    first: firstName,
    last: lastName,
    mobile: mobileDisplay,
  });

  const info = db()
    .prepare(
      `INSERT INTO pet_purchase_leads (
        first_name, last_name, mobile, status, sales_item_id, source_page, created_at, updated_at
      ) VALUES (?, ?, ?, 'جدید', ?, ?, ?, ?)`
    )
    .run(firstName, lastName, mobileDisplay, salesItemId, sourcePage, nowIso(), nowIso());

  const lead = getPetPurchaseLead(Number(info.lastInsertRowid))!;
  notifySalesOfNewLead(lead);
  return lead;
}

export function getPetPurchaseLead(id: number): PetPurchaseLead | null {
  ensurePetPurchaseLeadsSchema();
  const row = db().prepare('SELECT * FROM pet_purchase_leads WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapRow(row) : null;
}

export function listPetPurchaseLeads(opts?: {
  status?: string;
  q?: string;
  limit?: number;
}): { total: number; items: PetPurchaseLead[] } {
  ensurePetPurchaseLeadsSchema();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts?.status && isPetPurchaseLeadStatus(opts.status)) {
    where.push('status = ?');
    params.push(opts.status);
  }
  if (opts?.q?.trim()) {
    const q = `%${opts.q.trim()}%`;
    where.push('(first_name LIKE ? OR last_name LIKE ? OR mobile LIKE ? OR CAST(id AS TEXT) LIKE ?)');
    params.push(q, q, q, q);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number(
    (db().prepare(`SELECT COUNT(*) as c FROM pet_purchase_leads ${whereSql}`).get(...params) as { c: number })
      ?.c ?? 0
  );
  const limit = Math.min(200, Math.max(1, Number(opts?.limit) || 100));
  const rows = db()
    .prepare(
      `SELECT * FROM pet_purchase_leads ${whereSql} ORDER BY id DESC LIMIT ?`
    )
    .all(...params, limit) as Array<Record<string, unknown>>;
  return { total, items: rows.map(mapRow) };
}

export function countOpenPetPurchaseLeads(): number {
  ensurePetPurchaseLeadsSchema();
  const row = db()
    .prepare(
      `SELECT COUNT(*) as c FROM pet_purchase_leads
       WHERE status IN ('جدید', 'در حال پیگیری', 'ارجاع‌شده به فروش')`
    )
    .get() as { c: number };
  return Number(row?.c ?? 0);
}

export function updatePetPurchaseLeadStatus(
  id: number,
  status: PetPurchaseLeadStatus,
  actor: AdminAuthActor
): PetPurchaseLead {
  ensurePetPurchaseLeadsSchema();
  if (!isPetPurchaseLeadStatus(status)) throw new Error('وضعیت نامعتبر است');
  const lead = getPetPurchaseLead(id);
  if (!lead) throw new Error('یافت نشد');
  db()
    .prepare('UPDATE pet_purchase_leads SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, nowIso(), id);
  if (lead.salesItemId) {
    db()
      .prepare('INSERT INTO sales_activities (item_id, at, text, kind) VALUES (?, ?, ?, ?)')
      .run(
        lead.salesItemId,
        nowIso(),
        `وضعیت درخواست خرید پت: ${status} — ${actorLabel(actor)}`,
        'sys'
      );
  }
  return getPetPurchaseLead(id)!;
}

export function assignPetPurchaseLead(
  id: number,
  ownerId: string,
  ownerName: string,
  actor: AdminAuthActor
): PetPurchaseLead {
  ensurePetPurchaseLeadsSchema();
  const lead = getPetPurchaseLead(id);
  if (!lead) throw new Error('یافت نشد');
  const oid = String(ownerId || '').trim();
  const oname = String(ownerName || oid).trim();
  if (!oid) throw new Error('شناسه کارشناس الزامی است');

  db()
    .prepare(
      `UPDATE pet_purchase_leads
       SET assignee_id = ?, assignee_name = ?, status = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(oid, oname, 'ارجاع‌شده به فروش', nowIso(), id);

  if (lead.salesItemId && getSalesItem(lead.salesItemId)) {
    assignSalesItem(lead.salesItemId, oid, oname, actor);
  }
  return getPetPurchaseLead(id)!;
}

export function claimPetPurchaseLead(id: number, actor: AdminAuthActor): PetPurchaseLead {
  ensurePetPurchaseLeadsSchema();
  const lead = getPetPurchaseLead(id);
  if (!lead) throw new Error('یافت نشد');
  const oid = actorId(actor);
  const oname = actorLabel(actor);

  db()
    .prepare(
      `UPDATE pet_purchase_leads
       SET assignee_id = ?, assignee_name = ?, status = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(oid, oname, 'در حال پیگیری', nowIso(), id);

  if (lead.salesItemId && getSalesItem(lead.salesItemId)) {
    claimSalesItem(lead.salesItemId, actor);
  }
  return getPetPurchaseLead(id)!;
}

export { PET_PURCHASE_LEAD_STATUSES };
