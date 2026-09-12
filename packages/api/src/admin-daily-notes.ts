/**
 * Shared admin dashboard daily notes — one list per Gregorian YYYY-MM-DD.
 * Additive schema only; never wipes existing rows.
 */
import { getDb } from './db';

export const DAILY_NOTE_MAX_LEN = 500;
export const DAILY_NOTES_PER_DAY_MAX = 40;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type AdminDailyNote = {
  id: number;
  date: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

function db() {
  return getDb();
}

export function ensureAdminDailyNotesSchema(): void {
  db().exec(`
    CREATE TABLE IF NOT EXISTS admin_daily_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_date TEXT NOT NULL,
      body TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_admin_daily_notes_date
      ON admin_daily_notes(note_date);
  `);
}

export function isIsoDate(raw: string): boolean {
  const m = DATE_RE.exec(String(raw || '').trim());
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1970 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, mo - 1, d, 12, 0, 0);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

function rowOf(r: Record<string, unknown>): AdminDailyNote {
  return {
    id: Number(r.id),
    date: String(r.note_date || ''),
    body: String(r.body || ''),
    createdBy: String(r.created_by || ''),
    createdAt: String(r.created_at || ''),
    updatedAt: String(r.updated_at || ''),
  };
}

export function listAdminDailyNotes(date: string): AdminDailyNote[] {
  ensureAdminDailyNotesSchema();
  if (!isIsoDate(date)) return [];
  const rows = db()
    .prepare(
      `SELECT id, note_date, body, created_by, created_at, updated_at
       FROM admin_daily_notes
       WHERE note_date = ?
       ORDER BY id ASC`
    )
    .all(date) as Record<string, unknown>[];
  return rows.map(rowOf);
}

export function createAdminDailyNote(input: {
  date: string;
  body: string;
  createdBy?: string;
}): { ok: true; note: AdminDailyNote } | { ok: false; error: string } {
  ensureAdminDailyNotesSchema();
  const date = String(input.date || '').trim();
  if (!isIsoDate(date)) return { ok: false, error: 'تاریخ نامعتبر است' };
  const body = String(input.body || '').trim();
  if (!body) return { ok: false, error: 'متن یادداشت خالی است' };
  if (body.length > DAILY_NOTE_MAX_LEN) {
    return { ok: false, error: `یادداشت حداکثر ${DAILY_NOTE_MAX_LEN} کاراکتر است` };
  }
  const count = (
    db().prepare('SELECT COUNT(*) AS c FROM admin_daily_notes WHERE note_date = ?').get(date) as {
      c: number;
    }
  ).c;
  if (Number(count) >= DAILY_NOTES_PER_DAY_MAX) {
    return { ok: false, error: 'سقف یادداشت این روز پر است' };
  }
  const createdBy = String(input.createdBy || '').trim().slice(0, 80);
  const result = db()
    .prepare(
      `INSERT INTO admin_daily_notes (note_date, body, created_by)
       VALUES (?, ?, ?)`
    )
    .run(date, body, createdBy);
  const row = db()
    .prepare(
      `SELECT id, note_date, body, created_by, created_at, updated_at
       FROM admin_daily_notes WHERE id = ?`
    )
    .get(Number(result.lastInsertRowid)) as Record<string, unknown> | undefined;
  if (!row) return { ok: false, error: 'ثبت یادداشت ناموفق بود' };
  return { ok: true, note: rowOf(row) };
}

export function updateAdminDailyNote(
  id: number,
  bodyRaw: string
): { ok: true; note: AdminDailyNote } | { ok: false; error: string } {
  ensureAdminDailyNotesSchema();
  const num = Number(id);
  if (!Number.isInteger(num) || num < 1) return { ok: false, error: 'شناسه نامعتبر است' };
  const body = String(bodyRaw || '').trim();
  if (!body) return { ok: false, error: 'متن یادداشت خالی است' };
  if (body.length > DAILY_NOTE_MAX_LEN) {
    return { ok: false, error: `یادداشت حداکثر ${DAILY_NOTE_MAX_LEN} کاراکتر است` };
  }
  const existing = db()
    .prepare('SELECT id FROM admin_daily_notes WHERE id = ?')
    .get(num) as { id: number } | undefined;
  if (!existing) return { ok: false, error: 'یادداشت پیدا نشد' };
  db()
    .prepare(
      `UPDATE admin_daily_notes
       SET body = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(body, num);
  const row = db()
    .prepare(
      `SELECT id, note_date, body, created_by, created_at, updated_at
       FROM admin_daily_notes WHERE id = ?`
    )
    .get(num) as Record<string, unknown>;
  return { ok: true, note: rowOf(row) };
}

export function deleteAdminDailyNote(id: number): { ok: true } | { ok: false; error: string } {
  ensureAdminDailyNotesSchema();
  const num = Number(id);
  if (!Number.isInteger(num) || num < 1) return { ok: false, error: 'شناسه نامعتبر است' };
  const existing = db()
    .prepare('SELECT id FROM admin_daily_notes WHERE id = ?')
    .get(num) as { id: number } | undefined;
  if (!existing) return { ok: false, error: 'یادداشت پیدا نشد' };
  db().prepare('DELETE FROM admin_daily_notes WHERE id = ?').run(num);
  return { ok: true };
}
