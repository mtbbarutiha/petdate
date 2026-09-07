#!/usr/bin/env node
/**
 * One-shot SQLite → PostgreSQL migration for PetDate.
 *
 * Usage:
 *   DATABASE_URL=postgresql://petdate:petdate@127.0.0.1:5432/petdate \
 *   DATABASE_PATH=/opt/petdate/packages/api/data/petdate.db \
 *   node scripts/migrate-sqlite-to-postgres.mjs
 *
 * Recreates public schema (keeps PostGIS), copies every app table + sequences.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Database from 'better-sqlite3';
import pg from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://petdate:petdate@127.0.0.1:5432/petdate';
const SQLITE_PATH =
  process.env.DATABASE_PATH ||
  path.resolve(process.cwd(), 'packages/api/data/petdate.db');

function sqliteTypeToPg(type) {
  const t = String(type || 'TEXT').toUpperCase();
  if (t.includes('INT')) return 'BIGINT';
  if (t.includes('REAL') || t.includes('FLOA') || t.includes('DOUB')) return 'DOUBLE PRECISION';
  if (t.includes('BLOB')) return 'BYTEA';
  return 'TEXT';
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function loadSqliteTables(sqlite) {
  return sqlite
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
    )
    .all()
    .map((r) => r.name);
}

function tableColumns(sqlite, table) {
  return sqlite.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
}

function tableCreateSql(sqlite, table) {
  const cols = tableColumns(sqlite, table);
  if (!cols.length) throw new Error(`no columns for ${table}`);
  const pkCols = cols.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk);
  const singleIntegerPk =
    pkCols.length === 1 &&
    String(pkCols[0].type || '').toUpperCase().includes('INT');

  const lines = cols.map((c) => {
    const name = quoteIdent(c.name);
    let typ = sqliteTypeToPg(c.type);
    const parts = [`${name} ${typ}`];
    if (singleIntegerPk && c.pk === 1) {
      // BIGSERIAL implies NOT NULL; keep name for identity.
      return `${name} BIGSERIAL PRIMARY KEY`;
    }
    if (c.notnull && !(singleIntegerPk && c.pk === 1)) parts.push('NOT NULL');
    if (c.dflt_value != null && c.dflt_value !== '') {
      let d = String(c.dflt_value);
      if (/datetime\s*\(\s*'now'\s*\)/i.test(d)) d = 'TO_CHAR(NOW(), \'YYYY-MM-DD HH24:MI:SS\')';
      // SQLite defaults often look like '[]' or 0 — keep as raw SQL expression.
      parts.push(`DEFAULT ${d}`);
    }
    return parts.join(' ');
  });

  if (pkCols.length > 1 || (pkCols.length === 1 && !singleIntegerPk)) {
    lines.push(
      `PRIMARY KEY (${pkCols.map((c) => quoteIdent(c.name)).join(', ')})`
    );
  }

  return `CREATE TABLE ${quoteIdent(table)} (\n  ${lines.join(',\n  ')}\n);`;
}

function topologicalTables(sqlite, tables) {
  // Prefer parents first based on FK pragma.
  const deps = new Map(tables.map((t) => [t, new Set()]));
  for (const t of tables) {
    const fks = sqlite.prepare(`PRAGMA foreign_key_list(${quoteIdent(t)})`).all();
    for (const fk of fks) {
      if (deps.has(fk.table)) deps.get(t).add(fk.table);
    }
  }
  const out = [];
  const visiting = new Set();
  const done = new Set();
  function visit(t) {
    if (done.has(t)) return;
    if (visiting.has(t)) return; // cycle — ignore
    visiting.add(t);
    for (const d of deps.get(t) || []) visit(d);
    visiting.delete(t);
    done.add(t);
    out.push(t);
  }
  for (const t of tables) visit(t);
  return out;
}

async function main() {
  if (!fs.existsSync(SQLITE_PATH)) {
    throw new Error(`SQLite file not found: ${SQLITE_PATH}`);
  }
  console.log(`SQLite: ${SQLITE_PATH}`);
  console.log(`Postgres: ${DATABASE_URL.replace(/:[^:@/]+@/, ':***@')}`);

  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const tables = loadSqliteTables(sqlite);
  const ordered = topologicalTables(sqlite, tables);
  console.log(`Tables: ${ordered.length}`);

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
    // Wipe app schema; recreate clean public (PostGIS objects recreated via extension if needed)
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO CURRENT_USER');
    await client.query('GRANT ALL ON SCHEMA public TO public');
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis');

    for (const table of ordered) {
      const ddl = tableCreateSql(sqlite, table);
      await client.query(ddl);
      console.log(`  + ${table}`);
    }

    // Copy rows
    for (const table of ordered) {
      const cols = tableColumns(sqlite, table);
      const colNames = cols.map((c) => c.name);
      const rows = sqlite.prepare(`SELECT * FROM ${quoteIdent(table)}`).all();
      if (!rows.length) {
        console.log(`  → ${table}: 0 rows`);
        continue;
      }
      const colList = colNames.map(quoteIdent).join(', ');
      const placeholders = colNames.map((_, i) => `$${i + 1}`).join(', ');
      const insertSql = `INSERT INTO ${quoteIdent(table)} (${colList}) VALUES (${placeholders})`;
      for (const row of rows) {
        const values = colNames.map((c) => {
          const v = row[c];
          return v === undefined ? null : v;
        });
        await client.query(insertSql, values);
      }
      // Fix serial sequences
      const pk = cols.find((c) => c.pk === 1);
      if (pk && String(pk.type || '').toUpperCase().includes('INT')) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence('${table.replace(/'/g, "''")}', '${pk.name.replace(/'/g, "''")}'),
            COALESCE((SELECT MAX(${quoteIdent(pk.name)}) FROM ${quoteIdent(table)}), 1),
            true)`
        ).catch(() => undefined);
      }
      console.log(`  → ${table}: ${rows.length} rows`);
    }

    await client.query('COMMIT');
    console.log('Migration committed.');

    // Verify counts
    for (const table of ordered) {
      const sq = sqlite.prepare(`SELECT COUNT(*) AS c FROM ${quoteIdent(table)}`).get().c;
      const pgCount = (await client.query(`SELECT COUNT(*)::int AS c FROM ${quoteIdent(table)}`)).rows[0].c;
      if (sq !== pgCount) {
        console.warn(`COUNT MISMATCH ${table}: sqlite=${sq} pg=${pgCount}`);
      }
    }
    console.log('Done.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
