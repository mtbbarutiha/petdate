/**
 * better-sqlite3-compatible sync facade over PostgreSQL (via synckit).
 * Translates common SQLite SQL idioms used by packages/api/src/db.ts.
 */
import path from 'node:path';
import { createSyncFn } from 'synckit';
import { translateSql } from './pg-sql-translate';

export { translateSql } from './pg-sql-translate';

type QueryResult = {
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: string[];
};

type PgWorker = (payload: {
  type: 'query' | 'exec' | 'ping';
  sql?: string;
  params?: unknown[];
  statements?: string[];
}) => QueryResult | { ok: true };

const runPg = createSyncFn(path.join(__dirname, 'pg-worker.js'), {
  timeout: 60_000,
}) as PgWorker;

function splitExecStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
    .map(translateSql);
}

/** Columns that must stay strings even when digit-only (Telegram/phone/ids). */
const KEEP_STRING_COLUMNS = new Set([
  'telegram_id',
  'phone',
  'username',
  'email',
  'name',
  'city',
  'province',
  'country',
  'bio',
  'avatar_url',
  'verification_photo_file_id',
  'vet_credential_file_id',
  'verification_note',
  'verification_status',
  'vet_credential_status',
  'role',
  'roles',
  'onboarding',
  'gender',
  'interests',
  'profile_rewards',
  'created_at',
  'updated_at',
  'verified_at',
  'phone_verified_at',
  'last_daily_coin_at',
  'last_seen_at',
  'text',
  'notes',
  'pdf_path',
  'storage_key',
  'mime_type',
  'file_name',
  'card_number',
  'card_holder',
  'public_id',
]);

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'bigint') {
      out[k] = Number(v);
    } else if (
      typeof v === 'string' &&
      /^-?\d+$/.test(v) &&
      v.length <= 15 &&
      !KEEP_STRING_COLUMNS.has(k)
    ) {
      out[k] = Number(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

class PgStatement {
  private originalSql: string;
  private sql: string;
  constructor(sql: string) {
    this.originalSql = sql;
    this.sql = translateSql(sql);
  }

  run(...params: unknown[]) {
    let sql = this.sql;
    const isInsert = /^\s*INSERT\b/i.test(this.originalSql);
    if (isInsert && !/\bRETURNING\b/i.test(sql)) {
      sql = `${sql.replace(/;?\s*$/, '')} RETURNING *`;
    }
    const res = runPg({ type: 'query', sql, params }) as QueryResult;
    const row = res.rows[0] ? normalizeRow(res.rows[0]) : {};
    const id = row.id ?? row.Id;
    return {
      changes: res.rowCount,
      lastInsertRowid: Number(id ?? 0) || 0,
    };
  }

  get(...params: unknown[]) {
    const res = runPg({ type: 'query', sql: this.sql, params }) as QueryResult;
    return res.rows[0] ? normalizeRow(res.rows[0]) : undefined;
  }

  all(...params: unknown[]) {
    const res = runPg({ type: 'query', sql: this.sql, params }) as QueryResult;
    return res.rows.map(normalizeRow);
  }
}

export class PgSqliteCompatDatabase {
  prepare(sql: string) {
    return new PgStatement(sql);
  }

  exec(sql: string) {
    const statements = splitExecStatements(sql);
    runPg({ type: 'exec', statements });
    return this;
  }

  pragma(source: string) {
    const m = String(source).match(/^\s*(\w+)\s*=\s*(.+)\s*$/);
    if (m && m[1]?.toLowerCase() === 'foreign_keys') return;
    if (m && m[1]?.toLowerCase() === 'journal_mode') return 'wal';
    return null;
  }

  transaction(fn: (...args: never[]) => unknown) {
    return (...args: never[]) => {
      runPg({ type: 'query', sql: 'BEGIN', params: [] });
      try {
        const result = fn(...args);
        runPg({ type: 'query', sql: 'COMMIT', params: [] });
        return result;
      } catch (err) {
        try {
          runPg({ type: 'query', sql: 'ROLLBACK', params: [] });
        } catch {
          /* ignore */
        }
        throw err;
      }
    };
  }

  close() {
    /* pool lives for process */
  }
}

export function createPgCompatDatabase(): PgSqliteCompatDatabase {
  runPg({ type: 'ping' });
  return new PgSqliteCompatDatabase();
}

export function isPostgresUrl(url: string | undefined | null): boolean {
  const u = String(url || '').trim();
  return u.startsWith('postgres://') || u.startsWith('postgresql://');
}
