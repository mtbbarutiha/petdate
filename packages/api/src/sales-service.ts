/**
 * فروش Pet Date — Sales CRM persistence (additive schema, no wipe).
 * Single-tenant: no business-line switching.
 */
import {
  SALES_DEFAULT_PRODUCTS,
  SALES_LEAD_SOURCES,
  SALES_LOST_REASONS,
  SALES_STAGES,
  makeSalesCustomerPublicId,
  makeSalesPublicId,
  makeSalesTicketPublicId,
  type SalesActivity,
  type SalesCall,
  type SalesCustomer,
  type SalesDashboard,
  type SalesFollowup,
  type SalesGoal,
  type SalesItem,
  type SalesItemKind,
  type SalesMessage,
  type SalesOffer,
  type SalesOrder,
  type SalesPattern,
  type SalesPayment,
  type SalesProduct,
  type SalesReportSummary,
  type SalesSettings,
  type SalesStage,
  type SalesSurvey,
  type SalesTicket,
} from '@petdate/shared';
import { getDb } from './db';
import type { AdminAuthActor } from './hr-service';
import { actorHasPermission } from './hr-service';

function db() { return getDb(); }
function nowIso(): string { return new Date().toISOString(); }
function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  try { return JSON.parse(String(raw)) as T; } catch { return fallback; }
}
function isToday(iso: string): boolean {
  const d = new Date(iso), n = new Date();
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
}
function dayKey(iso: string): string { return iso.slice(0, 10); }
function slaHours(priority: string): number {
  if (priority === 'بحرانی') return 4;
  if (priority === 'بالا') return 24;
  if (priority === 'متوسط') return 72;
  return 120;
}
function parseStage(raw: unknown): SalesStage {
  if (raw === 'lost' || raw === '"lost"') return 'lost';
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
function stageToDb(stage: SalesStage): string { return stage === 'lost' ? 'lost' : String(stage); }

export function ensureSalesSchema(): void {
  const d = db();
  d.exec(`
    CREATE TABLE IF NOT EXISTS sales_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, price INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sales_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL,
      first_name TEXT NOT NULL DEFAULT '', last_name TEXT NOT NULL DEFAULT '',
      mobile TEXT NOT NULL DEFAULT '', email TEXT, product TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '', score INTEGER NOT NULL DEFAULT 50,
      owner_id TEXT, owner_name TEXT, stage TEXT NOT NULL DEFAULT '0',
      value INTEGER NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_activity TEXT NOT NULL DEFAULT (datetime('now')),
      next_followup TEXT, lost_reason TEXT, customer_id INTEGER,
      pay_status TEXT NOT NULL DEFAULT 'بدون پرداخت', pay_type TEXT
    );
    CREATE TABLE IF NOT EXISTS sales_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL,
      at TEXT NOT NULL DEFAULT (datetime('now')), text TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'sys'
    );
    CREATE TABLE IF NOT EXISTS sales_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ref_kind TEXT NOT NULL, ref_id INTEGER NOT NULL,
      agent_id TEXT NOT NULL, agent_name TEXT, dir TEXT NOT NULL DEFAULT 'call_out',
      started_at TEXT NOT NULL DEFAULT (datetime('now')), talk INTEGER NOT NULL DEFAULT 0,
      result TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '',
      qa_status TEXT NOT NULL DEFAULT 'ارزیابی نشده', qa_score INTEGER
    );
    CREATE TABLE IF NOT EXISTS sales_followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ref_kind TEXT, ref_id INTEGER, owner_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'تماس پیگیری', at TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'متوسط', desc_text TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'باز'
    );
    CREATE TABLE IF NOT EXISTS sales_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ref_kind TEXT NOT NULL, ref_id INTEGER NOT NULL,
      product TEXT NOT NULL, price INTEGER NOT NULL, discount REAL NOT NULL DEFAULT 0,
      final INTEGER NOT NULL, approval_needed INTEGER NOT NULL DEFAULT 0,
      approval_status TEXT NOT NULL DEFAULT '—', created_by TEXT NOT NULL,
      at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sales_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ref_kind TEXT NOT NULL, ref_id INTEGER NOT NULL,
      amount INTEGER NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL,
      at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sales_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ref_kind TEXT, ref_id INTEGER, customer_id INTEGER,
      payment_id INTEGER, title TEXT NOT NULL, dept TEXT NOT NULL DEFAULT 'مالی',
      cat TEXT NOT NULL DEFAULT 'سایر', priority TEXT NOT NULL DEFAULT 'متوسط',
      status TEXT NOT NULL DEFAULT 'جدید', created_at TEXT NOT NULL DEFAULT (datetime('now')),
      sla_due TEXT NOT NULL, desc_text TEXT NOT NULL DEFAULT '', agent_id TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS sales_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '', mobile TEXT NOT NULL DEFAULT '', email TEXT,
      level TEXT NOT NULL DEFAULT 'عادی', sales_owner TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')), csat INTEGER, source_lead_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS sales_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL,
      product TEXT NOT NULL, amount INTEGER NOT NULL, at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sales_surveys (
      id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, score INTEGER NOT NULL,
      comment TEXT NOT NULL DEFAULT '', channel TEXT NOT NULL DEFAULT 'تماس',
      at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sales_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT NOT NULL, name TEXT NOT NULL,
      text TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS sales_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ref_kind TEXT NOT NULL, ref_id INTEGER NOT NULL,
      channel TEXT NOT NULL, pattern_id INTEGER, pattern_name TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL, at TEXT NOT NULL DEFAULT (datetime('now')), by_user TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS sales_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, team TEXT NOT NULL DEFAULT 'همه تیم‌ها',
      period_from TEXT, period_to TEXT, active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), created_by TEXT NOT NULL DEFAULT '',
      metrics_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS sales_settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sales_items_kind ON sales_items(kind);
    CREATE INDEX IF NOT EXISTS idx_sales_items_stage ON sales_items(stage);
    CREATE INDEX IF NOT EXISTS idx_sales_items_owner ON sales_items(owner_id);
    CREATE INDEX IF NOT EXISTS idx_sales_activities_item ON sales_activities(item_id);
    CREATE INDEX IF NOT EXISTS idx_sales_tickets_status ON sales_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_sales_customers_mobile ON sales_customers(mobile);
  `);
  seedSalesDefaults();
}

function seedSalesDefaults(): void {
  const d = db();
  const productCount = Number((d.prepare('SELECT COUNT(*) as c FROM sales_products').get() as { c: number })?.c ?? 0);
  if (productCount === 0) {
    const ins = d.prepare('INSERT INTO sales_products (name, price, active) VALUES (?, ?, 1)');
    for (const p of SALES_DEFAULT_PRODUCTS) ins.run(p.name, p.price);
  }
  const setIfMissing = (key: string, value: unknown) => {
    if (d.prepare('SELECT key FROM sales_settings WHERE key = ?').get(key)) return;
    d.prepare(`INSERT INTO sales_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run(key, JSON.stringify(value));
  };
  setIfMissing('leadSources', [...SALES_LEAD_SOURCES]);
  setIfMissing('lostReasons', [...SALES_LOST_REASONS]);
  setIfMissing('discountLimits', { sales_agent: 5, sales_lead: 15, sales_manager: 100, admin: 100 });
  const patternCount = Number((d.prepare('SELECT COUNT(*) as c FROM sales_patterns').get() as { c: number })?.c ?? 0);
  if (patternCount === 0) {
    const ins = d.prepare('INSERT INTO sales_patterns (channel, name, text, active) VALUES (?, ?, ?, 1)');
    ins.run('پیامک', 'خوش‌آمدگویی لید', 'سلام {نام} عزیز، من {کارشناس} از Pet Date هستم. درباره {محصول} در خدمتم.');
    ins.run('تلگرام', 'پیگیری پیشنهاد', '{نام} جان، پیشنهاد {محصول} به مبلغ {قیمت} تومان آماده است.');
    ins.run('واتساپ', 'لینک پرداخت', '{نام} عزیز، لینک پرداخت {محصول}: {لینک_پرداخت}');
  }
  try {
    const seedRoleIfMissing = (key: string, nameFa: string, description: string, permissions: readonly string[]) => {
      if (d.prepare('SELECT id FROM admin_roles WHERE key = ?').get(key)) return;
      d.prepare(`INSERT INTO admin_roles (key, name_fa, description, permissions_json, is_active) VALUES (?, ?, ?, ?, 1)`)
        .run(key, nameFa, description, JSON.stringify(permissions));
    };
    seedRoleIfMissing('sales_agent', 'کارشناس فروش', 'لید، آپگرید، مشتری، پیگیری', ['sales.read', 'sales.write']);
    seedRoleIfMissing('sales_lead', 'سرپرست فروش', 'تخصیص، تایید تخفیف/مالی، هدف‌گذاری', ['sales.read', 'sales.write', 'sales.admin']);
    seedRoleIfMissing('sales_manager', 'مدیر فروش', 'دسترسی کامل ماژول فروش', ['sales.read', 'sales.write', 'sales.admin']);
  } catch { /* admin_roles may not exist yet */ }
}

function mapItem(row: Record<string, unknown>): SalesItem {
  const id = Number(row.id);
  const kind = String(row.kind) as SalesItemKind;
  return {
    id, publicId: makeSalesPublicId(kind, id), kind,
    first: String(row.first_name || ''), last: String(row.last_name || ''),
    mobile: String(row.mobile || ''), email: row.email != null ? String(row.email) : null,
    product: String(row.product || ''), source: String(row.source || ''),
    score: Number(row.score || 0),
    ownerId: row.owner_id != null ? String(row.owner_id) : null,
    ownerName: row.owner_name != null ? String(row.owner_name) : null,
    stage: parseStage(row.stage), value: Number(row.value || 0), discount: Number(row.discount || 0),
    createdAt: String(row.created_at), lastActivity: String(row.last_activity),
    nextFollowup: row.next_followup != null ? String(row.next_followup) : null,
    lostReason: row.lost_reason != null ? String(row.lost_reason) : null,
    customerId: row.customer_id != null ? Number(row.customer_id) : null,
    payStatus: String(row.pay_status || 'بدون پرداخت'),
    payType: row.pay_type != null ? String(row.pay_type) : null,
  };
}

function addActivity(itemId: number, text: string, kind = 'sys'): void {
  db().prepare('INSERT INTO sales_activities (item_id, at, text, kind) VALUES (?, ?, ?, ?)').run(itemId, nowIso(), text, kind);
  db().prepare('UPDATE sales_items SET last_activity = ? WHERE id = ?').run(nowIso(), itemId);
}
function actorLabel(actor: AdminAuthActor): string { return actor.displayName || actor.username || actor.role || 'admin'; }
function actorId(actor: AdminAuthActor): string { return actor.username || actor.role || 'admin'; }
export function isSalesAdmin(actor: AdminAuthActor): boolean {
  return actorHasPermission(actor, 'sales.admin') || actorHasPermission(actor, 'admin.full');
}
function discountLimitFor(actor: AdminAuthActor): number {
  const settings = getSalesSettings();
  const role = actor.role || 'sales_agent';
  if (settings.discountLimits[role] != null) return Number(settings.discountLimits[role]);
  return isSalesAdmin(actor) ? 100 : 5;
}

export function listSalesProducts(opts?: { activeOnly?: boolean }): SalesProduct[] {
  ensureSalesSchema();
  const rows = (opts?.activeOnly
    ? db().prepare('SELECT * FROM sales_products WHERE active = 1 ORDER BY id').all()
    : db().prepare('SELECT * FROM sales_products ORDER BY id').all()) as Array<Record<string, unknown>>;
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name), price: Number(r.price), active: Boolean(r.active), createdAt: String(r.created_at) }));
}

export function upsertSalesProduct(input: { id?: number; name: string; price: number; active?: boolean }): SalesProduct {
  ensureSalesSchema();
  const name = String(input.name || '').trim();
  if (!name) throw new Error('نام محصول الزامی است');
  const price = Math.max(0, Math.round(Number(input.price) || 0));
  const active = input.active === false ? 0 : 1;
  if (input.id) {
    db().prepare('UPDATE sales_products SET name = ?, price = ?, active = ? WHERE id = ?').run(name, price, active, input.id);
  } else {
    const info = db().prepare('INSERT INTO sales_products (name, price, active) VALUES (?, ?, ?)').run(name, price, active);
    input.id = Number(info.lastInsertRowid);
  }
  return listSalesProducts().find((p) => p.id === input.id)!;
}

export function getSalesSettings(): SalesSettings {
  ensureSalesSchema();
  const get = (key: string, fallback: unknown) => {
    const row = db().prepare('SELECT value FROM sales_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? parseJson(row.value, fallback) : fallback;
  };
  return {
    leadSources: get('leadSources', [...SALES_LEAD_SOURCES]) as string[],
    lostReasons: get('lostReasons', [...SALES_LOST_REASONS]) as string[],
    discountLimits: get('discountLimits', { sales_agent: 5, sales_lead: 15, sales_manager: 100 }) as Record<string, number>,
  };
}

export function updateSalesSettings(patch: Partial<SalesSettings>): SalesSettings {
  ensureSalesSchema();
  const cur = getSalesSettings();
  const next: SalesSettings = {
    leadSources: patch.leadSources ?? cur.leadSources,
    lostReasons: patch.lostReasons ?? cur.lostReasons,
    discountLimits: patch.discountLimits ?? cur.discountLimits,
  };
  const upsert = db().prepare(`INSERT INTO sales_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`);
  upsert.run('leadSources', JSON.stringify(next.leadSources));
  upsert.run('lostReasons', JSON.stringify(next.lostReasons));
  upsert.run('discountLimits', JSON.stringify(next.discountLimits));
  return next;
}

export function listSalesItems(opts: {
  kind?: SalesItemKind; q?: string; stage?: string; unassignedOnly?: boolean; ownerId?: string; limit?: number;
}): { total: number; items: SalesItem[] } {
  ensureSalesSchema();
  const where: string[] = []; const params: unknown[] = [];
  if (opts.kind) { where.push('kind = ?'); params.push(opts.kind); }
  if (opts.stage === 'lost') where.push("stage = 'lost'");
  else if (opts.stage != null && opts.stage !== '') { where.push('stage = ?'); params.push(String(opts.stage)); }
  if (opts.unassignedOnly) where.push('owner_id IS NULL');
  if (opts.ownerId) { where.push('(owner_id = ? OR owner_id IS NULL)'); params.push(opts.ownerId); }
  if (opts.q?.trim()) {
    where.push('(first_name LIKE ? OR last_name LIKE ? OR mobile LIKE ? OR product LIKE ? OR source LIKE ?)');
    const like = `%${opts.q.trim()}%`; params.push(like, like, like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number((db().prepare(`SELECT COUNT(*) as c FROM sales_items ${whereSql}`).get(...params) as { c: number }).c);
  const limit = Math.min(Math.max(opts.limit || 100, 1), 500);
  const rows = db().prepare(`SELECT * FROM sales_items ${whereSql} ORDER BY last_activity DESC LIMIT ?`).all(...params, limit) as Array<Record<string, unknown>>;
  return { total, items: rows.map(mapItem) };
}

export function getSalesItem(id: number): SalesItem | null {
  ensureSalesSchema();
  const row = db().prepare('SELECT * FROM sales_items WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapItem(row) : null;
}

export function createSalesItem(input: {
  kind: SalesItemKind; first: string; last?: string; mobile: string; email?: string;
  product?: string; source?: string; score?: number; value?: number; customerId?: number;
}, actor: AdminAuthActor): SalesItem {
  ensureSalesSchema();
  const mobile = String(input.mobile || '').trim();
  if (!mobile) throw new Error('موبایل الزامی است');
  const products = listSalesProducts({ activeOnly: true });
  const productName = String(input.product || '').trim() || products[0]?.name || 'اشتراک ماهانه Pet Date';
  const productPrice = products.find((p) => p.name === productName)?.price ?? products[0]?.price ?? 0;
  const kind = input.kind === 'upgrade' ? 'upgrade' : 'lead';
  const info = db().prepare(`INSERT INTO sales_items (
      kind, first_name, last_name, mobile, email, product, source, score,
      owner_id, owner_name, stage, value, discount, created_at, last_activity, customer_id, pay_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0', ?, 0, ?, ?, ?, 'بدون پرداخت')`).run(
    kind, String(input.first || '').trim() || 'بدون‌نام', String(input.last || '').trim(), mobile,
    input.email?.trim() || null, productName,
    String(input.source || (kind === 'upgrade' ? 'امور فروش' : 'سایر')).trim(),
    Math.min(100, Math.max(0, Number(input.score ?? 50))),
    actorId(actor), actorLabel(actor), Math.round(Number(input.value ?? productPrice) || 0),
    nowIso(), nowIso(), input.customerId ?? null
  );
  const id = Number(info.lastInsertRowid);
  addActivity(id, `ایجاد ${kind === 'lead' ? 'لید' : 'آپگرید'} توسط ${actorLabel(actor)}`, 'sys');
  return getSalesItem(id)!;
}

export function claimSalesItem(id: number, actor: AdminAuthActor): SalesItem {
  ensureSalesSchema();
  const item = getSalesItem(id);
  if (!item) throw new Error('یافت نشد');
  if (item.ownerId && item.ownerId !== actorId(actor) && !isSalesAdmin(actor)) throw new Error('این مورد قبلاً تخصیص داده شده');
  db().prepare(`UPDATE sales_items SET owner_id = ?, owner_name = ?, stage = CASE WHEN stage = '0' THEN '1' ELSE stage END, last_activity = ? WHERE id = ?`)
    .run(actorId(actor), actorLabel(actor), nowIso(), id);
  addActivity(id, `برداشته‌شد توسط ${actorLabel(actor)}`, 'assign');
  return getSalesItem(id)!;
}

export function assignSalesItem(id: number, ownerId: string, ownerName: string, actor: AdminAuthActor): SalesItem {
  if (!isSalesAdmin(actor)) throw new Error('فقط سرپرست/مدیر می‌تواند تخصیص دهد');
  ensureSalesSchema();
  if (!getSalesItem(id)) throw new Error('یافت نشد');
  db().prepare(`UPDATE sales_items SET owner_id = ?, owner_name = ?, stage = CASE WHEN stage = '0' THEN '1' ELSE stage END, last_activity = ? WHERE id = ?`)
    .run(ownerId, ownerName, nowIso(), id);
  addActivity(id, `تخصیص به ${ownerName} توسط ${actorLabel(actor)}`, 'assign');
  return getSalesItem(id)!;
}

export function advanceSalesStage(id: number, actor: AdminAuthActor): SalesItem {
  ensureSalesSchema();
  const item = getSalesItem(id);
  if (!item) throw new Error('یافت نشد');
  if (item.stage === 'lost' || typeof item.stage !== 'number') throw new Error('مرحله قابل پیشرفت نیست');
  if (item.stage >= 6) throw new Error('برای برنده شدن باید استعلام مالی تایید شود');
  db().prepare('UPDATE sales_items SET stage = ?, last_activity = ? WHERE id = ?').run(String(item.stage + 1), nowIso(), id);
  addActivity(id, `پیشرفت مرحله توسط ${actorLabel(actor)}`, 'stage');
  return getSalesItem(id)!;
}

export function markSalesLost(id: number, reason: string, actor: AdminAuthActor): SalesItem {
  ensureSalesSchema();
  const lostReason = String(reason || '').trim();
  if (!lostReason) throw new Error('دلیل ازدست‌رفتن الزامی است');
  if (!getSalesItem(id)) throw new Error('یافت نشد');
  db().prepare(`UPDATE sales_items SET stage = 'lost', lost_reason = ?, last_activity = ? WHERE id = ?`).run(lostReason, nowIso(), id);
  addActivity(id, `ازدست‌رفته: ${lostReason} — ${actorLabel(actor)}`, 'lost');
  return getSalesItem(id)!;
}

export function listSalesActivities(itemId: number): SalesActivity[] {
  ensureSalesSchema();
  return (db().prepare('SELECT * FROM sales_activities WHERE item_id = ? ORDER BY id DESC LIMIT 200').all(itemId) as Array<Record<string, unknown>>)
    .map((r) => ({ id: Number(r.id), itemId: Number(r.item_id), at: String(r.at), text: String(r.text), kind: String(r.kind) }));
}

function mapCall(r: Record<string, unknown>): SalesCall {
  return {
    id: Number(r.id), refKind: String(r.ref_kind) as SalesItemKind, refId: Number(r.ref_id),
    agentId: String(r.agent_id), agentName: r.agent_name != null ? String(r.agent_name) : null,
    dir: r.dir === 'call_in' ? 'call_in' : 'call_out', startedAt: String(r.started_at),
    talk: Number(r.talk || 0), result: String(r.result || ''), summary: String(r.summary || ''),
    qaStatus: String(r.qa_status || 'ارزیابی نشده'), qaScore: r.qa_score != null ? Number(r.qa_score) : null,
  };
}

export function createSalesFollowup(input: {
  refKind?: SalesItemKind | null; refId?: number | null; type?: string; at: string; priority?: string; desc?: string;
}, actor: AdminAuthActor): SalesFollowup {
  ensureSalesSchema();
  const info = db().prepare(`INSERT INTO sales_followups (ref_kind, ref_id, owner_id, type, at, priority, desc_text, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'باز')`).run(
    input.refKind ?? null, input.refId ?? null, actorId(actor), input.type || 'تماس پیگیری',
    input.at, input.priority || 'متوسط', input.desc || ''
  );
  if (input.refId) {
    db().prepare('UPDATE sales_items SET next_followup = ?, last_activity = ? WHERE id = ?').run(input.at, nowIso(), input.refId);
    addActivity(input.refId, `پیگیری ثبت شد: ${input.desc || input.type || ''}`, 'followup');
  }
  return getFollowup(Number(info.lastInsertRowid))!;
}

function getFollowup(id: number): SalesFollowup | null {
  const r = db().prepare('SELECT * FROM sales_followups WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    id: Number(r.id), refKind: r.ref_kind != null ? (String(r.ref_kind) as SalesItemKind) : null,
    refId: r.ref_id != null ? Number(r.ref_id) : null, ownerId: String(r.owner_id),
    type: String(r.type), at: String(r.at), priority: String(r.priority),
    desc: String(r.desc_text || ''), status: r.status === 'انجام‌شده' ? 'انجام‌شده' : 'باز',
  };
}

export function listSalesFollowups(opts?: { openOnly?: boolean; ownerId?: string }): SalesFollowup[] {
  ensureSalesSchema();
  const where: string[] = []; const params: unknown[] = [];
  if (opts?.openOnly) where.push("status = 'باز'");
  if (opts?.ownerId) { where.push('owner_id = ?'); params.push(opts.ownerId); }
  const sql = `SELECT * FROM sales_followups ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY at ASC LIMIT 200`;
  return (db().prepare(sql).all(...params) as Array<Record<string, unknown>>).map((r) => getFollowup(Number(r.id))!);
}

export function completeSalesFollowup(id: number): SalesFollowup {
  ensureSalesSchema();
  db().prepare(`UPDATE sales_followups SET status = 'انجام‌شده' WHERE id = ?`).run(id);
  const f = getFollowup(id); if (!f) throw new Error('پیگیری یافت نشد'); return f;
}

export function createSalesCall(input: {
  refId: number; dir?: 'call_out' | 'call_in'; talk?: number; result: string; summary: string;
  advance?: boolean; markLost?: boolean; lostReason?: string;
  createFollowup?: { type?: string; hours?: number; priority?: string; desc?: string };
}, actor: AdminAuthActor): { call: SalesCall; item: SalesItem } {
  ensureSalesSchema();
  const item = getSalesItem(input.refId); if (!item) throw new Error('یافت نشد');
  const result = String(input.result || '').trim(); const summary = String(input.summary || '').trim();
  if (!result || !summary) throw new Error('نتیجه و خلاصه تماس الزامی است');
  const info = db().prepare(`INSERT INTO sales_calls (ref_kind, ref_id, agent_id, agent_name, dir, started_at, talk, result, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    item.kind, item.id, actorId(actor), actorLabel(actor), input.dir === 'call_in' ? 'call_in' : 'call_out',
    nowIso(), Math.max(0, Math.round(Number(input.talk) || 0)), result, summary
  );
  addActivity(item.id, `تماس (${result}): ${summary}`, 'call');
  let next = item;
  if (input.markLost) next = markSalesLost(item.id, input.lostReason || 'بدون پاسخ', actor);
  else if (input.advance) { try { next = advanceSalesStage(item.id, actor); } catch { next = getSalesItem(item.id)!; } }
  if (input.createFollowup) {
    const hours = Math.max(1, Number(input.createFollowup.hours) || 24);
    createSalesFollowup({
      refKind: item.kind, refId: item.id, type: input.createFollowup.type,
      at: new Date(Date.now() + hours * 3600_000).toISOString(),
      priority: input.createFollowup.priority, desc: input.createFollowup.desc || summary,
    }, actor);
  }
  const callRow = db().prepare('SELECT * FROM sales_calls WHERE id = ?').get(Number(info.lastInsertRowid)) as Record<string, unknown>;
  return { call: mapCall(callRow), item: next };
}

export function listSalesCalls(opts?: { limit?: number }): SalesCall[] {
  ensureSalesSchema();
  return (db().prepare('SELECT * FROM sales_calls ORDER BY started_at DESC LIMIT ?').all(Math.min(opts?.limit || 100, 300)) as Array<Record<string, unknown>>).map(mapCall);
}

export function scoreSalesCall(callId: number, score: number, actor: AdminAuthActor): SalesCall {
  ensureSalesSchema();
  const s = Math.min(100, Math.max(0, Math.round(score)));
  db().prepare(`UPDATE sales_calls SET qa_status = 'ارزیابی شد', qa_score = ? WHERE id = ?`).run(s, callId);
  const row = db().prepare('SELECT * FROM sales_calls WHERE id = ?').get(callId) as Record<string, unknown> | undefined;
  if (!row) throw new Error('تماس یافت نشد');
  return mapCall(row);
}

function listOffersForItem(refId: number): SalesOffer[] {
  return (db().prepare('SELECT * FROM sales_offers WHERE ref_id = ? ORDER BY id DESC').all(refId) as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id), refKind: String(r.ref_kind) as SalesItemKind, refId: Number(r.ref_id),
    product: String(r.product), price: Number(r.price), discount: Number(r.discount), final: Number(r.final),
    approvalNeeded: Boolean(r.approval_needed), approvalStatus: String(r.approval_status),
    createdBy: String(r.created_by), at: String(r.at),
  }));
}

export function createSalesOffer(input: { refId: number; product?: string; price?: number; discount?: number }, actor: AdminAuthActor): SalesOffer {
  ensureSalesSchema();
  const item = getSalesItem(input.refId); if (!item) throw new Error('یافت نشد');
  const product = String(input.product || item.product);
  const price = Math.round(Number(input.price ?? item.value) || 0);
  const discount = Math.max(0, Number(input.discount) || 0);
  const approvalNeeded = discount > discountLimitFor(actor);
  const final = Math.round(price * (1 - discount / 100));
  const info = db().prepare(`INSERT INTO sales_offers (ref_kind, ref_id, product, price, discount, final, approval_needed, approval_status, created_by, at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    item.kind, item.id, product, price, discount, final, approvalNeeded ? 1 : 0,
    approvalNeeded ? 'در انتظار تایید' : '—', actorLabel(actor), nowIso()
  );
  if (!approvalNeeded) {
    db().prepare(`UPDATE sales_items SET discount = ?, value = ?, stage = CASE WHEN CAST(stage AS INTEGER) < 5 THEN '5' ELSE stage END, last_activity = ? WHERE id = ?`)
      .run(discount, final, nowIso(), item.id);
  }
  addActivity(item.id, `پیشنهاد ${product} با ${discount}٪ تخفیف (${approvalNeeded ? 'نیاز به تایید' : 'اعمال‌شده'})`, 'offer');
  return listOffersForItem(item.id).find((o) => o.id === Number(info.lastInsertRowid))!;
}

export function decideSalesOffer(offerId: number, approve: boolean, actor: AdminAuthActor): SalesOffer {
  if (!isSalesAdmin(actor)) throw new Error('فقط سرپرست می‌تواند تخفیف را تایید کند');
  ensureSalesSchema();
  const row = db().prepare('SELECT * FROM sales_offers WHERE id = ?').get(offerId) as Record<string, unknown> | undefined;
  if (!row) throw new Error('پیشنهاد یافت نشد');
  const status = approve ? 'تاییدشده' : 'رد شده';
  db().prepare('UPDATE sales_offers SET approval_status = ? WHERE id = ?').run(status, offerId);
  if (approve) {
    db().prepare(`UPDATE sales_items SET discount = ?, value = ?, stage = CASE WHEN CAST(stage AS INTEGER) < 5 THEN '5' ELSE stage END, last_activity = ? WHERE id = ?`)
      .run(Number(row.discount), Number(row.final), nowIso(), Number(row.ref_id));
  }
  addActivity(Number(row.ref_id), `تخفیف ${status} توسط ${actorLabel(actor)}`, 'offer');
  return listOffersForItem(Number(row.ref_id)).find((o) => o.id === offerId)!;
}

function getPayment(id: number): SalesPayment | null {
  const r = db().prepare('SELECT * FROM sales_payments WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!r) return null;
  return { id: Number(r.id), refKind: String(r.ref_kind) as SalesItemKind, refId: Number(r.ref_id), amount: Number(r.amount), type: String(r.type), status: String(r.status), at: String(r.at) };
}

export function sendPaymentLink(input: { refId: number; amount?: number; type?: string }, actor: AdminAuthActor): SalesPayment {
  ensureSalesSchema();
  const item = getSalesItem(input.refId); if (!item) throw new Error('یافت نشد');
  const amount = Math.round(Number(input.amount ?? item.value) || 0);
  const type = String(input.type || 'لینک پرداخت کامل');
  const info = db().prepare(`INSERT INTO sales_payments (ref_kind, ref_id, amount, type, status, at) VALUES (?, ?, ?, ?, 'لینک ارسال‌شده', ?)`)
    .run(item.kind, item.id, amount, type, nowIso());
  db().prepare(`UPDATE sales_items SET pay_status = 'لینک ارسال‌شده', pay_type = ?, stage = CASE WHEN CAST(stage AS INTEGER) < 6 THEN '6' ELSE stage END, last_activity = ? WHERE id = ?`)
    .run(type, nowIso(), item.id);
  db().prepare(`INSERT INTO sales_messages (ref_kind, ref_id, channel, pattern_id, pattern_name, text, at, by_user)
     VALUES (?, ?, 'پیامک', NULL, 'لینک پرداخت', ?, ?, ?)`)
    .run(item.kind, item.id, `لینک پرداخت ${amount.toLocaleString('fa-IR')} تومان برای ${item.first}`, nowIso(), actorLabel(actor));
  addActivity(item.id, `لینک پرداخت ارسال شد (${amount.toLocaleString('fa-IR')} تومان)`, 'payment');
  return getPayment(Number(info.lastInsertRowid))!;
}

function getTicket(id: number): SalesTicket | null {
  const r = db().prepare('SELECT * FROM sales_tickets WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    id: Number(r.id), publicId: makeSalesTicketPublicId(Number(r.id)),
    refKind: r.ref_kind != null ? (String(r.ref_kind) as SalesItemKind) : null,
    refId: r.ref_id != null ? Number(r.ref_id) : null,
    customerId: r.customer_id != null ? Number(r.customer_id) : null,
    paymentId: r.payment_id != null ? Number(r.payment_id) : null,
    title: String(r.title), dept: String(r.dept), cat: String(r.cat), priority: String(r.priority),
    status: String(r.status), createdAt: String(r.created_at), slaDue: String(r.sla_due),
    desc: String(r.desc_text || ''), agentId: String(r.agent_id || ''),
  };
}

export function sendFinanceInquiry(paymentId: number, actor: AdminAuthActor): SalesTicket {
  ensureSalesSchema();
  const payment = getPayment(paymentId); if (!payment) throw new Error('پرداخت یافت نشد');
  db().prepare(`UPDATE sales_payments SET status = 'در حال بررسی مالی' WHERE id = ?`).run(paymentId);
  db().prepare(`UPDATE sales_items SET pay_status = 'در حال بررسی مالی', last_activity = ? WHERE id = ?`).run(nowIso(), payment.refId);
  const due = new Date(Date.now() + slaHours('بالا') * 3600_000).toISOString();
  const info = db().prepare(`INSERT INTO sales_tickets (ref_kind, ref_id, payment_id, title, dept, cat, priority, status, created_at, sla_due, desc_text, agent_id)
     VALUES (?, ?, ?, ?, 'مالی', 'استعلام مالی', 'بالا', 'جدید', ?, ?, ?, ?)`)
    .run(payment.refKind, payment.refId, paymentId, `استعلام مالی #${paymentId}`, nowIso(), due, `مبلغ ${payment.amount}`, actorId(actor));
  addActivity(payment.refId, `استعلام مالی ارسال شد توسط ${actorLabel(actor)}`, 'finance');
  return getTicket(Number(info.lastInsertRowid))!;
}

function markWon(itemId: number, actor: AdminAuthActor): SalesItem {
  const item = getSalesItem(itemId); if (!item) throw new Error('یافت نشد');
  if (item.kind === 'lead') {
    const custInfo = db().prepare(`INSERT INTO sales_customers (first_name, last_name, mobile, email, level, sales_owner, created_at, source_lead_id)
       VALUES (?, ?, ?, ?, 'عادی', ?, ?, ?)`).run(item.first, item.last, item.mobile, item.email, item.ownerName || actorLabel(actor), nowIso(), item.id);
    const customerId = Number(custInfo.lastInsertRowid);
    db().prepare('INSERT INTO sales_orders (customer_id, product, amount, at) VALUES (?, ?, ?, ?)').run(customerId, item.product, item.value, nowIso());
    db().prepare(`UPDATE sales_items SET stage = '7', customer_id = ?, pay_status = 'پرداخت‌شده', last_activity = ? WHERE id = ?`).run(customerId, nowIso(), item.id);
    db().prepare(`INSERT INTO sales_items (
        kind, first_name, last_name, mobile, email, product, source, score,
        owner_id, owner_name, stage, value, discount, created_at, last_activity, customer_id, pay_status
      ) VALUES ('upgrade', ?, ?, ?, ?, ?, 'امور فروش', 60, NULL, NULL, '0', ?, 0, ?, ?, ?, 'بدون پرداخت')`)
      .run(item.first, item.last, item.mobile, item.email, item.product, Math.round(item.value * 0.3), nowIso(), nowIso(), customerId);
    addActivity(item.id, `فروش برنده — مشتری ${makeSalesCustomerPublicId(customerId)} ساخته شد`, 'finance');
  } else {
    const customerId = item.customerId;
    if (customerId) {
      db().prepare('INSERT INTO sales_orders (customer_id, product, amount, at) VALUES (?, ?, ?, ?)').run(customerId, item.product, item.value, nowIso());
      db().prepare(`UPDATE sales_customers SET level = CASE WHEN level = 'عادی' THEN 'نقره‌ای' ELSE level END WHERE id = ?`).run(customerId);
    }
    db().prepare(`UPDATE sales_items SET stage = '7', pay_status = 'پرداخت‌شده', last_activity = ? WHERE id = ?`).run(nowIso(), item.id);
    addActivity(item.id, 'آپگرید برنده توسط تایید مالی', 'finance');
  }
  return getSalesItem(itemId)!;
}

export function financeDecide(paymentId: number, approve: boolean, actor: AdminAuthActor): { payment: SalesPayment; item: SalesItem | null } {
  if (!isSalesAdmin(actor)) throw new Error('فقط سرپرست/مدیر می‌تواند استعلام مالی را تایید کند');
  ensureSalesSchema();
  const payment = getPayment(paymentId); if (!payment) throw new Error('پرداخت یافت نشد');
  if (approve) {
    db().prepare(`UPDATE sales_payments SET status = 'پرداخت‌شده' WHERE id = ?`).run(paymentId);
    db().prepare(`UPDATE sales_tickets SET status = 'حل‌شده' WHERE payment_id = ? AND cat = 'استعلام مالی'`).run(paymentId);
    return { payment: getPayment(paymentId)!, item: markWon(payment.refId, actor) };
  }
  db().prepare(`UPDATE sales_payments SET status = 'رد شده مالی' WHERE id = ?`).run(paymentId);
  db().prepare(`UPDATE sales_items SET pay_status = 'رد شده مالی', last_activity = ? WHERE id = ?`).run(nowIso(), payment.refId);
  db().prepare(`UPDATE sales_tickets SET status = 'رد شده' WHERE payment_id = ? AND cat = 'استعلام مالی'`).run(paymentId);
  addActivity(payment.refId, `استعلام مالی رد شد توسط ${actorLabel(actor)}`, 'finance');
  return { payment: getPayment(paymentId)!, item: getSalesItem(payment.refId) };
}

export function listSalesTickets(opts?: { cat?: string; status?: string }): SalesTicket[] {
  ensureSalesSchema();
  const where: string[] = []; const params: unknown[] = [];
  if (opts?.cat) { where.push('cat = ?'); params.push(opts.cat); }
  if (opts?.status) { where.push('status = ?'); params.push(opts.status); }
  const sql = `SELECT * FROM sales_tickets ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT 200`;
  return (db().prepare(sql).all(...params) as Array<Record<string, unknown>>).map((r) => getTicket(Number(r.id))!);
}

export function createSalesTicket(input: {
  title: string; dept?: string; cat?: string; priority?: string; desc?: string;
  refKind?: SalesItemKind | null; refId?: number | null; customerId?: number | null;
}, actor: AdminAuthActor): SalesTicket {
  ensureSalesSchema();
  const priority = input.priority || 'متوسط';
  const due = new Date(Date.now() + slaHours(priority) * 3600_000).toISOString();
  const info = db().prepare(`INSERT INTO sales_tickets (ref_kind, ref_id, customer_id, title, dept, cat, priority, status, created_at, sla_due, desc_text, agent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'جدید', ?, ?, ?, ?)`).run(
    input.refKind ?? null, input.refId ?? null, input.customerId ?? null,
    String(input.title || '').trim() || 'تیکت', input.dept || 'سایر', input.cat || 'سایر',
    priority, nowIso(), due, input.desc || '', actorId(actor)
  );
  return getTicket(Number(info.lastInsertRowid))!;
}

export function updateSalesTicketStatus(id: number, status: string): SalesTicket {
  ensureSalesSchema();
  db().prepare('UPDATE sales_tickets SET status = ? WHERE id = ?').run(status, id);
  const t = getTicket(id); if (!t) throw new Error('تیکت یافت نشد'); return t;
}

function enrichCustomer(row: Record<string, unknown>): SalesCustomer {
  const id = Number(row.id);
  const orders = db().prepare('SELECT amount, at FROM sales_orders WHERE customer_id = ? ORDER BY at DESC').all(id) as Array<{ amount: number; at: string }>;
  const orderSum = orders.reduce((s, o) => s + Number(o.amount), 0);
  const lastOrderAt = orders[0]?.at || null;
  const daysSince = lastOrderAt ? Math.floor((Date.now() - new Date(lastOrderAt).getTime()) / 86_400_000) : null;
  const openTickets = Number((db().prepare(`SELECT COUNT(*) as c FROM sales_tickets WHERE customer_id = ? AND status IN ('جدید','در حال بررسی')`).get(id) as { c: number }).c);
  return {
    id, publicId: makeSalesCustomerPublicId(id),
    first: String(row.first_name || ''), last: String(row.last_name || ''),
    mobile: String(row.mobile || ''), email: row.email != null ? String(row.email) : null,
    level: String(row.level || 'عادی'), salesOwner: String(row.sales_owner || ''),
    createdAt: String(row.created_at), csat: row.csat != null ? Number(row.csat) : null,
    sourceLeadId: row.source_lead_id != null ? Number(row.source_lead_id) : null,
    orderSum, orderCount: orders.length, lastOrderAt, daysSinceLastPurchase: daysSince, openTickets,
  };
}

export function listSalesCustomers(opts?: { q?: string }): { total: number; customers: SalesCustomer[] } {
  ensureSalesSchema();
  const params: unknown[] = []; let where = '';
  if (opts?.q?.trim()) {
    where = 'WHERE first_name LIKE ? OR last_name LIKE ? OR mobile LIKE ?';
    const like = `%${opts.q.trim()}%`; params.push(like, like, like);
  }
  const total = Number((db().prepare(`SELECT COUNT(*) as c FROM sales_customers ${where}`).get(...params) as { c: number }).c);
  const rows = db().prepare(`SELECT * FROM sales_customers ${where} ORDER BY id DESC LIMIT 100`).all(...params) as Array<Record<string, unknown>>;
  return { total, customers: rows.map(enrichCustomer) };
}

export function getSalesCustomer(id: number): {
  customer: SalesCustomer; orders: SalesOrder[]; tickets: SalesTicket[]; upgrades: SalesItem[]; surveys: SalesSurvey[];
} | null {
  ensureSalesSchema();
  const row = db().prepare('SELECT * FROM sales_customers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const orders = (db().prepare('SELECT * FROM sales_orders WHERE customer_id = ? ORDER BY at DESC').all(id) as Array<Record<string, unknown>>)
    .map((o) => ({ id: Number(o.id), customerId: Number(o.customer_id), product: String(o.product), amount: Number(o.amount), at: String(o.at) }));
  const tickets = listSalesTickets().filter((t) => t.customerId === id);
  const upgrades = listSalesItems({ kind: 'upgrade', limit: 50 }).items.filter((i) => i.customerId === id);
  const surveys = (db().prepare('SELECT * FROM sales_surveys WHERE customer_id = ? ORDER BY at DESC').all(id) as Array<Record<string, unknown>>)
    .map((s) => ({ id: Number(s.id), customerId: Number(s.customer_id), score: Number(s.score), comment: String(s.comment || ''), channel: String(s.channel), at: String(s.at) }));
  return { customer: enrichCustomer(row), orders, tickets, upgrades, surveys };
}

export function createSalesSurvey(input: { customerId: number; score: number; comment?: string; channel?: string }, _actor: AdminAuthActor): SalesSurvey {
  ensureSalesSchema();
  const score = Math.min(5, Math.max(1, Math.round(Number(input.score) || 1)));
  const info = db().prepare(`INSERT INTO sales_surveys (customer_id, score, comment, channel, at) VALUES (?, ?, ?, ?, ?)`)
    .run(input.customerId, score, input.comment || '', input.channel || 'تماس', nowIso());
  db().prepare('UPDATE sales_customers SET csat = ? WHERE id = ?').run(score, input.customerId);
  return { id: Number(info.lastInsertRowid), customerId: input.customerId, score, comment: input.comment || '', channel: input.channel || 'تماس', at: nowIso() };
}

export function listSalesPatterns(): SalesPattern[] {
  ensureSalesSchema();
  return (db().prepare('SELECT * FROM sales_patterns ORDER BY channel, id').all() as Array<Record<string, unknown>>)
    .map((r) => ({ id: Number(r.id), channel: String(r.channel), name: String(r.name), text: String(r.text), active: Boolean(r.active) }));
}

export function upsertSalesPattern(input: { id?: number; channel: string; name: string; text: string; active?: boolean }): SalesPattern {
  ensureSalesSchema();
  if (input.id) {
    db().prepare('UPDATE sales_patterns SET channel = ?, name = ?, text = ?, active = ? WHERE id = ?')
      .run(input.channel, input.name, input.text, input.active === false ? 0 : 1, input.id);
    return listSalesPatterns().find((p) => p.id === input.id)!;
  }
  const info = db().prepare('INSERT INTO sales_patterns (channel, name, text, active) VALUES (?, ?, ?, ?)')
    .run(input.channel, input.name, input.text, input.active === false ? 0 : 1);
  return listSalesPatterns().find((p) => p.id === Number(info.lastInsertRowid))!;
}

export function sendSalesMessage(input: { refId: number; channel: string; patternId?: number; text?: string }, actor: AdminAuthActor): SalesMessage {
  ensureSalesSchema();
  const item = getSalesItem(input.refId); if (!item) throw new Error('یافت نشد');
  let text = input.text || ''; let patternName = 'سفارشی'; let patternId: number | null = input.patternId ?? null;
  if (patternId) {
    const p = listSalesPatterns().find((x) => x.id === patternId);
    if (p) {
      patternName = p.name;
      text = p.text.replace(/\{نام\}/g, item.first).replace(/\{محصول\}/g, item.product)
        .replace(/\{قیمت\}/g, item.value.toLocaleString('fa-IR')).replace(/\{کارشناس\}/g, actorLabel(actor))
        .replace(/\{تخفیف\}/g, String(item.discount)).replace(/\{لینک_پرداخت\}/g, 'https://petdate.app/pay');
    }
  }
  const info = db().prepare(`INSERT INTO sales_messages (ref_kind, ref_id, channel, pattern_id, pattern_name, text, at, by_user) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(item.kind, item.id, input.channel, patternId, patternName, text, nowIso(), actorLabel(actor));
  addActivity(item.id, `پیام ${input.channel}: ${patternName}`, 'message');
  return { id: Number(info.lastInsertRowid), refKind: item.kind, refId: item.id, channel: input.channel, patternId, patternName, text, at: nowIso(), by: actorLabel(actor) };
}

export function listSalesMessages(refId: number): SalesMessage[] {
  ensureSalesSchema();
  return (db().prepare('SELECT * FROM sales_messages WHERE ref_id = ? ORDER BY id DESC').all(refId) as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id), refKind: String(r.ref_kind) as SalesItemKind, refId: Number(r.ref_id),
    channel: String(r.channel), patternId: r.pattern_id != null ? Number(r.pattern_id) : null,
    patternName: String(r.pattern_name || ''), text: String(r.text), at: String(r.at), by: String(r.by_user || ''),
  }));
}

export function listSalesGoals(): SalesGoal[] {
  ensureSalesSchema();
  return (db().prepare('SELECT * FROM sales_goals ORDER BY id DESC').all() as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id), name: String(r.name), team: String(r.team),
    periodFrom: r.period_from != null ? String(r.period_from) : null,
    periodTo: r.period_to != null ? String(r.period_to) : null,
    active: Boolean(r.active), createdAt: String(r.created_at), createdBy: String(r.created_by || ''),
    metrics: parseJson(r.metrics_json, {}),
  }));
}

export function createSalesGoal(input: {
  name: string; team?: string; periodFrom?: string; periodTo?: string; metrics?: Record<string, number>;
}, actor: AdminAuthActor): SalesGoal {
  if (!isSalesAdmin(actor)) throw new Error('فقط سرپرست می‌تواند هدف تعریف کند');
  ensureSalesSchema();
  const info = db().prepare(`INSERT INTO sales_goals (name, team, period_from, period_to, active, created_at, created_by, metrics_json)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?)`).run(
    String(input.name || '').trim() || 'هدف جدید', input.team || 'همه تیم‌ها',
    input.periodFrom || null, input.periodTo || null, nowIso(), actorLabel(actor), JSON.stringify(input.metrics || {})
  );
  return listSalesGoals().find((g) => g.id === Number(info.lastInsertRowid))!;
}

export function getSalesItemDetail(id: number): {
  item: SalesItem; activities: SalesActivity[]; calls: SalesCall[]; followups: SalesFollowup[];
  offers: SalesOffer[]; payments: SalesPayment[]; messages: SalesMessage[];
} | null {
  ensureSalesSchema();
  const item = getSalesItem(id); if (!item) return null;
  const payments = (db().prepare('SELECT * FROM sales_payments WHERE ref_id = ? ORDER BY id DESC').all(id) as Array<Record<string, unknown>>)
    .map((r) => getPayment(Number(r.id))!);
  return {
    item, activities: listSalesActivities(id),
    calls: listSalesCalls({ limit: 200 }).filter((c) => c.refId === id),
    followups: listSalesFollowups().filter((f) => f.refId === id),
    offers: listOffersForItem(id), payments, messages: listSalesMessages(id),
  };
}

export function getSalesDashboard(actor: AdminAuthActor): SalesDashboard {
  ensureSalesSchema();
  const items = listSalesItems({ limit: 500 }).items;
  const calls = listSalesCalls({ limit: 500 });
  const followups = listSalesFollowups({ openOnly: true });
  const payments = (db().prepare('SELECT * FROM sales_payments').all() as Array<Record<string, unknown>>).map((r) => getPayment(Number(r.id))!);
  const callsToday = calls.filter((c) => isToday(c.startedAt));
  const won = items.filter((i) => i.stage === 7);
  const wonToday = won.filter((i) => isToday(i.lastActivity));
  const activeLeads = items.filter((i) => i.kind === 'lead' && typeof i.stage === 'number' && i.stage < 7);
  const activeUpgrades = items.filter((i) => i.kind === 'upgrade' && typeof i.stage === 'number' && i.stage < 7);
  return {
    greetingName: actorLabel(actor),
    callsToday: callsToday.length,
    callMinutesToday: callsToday.reduce((s, c) => s + c.talk, 0),
    overdueFollowups: followups.filter((f) => new Date(f.at).getTime() < Date.now()).length,
    salesTodayCount: wonToday.length,
    salesTodayValue: wonToday.reduce((s, i) => s + i.value, 0),
    aov: won.length ? Math.round(won.reduce((s, i) => s + i.value, 0) / won.length) : 0,
    activeLeads: activeLeads.length, activeUpgrades: activeUpgrades.length,
    totalWonValue: won.reduce((s, i) => s + i.value, 0),
    pendingFinance: payments.filter((p) => p.status === 'در حال بررسی مالی').length,
    unassigned: items.filter((i) => !i.ownerId && typeof i.stage === 'number' && i.stage < 7).length,
    nextActions: [...activeLeads].sort((a, b) => b.score - a.score).slice(0, 8),
    myFollowups: followups.slice(0, 20),
    stageCounts: Array.from({ length: 8 }, (_, stage) => ({ stage: String(stage), count: items.filter((i) => i.stage === stage).length })),
  };
}

export function getSalesReportSummary(): SalesReportSummary {
  ensureSalesSchema();
  const items = listSalesItems({ limit: 1000 }).items;
  const calls = listSalesCalls({ limit: 1000 });
  const won = items.filter((i) => i.stage === 7);
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0, 10)); }
  const dailyRevenue = days.map((day) => ({ day, value: won.filter((i) => dayKey(i.lastActivity) === day).reduce((s, i) => s + i.value, 0) }));
  const dailyCalls = days.map((day) => ({ day, count: calls.filter((c) => dayKey(c.startedAt) === day).length }));
  const bySourceMap = new Map<string, number>();
  for (const i of won) bySourceMap.set(i.source || 'سایر', (bySourceMap.get(i.source || 'سایر') || 0) + i.value);
  const agentMap = new Map<string, { agentId: string; agentName: string; calls: number; sales: number; revenue: number }>();
  for (const c of calls) {
    const cur = agentMap.get(c.agentId) || { agentId: c.agentId, agentName: c.agentName || c.agentId, calls: 0, sales: 0, revenue: 0 };
    cur.calls += 1; agentMap.set(c.agentId, cur);
  }
  for (const i of won) {
    const id = i.ownerId || '—';
    const cur = agentMap.get(id) || { agentId: id, agentName: i.ownerName || id, calls: 0, sales: 0, revenue: 0 };
    cur.sales += 1; cur.revenue += i.value; agentMap.set(id, cur);
  }
  return {
    aov: won.length ? Math.round(won.reduce((s, i) => s + i.value, 0) / won.length) : 0,
    revenue: won.reduce((s, i) => s + i.value, 0), salesCount: won.length,
    callsCount: calls.length, callMinutes: calls.reduce((s, c) => s + c.talk, 0),
    dailyRevenue, dailyCalls,
    bySource: [...bySourceMap.entries()].map(([source, value]) => ({ source, value })),
    byAgent: [...agentMap.values()],
  };
}

export function getSalesPipeline(): { stages: { stage: number | 'lost'; label: string; items: SalesItem[]; value: number }[] } {
  ensureSalesSchema();
  const items = listSalesItems({ limit: 500 }).items;
  const stages = SALES_STAGES.map((label, stage) => {
    const bucket = items.filter((i) => i.stage === stage);
    return { stage: stage as number | 'lost', label, items: bucket.slice(0, 20), value: bucket.reduce((s, i) => s + i.value, 0) };
  });
  const lost = items.filter((i) => i.stage === 'lost');
  stages.push({ stage: 'lost', label: 'ازدست‌رفته', items: lost.slice(0, 20), value: lost.reduce((s, i) => s + i.value, 0) });
  return { stages };
}

// silence unused helper in TS builds
void stageToDb;
