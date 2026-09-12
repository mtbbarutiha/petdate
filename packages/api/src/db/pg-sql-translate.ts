/**
 * Pure SQLite → Postgres SQL rewrite helpers (no DB side effects).
 * Used by pg-compat.ts and selftests.
 */

/**
 * Strip `datetime(<expr>)` wrappers with balanced parentheses.
 * Call only *after* `datetime('now'…)` forms have been rewritten to TO_CHAR(NOW()…).
 */
export function stripDatetimeWrappers(sql: string): string {
  let s = sql;
  for (;;) {
    const re = /datetime\s*\(/gi;
    const m = re.exec(s);
    if (!m) break;
    const start = m.index;
    const openParen = start + m[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = openParen; i < s.length; i++) {
      const ch = s[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) break;
    const inner = s.slice(openParen + 1, end).trim();
    s = `${s.slice(0, start)}${inner}${s.slice(end + 1)}`;
  }
  return s;
}

/** SQLite → Postgres SQL rewrite used by the sync PG facade. */
export function translateSql(sql: string): string {
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
  // datetime(<expr>) — strip wrapper (column, COALESCE(...), subselects).
  // TEXT timestamps compare lexicographically on both drivers.
  // Production bug: listIdleActiveVetConsultIds used datetime(COALESCE(...))
  // which became a bare Postgres call → "function datetime(text) does not exist".
  s = stripDatetimeWrappers(s);
  s = s.replace(/ON\s+CONFLICT\s*\(\s*/gi, 'ON CONFLICT (');
  s = s.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO');
  s = s.replace(/\bINSERT\s+OR\s+REPLACE\s+INTO\b/gi, 'INSERT INTO');
  s = s.replace(
    /INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi,
    'BIGSERIAL PRIMARY KEY'
  );
  s = s.replace(/\bAUTOINCREMENT\b/gi, '');
  // SQLite-only collations — leave ORDER BY / column defs Postgres-safe
  s = s.replace(/\s+COLLATE\s+NOCASE\b/gi, '');
  s = s.replace(/\s+COLLATE\s+BINARY\b/gi, '');
  s = s.replace(/\s+COLLATE\s+RTRIM\b/gi, '');

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
