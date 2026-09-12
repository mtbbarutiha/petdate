/**
 * Per-admin UI preferences (widget layouts, daily notes, …).
 * Additive CREATE IF NOT EXISTS — never wipe. Scoped by actor_key.
 */
import { getDb } from './db';
import type { AdminAuthActor } from './hr-service';

const MAX_VALUE_BYTES = 64 * 1024;
const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,79}$/;

export function ensureAdminUserPrefsSchema(): void {
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS admin_user_prefs (
      actor_key TEXT NOT NULL,
      pref_key TEXT NOT NULL,
      value TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (actor_key, pref_key)
    );
    CREATE INDEX IF NOT EXISTS idx_admin_user_prefs_actor
      ON admin_user_prefs(actor_key);
  `);
}

export function actorKeyForPrefs(actor: AdminAuthActor): string {
  return (actor.username || actor.displayName || actor.role || 'admin').trim() || 'admin';
}

export function assertPrefKey(key: string): string {
  const k = String(key || '').trim();
  if (!KEY_RE.test(k)) {
    throw Object.assign(new Error('کلید ترجیح نامعتبر است'), { status: 400 });
  }
  return k;
}

function assertValueSize(json: string): void {
  if (Buffer.byteLength(json, 'utf8') > MAX_VALUE_BYTES) {
    throw Object.assign(new Error('حجم ترجیح بیش از حد است'), { status: 400 });
  }
}

export function getAdminPref(actor: AdminAuthActor, key: string): unknown | null {
  ensureAdminUserPrefsSchema();
  const prefKey = assertPrefKey(key);
  const row = getDb()
    .prepare('SELECT value FROM admin_user_prefs WHERE actor_key = ? AND pref_key = ?')
    .get(actorKeyForPrefs(actor), prefKey) as { value?: string } | undefined;
  if (!row || row.value == null || row.value === '') return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

export function setAdminPref(actor: AdminAuthActor, key: string, value: unknown): unknown {
  ensureAdminUserPrefsSchema();
  const prefKey = assertPrefKey(key);
  const json = JSON.stringify(value === undefined ? null : value);
  assertValueSize(json);
  getDb()
    .prepare(
      `INSERT INTO admin_user_prefs (actor_key, pref_key, value, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(actor_key, pref_key) DO UPDATE SET
         value = excluded.value,
         updated_at = datetime('now')`
    )
    .run(actorKeyForPrefs(actor), prefKey, json);
  return value === undefined ? null : value;
}

export function deleteAdminPref(actor: AdminAuthActor, key: string): boolean {
  ensureAdminUserPrefsSchema();
  const prefKey = assertPrefKey(key);
  const res = getDb()
    .prepare('DELETE FROM admin_user_prefs WHERE actor_key = ? AND pref_key = ?')
    .run(actorKeyForPrefs(actor), prefKey);
  return Number(res.changes || 0) > 0;
}

export function layoutPrefKey(dashboardId: string): string {
  const id = String(dashboardId || '')
    .replace(/[^\w.-]/g, '_')
    .slice(0, 48);
  if (!id) throw Object.assign(new Error('شناسه داشبورد نامعتبر است'), { status: 400 });
  return `widget-layout:${id}`;
}
