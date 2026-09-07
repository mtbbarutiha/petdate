/**
 * synckit worker — must use runAsWorker.
 */
import { runAsWorker } from 'synckit';
import pg from 'pg';

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required for postgres worker');
    pool = new pg.Pool({
      connectionString: url,
      max: 8,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

runAsWorker(
  async (payload: {
    type: 'query' | 'exec' | 'ping';
    sql?: string;
    params?: unknown[];
    statements?: string[];
  }) => {
    const p = getPool();
    if (payload.type === 'query') {
      const res = await p.query(payload.sql as string, payload.params ?? []);
      return {
        rows: res.rows,
        rowCount: res.rowCount ?? 0,
        fields: (res.fields || []).map((f) => f.name),
      };
    }
    if (payload.type === 'exec') {
      const client = await p.connect();
      try {
        for (const sql of payload.statements || []) {
          if (!String(sql).trim()) continue;
          await client.query(sql);
        }
        return { ok: true };
      } finally {
        client.release();
      }
    }
    if (payload.type === 'ping') {
      await p.query('SELECT 1');
      return { ok: true };
    }
    throw new Error(`unknown pg worker type: ${payload.type}`);
  }
);
