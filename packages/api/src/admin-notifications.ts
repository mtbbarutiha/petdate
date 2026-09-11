/**
 * Admin header notifications — additive `admin_notifications` table +
 * live aggregation from HR cockpit, open sales tickets, and mail unread.
 * Never wipes existing data; seed is idempotent via source_key.
 */
import { getDb } from './db';
import { actorHasPermission, type AdminAuthActor } from './hr-service';
import * as hrMod from './hr-modules';
import type { AdminHeaderNotification, AdminNotificationKind } from '@petdate/shared';

function db() {
  return getDb();
}

export function ensureAdminNotificationsSchema(): void {
  const d = db();
  d.exec(`
    CREATE TABLE IF NOT EXISTS admin_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'info',
      href TEXT NOT NULL DEFAULT '/admin/dashboard',
      module TEXT NOT NULL DEFAULT 'platform',
      permission TEXT,
      source_key TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_notif_source_key
      ON admin_notifications(source_key) WHERE source_key IS NOT NULL AND source_key != '';
    CREATE INDEX IF NOT EXISTS idx_admin_notif_read_created
      ON admin_notifications(read, created_at DESC);

    CREATE TABLE IF NOT EXISTS admin_notification_dismissals (
      actor_key TEXT NOT NULL,
      notif_key TEXT NOT NULL,
      dismissed_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (actor_key, notif_key)
    );
  `);
  seedAdminNotificationsIfEmpty();
}

const SEED_ROWS: Array<{
  sourceKey: string;
  title: string;
  body: string;
  kind: AdminNotificationKind;
  href: string;
  module: AdminHeaderNotification['module'];
  permission: string | null;
}> = [
  {
    sourceKey: 'seed:hr-cockpit',
    title: 'کارتابل منابع انسانی',
    body: 'اعلان‌های قرارداد و ATS در کارتابل فعالیت آمادهٔ بررسی‌اند.',
    kind: 'warn',
    href: '/admin/hr/cockpit',
    module: 'hr',
    permission: 'hr.read',
  },
  {
    sourceKey: 'seed:sales-tickets',
    title: 'تیکت‌های فروش',
    body: 'تیکت‌های باز فروش و استعلام مالی را در صف تیکتینگ ببینید.',
    kind: 'info',
    href: '/admin/sales/tickets',
    module: 'sales',
    permission: 'sales.read',
  },
  {
    sourceKey: 'seed:mail-inbox',
    title: 'صندوق ایمیل ادمین',
    body: 'پیام‌های خوانده‌نشدهٔ SMTP/اینباکس را بررسی کنید.',
    kind: 'info',
    href: '/admin/mail',
    module: 'mail',
    permission: 'platform.read',
  },
  {
    sourceKey: 'seed:platform-welcome',
    title: 'خوش آمدید به پنل پیوند',
    body: 'اعلان‌های مهم پلتفرم از اینجا در هدر نمایش داده می‌شوند.',
    kind: 'success',
    href: '/admin/dashboard',
    module: 'platform',
    permission: null,
  },
];

export function seedAdminNotificationsIfEmpty(): void {
  ensureTablesOnly();
  const insert = db().prepare(
    `INSERT OR IGNORE INTO admin_notifications
      (title, body, kind, href, module, permission, source_key, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now', ?))`
  );
  // Always upsert seed keys (idempotent) so header is never blank on fresh DBs
  // and re-deploy doesn't duplicate. Offsets stagger dates for UX ordering.
  SEED_ROWS.forEach((row, i) => {
    insert.run(
      row.title,
      row.body,
      row.kind,
      row.href,
      row.module,
      row.permission,
      row.sourceKey,
      `-${i + 1} hours`
    );
  });
}

function ensureTablesOnly(): void {
  db().exec(`
    CREATE TABLE IF NOT EXISTS admin_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'info',
      href TEXT NOT NULL DEFAULT '/admin/dashboard',
      module TEXT NOT NULL DEFAULT 'platform',
      permission TEXT,
      source_key TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_notif_source_key
      ON admin_notifications(source_key) WHERE source_key IS NOT NULL AND source_key != '';
    CREATE TABLE IF NOT EXISTS admin_notification_dismissals (
      actor_key TEXT NOT NULL,
      notif_key TEXT NOT NULL,
      dismissed_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (actor_key, notif_key)
    );
  `);
}

function actorKey(actor: AdminAuthActor): string {
  return (actor.username || actor.displayName || actor.role || 'admin').trim() || 'admin';
}

function canSee(actor: AdminAuthActor, permission: string | null | undefined): boolean {
  if (!permission) return true;
  return actorHasPermission(actor, permission as never) || actorHasPermission(actor, 'admin.full');
}

function isDismissed(actor: AdminAuthActor, notifKey: string): boolean {
  const row = db()
    .prepare(
      'SELECT 1 AS ok FROM admin_notification_dismissals WHERE actor_key = ? AND notif_key = ?'
    )
    .get(actorKey(actor), notifKey) as { ok?: number } | undefined;
  return Boolean(row?.ok);
}

function dismiss(actor: AdminAuthActor, notifKey: string): void {
  db()
    .prepare(
      `INSERT OR IGNORE INTO admin_notification_dismissals (actor_key, notif_key)
       VALUES (?, ?)`
    )
    .run(actorKey(actor), notifKey);
}

function mapDbRow(row: Record<string, unknown>): AdminHeaderNotification {
  const kind = String(row.kind || 'info') as AdminNotificationKind;
  return {
    id: `db:${Number(row.id)}`,
    title: String(row.title || ''),
    body: String(row.body || ''),
    kind: ['info', 'success', 'warn', 'bad'].includes(kind) ? kind : 'info',
    href: String(row.href || '/admin/dashboard'),
    module: (String(row.module || 'platform') as AdminHeaderNotification['module']) || 'platform',
    date: String(row.created_at || ''),
    read: Number(row.read || 0) === 1,
    canMarkRead: true,
  };
}

function listDbNotifications(actor: AdminAuthActor): AdminHeaderNotification[] {
  const rows = db()
    .prepare('SELECT * FROM admin_notifications ORDER BY id DESC LIMIT 80')
    .all() as Record<string, unknown>[];
  return rows
    .filter((r) => canSee(actor, r.permission != null ? String(r.permission) : null))
    .map(mapDbRow);
}

function listHrLive(actor: AdminAuthActor): AdminHeaderNotification[] {
  if (!canSee(actor, 'hr.read')) return [];
  try {
    return hrMod
      .listNotifications({ unreadOnly: true })
      .slice(0, 12)
      .map((n) => ({
        id: `hr:${n.id}`,
        title: n.text.slice(0, 80) || 'اعلان منابع انسانی',
        body: n.text,
        kind: n.kind,
        href: '/admin/hr/cockpit',
        module: 'hr' as const,
        date: n.date,
        read: false,
        canMarkRead: true,
      }));
  } catch {
    return [];
  }
}

function listSalesLive(actor: AdminAuthActor): AdminHeaderNotification[] {
  if (!canSee(actor, 'sales.read')) return [];
  if (isDismissed(actor, 'live:sales-open')) return [];
  try {
    const open = Number(
      (
        db()
          .prepare(
            `SELECT COUNT(*) as c FROM sales_tickets
             WHERE status IN ('جدید','در حال بررسی')`
          )
          .get() as { c: number } | undefined
      )?.c ?? 0
    );
    if (open <= 0) return [];
    return [
      {
        id: 'live:sales-open',
        title: `${open} تیکت باز فروش`,
        body: 'تیکت‌های جدید یا در حال بررسی در صف فروش.',
        kind: 'warn',
        href: '/admin/sales/tickets',
        module: 'sales',
        date: new Date().toISOString(),
        read: false,
        canMarkRead: true,
      },
    ];
  } catch {
    return [];
  }
}

function listMailLive(actor: AdminAuthActor): Promise<AdminHeaderNotification[]> {
  if (!canSee(actor, 'platform.read')) return Promise.resolve([]);
  if (isDismissed(actor, 'live:mail-unread')) return Promise.resolve([]);
  return (async () => {
    try {
      const mail = await import('./services/mail-inbox');
      if (!mail.isInboxConfigured()) return [];
      const messages = await mail.listInboxMessages(40);
      const unread = messages.filter((m) => m.unread).length;
      if (unread <= 0) return [];
      return [
        {
          id: 'live:mail-unread',
          title: `${unread} ایمیل خوانده‌نشده`,
          body: 'صندوق ورودی ادمین پیام جدید دارد.',
          kind: 'info' as const,
          href: '/admin/mail',
          module: 'mail' as const,
          date: new Date().toISOString(),
          read: false,
          canMarkRead: true,
        },
      ];
    } catch {
      return [];
    }
  })();
}

function sortByDateDesc(a: AdminHeaderNotification, b: AdminHeaderNotification): number {
  return String(b.date).localeCompare(String(a.date));
}

export async function listAdminHeaderNotifications(actor: AdminAuthActor): Promise<{
  items: AdminHeaderNotification[];
  unreadCount: number;
}> {
  ensureAdminNotificationsSchema();
  const mailItems = await listMailLive(actor);
  const items = [
    ...listDbNotifications(actor),
    ...listHrLive(actor),
    ...listSalesLive(actor),
    ...mailItems,
  ]
    .sort(sortByDateDesc)
    .slice(0, 40);
  const unreadCount = items.filter((i) => !i.read).length;
  return { items, unreadCount };
}

export function markAdminHeaderNotificationRead(
  actor: AdminAuthActor,
  id: string
): { ok: boolean; error?: string } {
  ensureAdminNotificationsSchema();
  if (id.startsWith('db:')) {
    const num = Number(id.slice(3));
    if (!Number.isFinite(num)) return { ok: false, error: 'شناسه نامعتبر' };
    const row = db()
      .prepare('SELECT * FROM admin_notifications WHERE id = ?')
      .get(num) as Record<string, unknown> | undefined;
    if (!row) return { ok: false, error: 'اعلان پیدا نشد' };
    if (!canSee(actor, row.permission != null ? String(row.permission) : null)) {
      return { ok: false, error: 'سطح دسترسی کافی نیست' };
    }
    db().prepare('UPDATE admin_notifications SET read = 1 WHERE id = ?').run(num);
    return { ok: true };
  }
  if (id.startsWith('hr:')) {
    if (!canSee(actor, 'hr.read')) return { ok: false, error: 'سطح دسترسی کافی نیست' };
    const num = Number(id.slice(3));
    if (!Number.isFinite(num)) return { ok: false, error: 'شناسه نامعتبر' };
    hrMod.markNotificationRead(num);
    return { ok: true };
  }
  if (id.startsWith('live:')) {
    dismiss(actor, id);
    return { ok: true };
  }
  return { ok: false, error: 'اعلان پیدا نشد' };
}

/** Push a one-off header notification (idempotent when sourceKey is set). */
export function pushAdminHeaderNotification(input: {
  title: string;
  body?: string;
  kind?: AdminNotificationKind;
  href?: string;
  module?: AdminHeaderNotification['module'];
  permission?: string | null;
  sourceKey?: string | null;
}): void {
  ensureTablesOnly();
  const title = String(input.title || '').trim();
  if (!title) return;
  db()
    .prepare(
      `INSERT OR IGNORE INTO admin_notifications
        (title, body, kind, href, module, permission, source_key, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`
    )
    .run(
      title,
      String(input.body || ''),
      input.kind || 'info',
      input.href || '/admin/dashboard',
      input.module || 'platform',
      input.permission ?? null,
      input.sourceKey ?? null
    );
}

export function markAllAdminHeaderNotificationsRead(actor: AdminAuthActor): { ok: true } {
  ensureAdminNotificationsSchema();
  const rows = db()
    .prepare('SELECT id, permission FROM admin_notifications WHERE read = 0')
    .all() as Array<{ id: number; permission: string | null }>;
  const upd = db().prepare('UPDATE admin_notifications SET read = 1 WHERE id = ?');
  for (const row of rows) {
    if (canSee(actor, row.permission)) upd.run(row.id);
  }
  if (canSee(actor, 'hr.read')) {
    try {
      hrMod.markAllNotificationsRead();
    } catch {
      /* ignore */
    }
  }
  dismiss(actor, 'live:sales-open');
  dismiss(actor, 'live:mail-unread');
  return { ok: true };
}
