/**
 * better-sqlite3-compatible sync facade over PostgreSQL (via synckit).
 * Translates common SQLite SQL idioms used by packages/api/src/db.ts.
 */
import path from 'node:path';
import { createSyncFn } from 'synckit';

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

function translateSql(sql: string): string {
  const original = sql;
  const ignoreInsert = /^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(original);
  const replaceInsert = /^\s*INSERT\s+OR\s+REPLACE\s+INTO\b/i.test(original);

  // PRAGMA table_info(users)
  const pragmaInfo = original.match(
    /^\s*PRAGMA\s+table_info\(\s*["']?(\w+)["']?\s*\)\s*$/i
  );
  if (pragmaInfo) {
    const table = pragmaInfo[1];
    return `
      SELECT
        (ordinal_position - 1)::int AS cid,
        column_name AS name,
        udt_name AS type,
        CASE WHEN is_nullable = 'NO' THEN 1 ELSE 0 END AS notnull,
        column_default AS dflt_value,
        CASE WHEN EXISTS (
          SELECT 1
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = 'public'
            AND tc.table_name = '${table}'
            AND tc.constraint_type = 'PRIMARY KEY'
            AND kcu.column_name = columns.column_name
        ) THEN 1 ELSE 0 END AS pk
      FROM information_schema.columns AS columns
      WHERE table_schema = 'public' AND table_name = '${table}'
      ORDER BY ordinal_position
    `;
  }

  let s = original;
  s = s.replace(/IFNULL\s*\(/gi, 'COALESCE(');
  // SQLite datetime('now') / datetime('now','-1 day') / datetime('now','-24 hours')
  s = s.replace(
    /datetime\s*\(\s*'now'\s*,\s*'(-?\d+)\s*(days?|hours?|minutes?|seconds?)'\s*\)/gi,
    (_m, n, unit) => {
      const u = String(unit).toLowerCase().replace(/s$/, '');
      const map: Record<string, string> = {
        day: 'days',
        hour: 'hours',
        minute: 'minutes',
        second: 'seconds',
      };
      const pgUnit = map[u] || 'days';
      return `TO_CHAR(NOW() + INTERVAL '${n} ${pgUnit}', 'YYYY-MM-DD HH24:MI:SS')`;
    }
  );
  // datetime('now', ?) — bound modifier e.g. '-1 day'
  s = s.replace(
    /datetime\s*\(\s*'now'\s*,\s*\?\s*\)/gi,
    "TO_CHAR(NOW() + (?)::interval, 'YYYY-MM-DD HH24:MI:SS')"
  );
  s = s.replace(
    /datetime\s*\(\s*'now'\s*\)/gi,
    "TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')"
  );
  // datetime(column) — TEXT timestamps compare lexicographically
  s = s.replace(/datetime\s*\(\s*([a-zA-Z_][\w.]*)\s*\)/gi, '$1');
  s = s.replace(/ON\s+CONFLICT\s*\(\s*/gi, 'ON CONFLICT (');
  s = s.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO');
  s = s.replace(/\bINSERT\s+OR\s+REPLACE\s+INTO\b/gi, 'INSERT INTO');
  s = s.replace(
    /INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi,
    'BIGSERIAL PRIMARY KEY'
  );
  s = s.replace(/\bAUTOINCREMENT\b/gi, '');

  let i = 0;
  s = s.replace(/\?/g, () => `$${++i}`);

  if (ignoreInsert && !/\bON\s+CONFLICT\b/i.test(s)) {
    s = `${s.replace(/;?\s*$/, '')} ON CONFLICT DO NOTHING`;
  }
  if (replaceInsert && !/\bON\s+CONFLICT\b/i.test(s)) {
    // Without a known conflict target, DO NOTHING is safer than failing the boot seed.
    s = `${s.replace(/;?\s*$/, '')} ON CONFLICT DO NOTHING`;
  }

  return s;
}

function splitExecStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
    .map(translateSql);
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'string' && /^-?\d+$/.test(v) && v.length <= 15) {
      out[k] = Number(v);
    } else if (typeof v === 'bigint') {
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
