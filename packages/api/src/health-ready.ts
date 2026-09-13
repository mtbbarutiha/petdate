/**
 * Readiness (data plane) for deploy wait + monitor-health.
 *
 * GET /api/health stays a cheap liveness probe for PM2.
 * GET /api/health/ready pings Postgres when DATABASE_URL is a postgres URL,
 * and Redis when REDIS_URL is set. Short timeouts; never logs secrets.
 */
function isPostgresUrl(url: string | undefined | null): boolean {
  const u = String(url || '').trim();
  return u.startsWith('postgres://') || u.startsWith('postgresql://');
}

export type ProbeState = 'ok' | 'skipped' | 'down';

export type ReadinessResult = {
  ok: boolean;
  service: 'petdate-api';
  postgres: ProbeState;
  redis: ProbeState;
  error?: string;
};

const DEFAULT_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    }),
  ]);
}

export async function pingPostgres(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ProbeState> {
  if (!isPostgresUrl(process.env.DATABASE_URL)) {
    return 'skipped';
  }
  const { default: pg } = await import('pg');
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: timeoutMs,
  });
  try {
    await withTimeout(
      client.connect().then(() => client.query('SELECT 1')),
      timeoutMs,
      'postgres'
    );
    return 'ok';
  } catch {
    return 'down';
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

export async function pingRedis(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ProbeState> {
  if (!String(process.env.REDIS_URL || '').trim()) {
    return 'skipped';
  }
  const { default: Redis } = await import('ioredis');
  const client = new Redis(process.env.REDIS_URL, {
    connectTimeout: timeoutMs,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
  });
  try {
    await withTimeout(client.connect(), timeoutMs, 'redis');
    const pong = await withTimeout(client.ping(), timeoutMs, 'redis ping');
    return String(pong).toUpperCase() === 'PONG' ? 'ok' : 'down';
  } catch {
    return 'down';
  } finally {
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
  }
}

export async function checkReadiness(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ReadinessResult> {
  const [postgres, redis] = await Promise.all([pingPostgres(timeoutMs), pingRedis(timeoutMs)]);
  const ok = postgres !== 'down' && redis !== 'down';
  const result: ReadinessResult = {
    ok,
    service: 'petdate-api',
    postgres,
    redis,
  };
  if (!ok) {
    result.error = 'data plane unreachable';
  }
  return result;
}
