/**
 * Persisted admin-ops: IP bans, login signals, mail outbox, calendar buckets.
 */
import { getDb } from './db';
import {
  detectBot,
  detectFrequentLogin,
  type LoginEvent,
} from '@petdate/shared';

function db() {
  return getDb();
}

function columnNames(table: string): Set<string> {
  try {
    const rows = db().prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return new Set(rows.map((r) => String(r.name)));
  } catch {
    return new Set();
  }
}

export function ensureColumn(table: string, column: string, ddl: string): void {
  const cols = columnNames(table);
  if (!cols.size || cols.has(column)) return;
  db().exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

export function ensureAdminOpsSchema(): void {
  const d = db();
  d.exec(`
    CREATE TABLE IF NOT EXISTS admin_ip_bans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL UNIQUE,
      reason TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS admin_login_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL DEFAULT (datetime('now')),
      ip TEXT NOT NULL DEFAULT '',
      username TEXT NOT NULL DEFAULT '',
      ok INTEGER NOT NULL DEFAULT 0,
      user_agent TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS admin_mail_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_addr TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'admin_send',
      status TEXT NOT NULL DEFAULT 'queued',
      error TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      sent_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sales_call_listen (
      call_id INTEGER PRIMARY KEY,
      live_listen INTEGER NOT NULL DEFAULT 0,
      recording_url TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sales_call_qa_cards (
      call_id INTEGER PRIMARY KEY,
      dir TEXT NOT NULL DEFAULT 'call_out',
      scores_json TEXT NOT NULL DEFAULT '[]',
      total INTEGER,
      agent_id TEXT NOT NULL DEFAULT '',
      evaluated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  ensureColumn('shop_categories', 'parent_slug', "parent_slug TEXT NOT NULL DEFAULT ''");
  ensureColumn('shop_categories', 'redirect_slug', "redirect_slug TEXT NOT NULL DEFAULT ''");
  ensureColumn('shop_brands', 'category_slugs', "category_slugs TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('shop_orders', 'shipping_carrier', "shipping_carrier TEXT NOT NULL DEFAULT ''");
  ensureColumn('shop_orders', 'tracking_code', "tracking_code TEXT NOT NULL DEFAULT ''");
  ensureColumn('shop_orders', 'payment_actor', "payment_actor TEXT NOT NULL DEFAULT ''");
  ensureColumn('shop_orders', 'paid_final', 'paid_final INTEGER NOT NULL DEFAULT 0');
  ensureColumn('shop_orders', 'payment_status', "payment_status TEXT NOT NULL DEFAULT ''");
  ensureColumn('sales_customers', 'conversion_path', "conversion_path TEXT NOT NULL DEFAULT ''");
  ensureColumn('sales_followups', 'parent_id', 'parent_id INTEGER');
  ensureColumn('sales_followups', 'note', "note TEXT NOT NULL DEFAULT ''");
  ensureColumn('sales_items', 'failure_outcome', "failure_outcome TEXT NOT NULL DEFAULT ''");
  ensureColumn('magazine_articles', 'primary_keyword', "primary_keyword TEXT NOT NULL DEFAULT ''");
  ensureColumn('magazine_articles', 'secondary_keyword', "secondary_keyword TEXT NOT NULL DEFAULT ''");
  ensureColumn('sales_calls', 'customer_score', 'customer_score INTEGER');
  ensureColumn('sales_tickets', 'reason', "reason TEXT NOT NULL DEFAULT ''");
  ensureColumn('sales_products', 'campaign', "campaign TEXT NOT NULL DEFAULT ''");
  ensureColumn('sales_products', 'discount_code', "discount_code TEXT NOT NULL DEFAULT ''");
  ensureColumn('sales_products', 'created_by', "created_by TEXT NOT NULL DEFAULT ''");
}

export type IpBan = { id: number; ip: string; reason: string; createdBy: string; createdAt: string };

export function listIpBans(): IpBan[] {
  ensureAdminOpsSchema();
  return (db().prepare('SELECT * FROM admin_ip_bans ORDER BY id DESC').all() as Array<Record<string, unknown>>).map(
    (r) => ({
      id: Number(r.id),
      ip: String(r.ip),
      reason: String(r.reason || ''),
      createdBy: String(r.created_by || ''),
      createdAt: String(r.created_at || ''),
    })
  );
}

export function upsertIpBan(ip: string, reason: string, createdBy: string): IpBan {
  ensureAdminOpsSchema();
  const clean = ip.trim();
  if (!clean) throw new Error('IP الزامی است');
  db()
    .prepare(
      `INSERT INTO admin_ip_bans (ip, reason, created_by) VALUES (?, ?, ?)
       ON CONFLICT(ip) DO UPDATE SET reason = excluded.reason, created_by = excluded.created_by`
    )
    .run(clean, reason.slice(0, 300), createdBy);
  return listIpBans().find((b) => b.ip === clean)!;
}

export function deleteIpBan(id: number): boolean {
  ensureAdminOpsSchema();
  return db().prepare('DELETE FROM admin_ip_bans WHERE id = ?').run(id).changes > 0;
}

export function isIpBanned(ip: string): boolean {
  ensureAdminOpsSchema();
  const row = db().prepare('SELECT id FROM admin_ip_bans WHERE ip = ?').get(ip.trim()) as { id: number } | undefined;
  return Boolean(row);
}

export function recordLoginEvent(input: {
  ip: string;
  username?: string;
  ok: boolean;
  userAgent?: string;
}): void {
  ensureAdminOpsSchema();
  db()
    .prepare('INSERT INTO admin_login_events (ip, username, ok, user_agent) VALUES (?, ?, ?, ?)')
    .run(input.ip || '', input.username || '', input.ok ? 1 : 0, (input.userAgent || '').slice(0, 300));
}

export function securitySnapshot(opts?: { userAgent?: string }): {
  frequent: ReturnType<typeof detectFrequentLogin>;
  bot: ReturnType<typeof detectBot>;
  bans: IpBan[];
} {
  ensureAdminOpsSchema();
  const rows = db()
    .prepare('SELECT at, ip, ok, username FROM admin_login_events ORDER BY id DESC LIMIT 400')
    .all() as Array<Record<string, unknown>>;
  const events: LoginEvent[] = rows.map((r) => ({
    at: String(r.at),
    ip: String(r.ip),
    ok: Boolean(r.ok),
    username: String(r.username || ''),
  }));
  const fails = events.filter((e) => !e.ok).length;
  return {
    frequent: detectFrequentLogin(events),
    bot: detectBot({ userAgent: opts?.userAgent, failStreak: fails }),
    bans: listIpBans(),
  };
}

export type OutboxRow = {
  id: number;
  to: string;
  subject: string;
  body: string;
  purpose: string;
  status: string;
  error: string;
  createdBy: string;
  createdAt: string;
  sentAt: string | null;
};

export function queueMail(input: {
  to: string;
  subject: string;
  body: string;
  purpose?: string;
  createdBy?: string;
}): OutboxRow {
  ensureAdminOpsSchema();
  const info = db()
    .prepare(
      `INSERT INTO admin_mail_outbox (to_addr, subject, body, purpose, status, created_by)
       VALUES (?, ?, ?, ?, 'queued', ?)`
    )
    .run(input.to, input.subject, input.body, input.purpose || 'admin_send', input.createdBy || '');
  return getOutbox(Number(info.lastInsertRowid))!;
}

function getOutbox(id: number): OutboxRow | null {
  const r = db().prepare('SELECT * FROM admin_mail_outbox WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    id: Number(r.id),
    to: String(r.to_addr),
    subject: String(r.subject),
    body: String(r.body),
    purpose: String(r.purpose),
    status: String(r.status),
    error: String(r.error || ''),
    createdBy: String(r.created_by || ''),
    createdAt: String(r.created_at),
    sentAt: r.sent_at != null ? String(r.sent_at) : null,
  };
}

export function listOutbox(limit = 40): OutboxRow[] {
  ensureAdminOpsSchema();
  return (
    db().prepare('SELECT * FROM admin_mail_outbox ORDER BY id DESC LIMIT ?').all(Math.min(limit, 100)) as Array<
      Record<string, unknown>
    >
  ).map((r) => getOutbox(Number(r.id))!);
}

export function markOutbox(id: number, status: 'sent' | 'failed' | 'queued', error = ''): OutboxRow | null {
  ensureAdminOpsSchema();
  db()
    .prepare(
      `UPDATE admin_mail_outbox SET status = ?, error = ?, sent_at = CASE WHEN ? = 'sent' THEN datetime('now') ELSE sent_at END WHERE id = ?`
    )
    .run(status, error.slice(0, 300), status, id);
  return getOutbox(id);
}

export function calendarBuckets(fromIso: string, toIso: string): Record<string, { orders: number; registrations: number; emails: number }> {
  ensureAdminOpsSchema();
  const out: Record<string, { orders: number; registrations: number; emails: number }> = {};
  const bump = (day: string, key: 'orders' | 'registrations' | 'emails') => {
    if (!day || day < fromIso || day > toIso) return;
    if (!out[day]) out[day] = { orders: 0, registrations: 0, emails: 0 };
    out[day][key] += 1;
  };
  const d = db();
  try {
    const orders = d
      .prepare(`SELECT substr(created_at, 1, 10) AS day FROM shop_orders WHERE substr(created_at, 1, 10) BETWEEN ? AND ?`)
      .all(fromIso, toIso) as Array<{ day: string }>;
    for (const r of orders) bump(r.day, 'orders');
  } catch {
    /* table optional in tiny fixtures */
  }
  try {
    const users = d
      .prepare(`SELECT substr(created_at, 1, 10) AS day FROM users WHERE substr(created_at, 1, 10) BETWEEN ? AND ?`)
      .all(fromIso, toIso) as Array<{ day: string }>;
    for (const r of users) bump(r.day, 'registrations');
  } catch {
    /* ignore */
  }
  try {
    const mails = d
      .prepare(
        `SELECT substr(created_at, 1, 10) AS day FROM email_send_logs WHERE substr(created_at, 1, 10) BETWEEN ? AND ?`
      )
      .all(fromIso, toIso) as Array<{ day: string }>;
    for (const r of mails) bump(r.day, 'emails');
  } catch {
    /* ignore */
  }
  try {
    const inbox = d
      .prepare(
        `SELECT substr(created_at, 1, 10) AS day FROM admin_mail_outbox WHERE substr(created_at, 1, 10) BETWEEN ? AND ?`
      )
      .all(fromIso, toIso) as Array<{ day: string }>;
    for (const r of inbox) bump(r.day, 'emails');
  } catch {
    /* ignore */
  }
  return out;
}

export function saveCallListen(callId: number, patch: { liveListen?: boolean; recordingUrl?: string }): {
  callId: number;
  liveListen: boolean;
  recordingUrl: string;
} {
  ensureAdminOpsSchema();
  const cur = db().prepare('SELECT * FROM sales_call_listen WHERE call_id = ?').get(callId) as
    | Record<string, unknown>
    | undefined;
  const live = patch.liveListen != null ? (patch.liveListen ? 1 : 0) : Number(cur?.live_listen || 0);
  const url = patch.recordingUrl != null ? patch.recordingUrl : String(cur?.recording_url || '');
  db()
    .prepare(
      `INSERT INTO sales_call_listen (call_id, live_listen, recording_url, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(call_id) DO UPDATE SET live_listen = excluded.live_listen, recording_url = excluded.recording_url, updated_at = datetime('now')`
    )
    .run(callId, live, url);
  return { callId, liveListen: Boolean(live), recordingUrl: url };
}

export function getCallListen(callId: number): { liveListen: boolean; recordingUrl: string } {
  ensureAdminOpsSchema();
  const cur = db().prepare('SELECT * FROM sales_call_listen WHERE call_id = ?').get(callId) as
    | Record<string, unknown>
    | undefined;
  return { liveListen: Boolean(cur?.live_listen), recordingUrl: String(cur?.recording_url || '') };
}

export function saveCallQaCard(input: {
  callId: number;
  dir: string;
  scores: number[];
  total: number | null;
  agentId: string;
}): void {
  ensureAdminOpsSchema();
  db()
    .prepare(
      `INSERT INTO sales_call_qa_cards (call_id, dir, scores_json, total, agent_id, evaluated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(call_id) DO UPDATE SET scores_json = excluded.scores_json, total = excluded.total, dir = excluded.dir, agent_id = excluded.agent_id, evaluated_at = datetime('now')`
    )
    .run(input.callId, input.dir, JSON.stringify(input.scores), input.total, input.agentId);
}

export function listCallQaCards(): Array<{ callId: number; total: number | null; agentId: string; scores: number[] }> {
  ensureAdminOpsSchema();
  return (
    db().prepare('SELECT * FROM sales_call_qa_cards').all() as Array<Record<string, unknown>>
  ).map((r) => ({
    callId: Number(r.call_id),
    total: r.total != null ? Number(r.total) : null,
    agentId: String(r.agent_id || ''),
    scores: (() => {
      try {
        const p = JSON.parse(String(r.scores_json || '[]'));
        return Array.isArray(p) ? p.map(Number) : [];
      } catch {
        return [];
      }
    })(),
  }));
}
