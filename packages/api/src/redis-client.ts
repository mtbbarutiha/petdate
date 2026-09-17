/**
 * Dual Redis clients for the API package.
 *
 * - WRITE → REDIS_URL (primary)
 * - READ  → REDIS_READ_URL when USE_REDIS_REPLICA is truthy and REDIS_READ_URL is set
 * - Fail open to primary if the replica connect/command errors
 *
 * Safe defaults:
 * - Read-modify-write, MULTI/EXEC, pub/sub, and streams always use the write client.
 * - Pure GET-family helpers may use the replica; callers that need read-after-write
 *   consistency should use getRedisWrite() (or pass preferPrimary on redisGet).
 */
import Redis, { type RedisOptions } from 'ioredis';
import { isRedisReplicaReadsEnabled } from './admin-redis-monitoring';

const CONNECT_TIMEOUT_MS = 2000;

/** Commands safe to send to a read replica (no side effects). */
const READ_COMMANDS = new Set(
  [
    'get',
    'mget',
    'exists',
    'ttl',
    'pttl',
    'type',
    'strlen',
    'getrange',
    'hget',
    'hmget',
    'hgetall',
    'hexists',
    'hlen',
    'hkeys',
    'hvals',
    'lindex',
    'llen',
    'lrange',
    'scard',
    'sismember',
    'smembers',
    'srandmember',
    'zcard',
    'zcount',
    'zrange',
    'zrangebyscore',
    'zrank',
    'zrevrange',
    'zscore',
    'strlen',
  ].map((c) => c.toLowerCase()),
);

/** Always primary — mutations, transactions, pub/sub, streams. */
const WRITE_ONLY_COMMANDS = new Set(
  [
    'set',
    'setex',
    'setnx',
    'mset',
    'del',
    'unlink',
    'expire',
    'pexpire',
    'persist',
    'incr',
    'incrby',
    'decr',
    'decrby',
    'hset',
    'hmset',
    'hdel',
    'hincrby',
    'lpush',
    'rpush',
    'lpop',
    'rpop',
    'ltrim',
    'sadd',
    'srem',
    'zadd',
    'zrem',
    'zincrby',
    'rename',
    'renamenx',
    'multi',
    'exec',
    'discard',
    'watch',
    'unwatch',
    'publish',
    'subscribe',
    'psubscribe',
    'unsubscribe',
    'punsubscribe',
    'xadd',
    'xack',
    'xgroup',
    'xreadgroup',
    'xtrim',
    'xdel',
    'eval',
    'evalsha',
    'script',
  ].map((c) => c.toLowerCase()),
);

export function isRedisReadCommand(command: string): boolean {
  return READ_COMMANDS.has(String(command || '').trim().toLowerCase());
}

export function isRedisWriteOnlyCommand(command: string): boolean {
  return WRITE_ONLY_COMMANDS.has(String(command || '').trim().toLowerCase());
}

/** True only when the flag is on AND an explicit REDIS_READ_URL is configured. */
export function shouldUseRedisReplicaReads(): boolean {
  if (!isRedisReplicaReadsEnabled()) return false;
  return Boolean(String(process.env.REDIS_READ_URL || '').trim());
}

export function resolveAppRedisPrimaryUrl(): string | null {
  const url = String(process.env.REDIS_URL || '').trim();
  return url || null;
}

export function resolveAppRedisReadUrl(): string | null {
  if (!shouldUseRedisReplicaReads()) return resolveAppRedisPrimaryUrl();
  const readUrl = String(process.env.REDIS_READ_URL || '').trim();
  return readUrl || resolveAppRedisPrimaryUrl();
}

type ClientSlot = {
  client: Redis | null;
  failed: boolean;
  connecting: Promise<Redis | null> | null;
};

const writeSlot: ClientSlot = { client: null, failed: false, connecting: null };
const readSlot: ClientSlot = { client: null, failed: false, connecting: null };

function redisOptions(): RedisOptions {
  return {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: CONNECT_TIMEOUT_MS,
    retryStrategy: () => null,
    enableOfflineQueue: false,
  };
}

async function connectSlot(slot: ClientSlot, url: string): Promise<Redis | null> {
  if (slot.failed) return null;
  if (slot.client) return slot.client;
  if (slot.connecting) return slot.connecting;

  slot.connecting = (async () => {
    try {
      const client = new Redis(url, redisOptions());
      client.on('error', () => {
        /* suppressed — callers fail open / health probes report Redis */
      });
      await client.connect();
      await client.ping();
      slot.client = client;
      return client;
    } catch {
      slot.failed = true;
      return null;
    } finally {
      slot.connecting = null;
    }
  })();

  return slot.connecting;
}

/** Primary (write) client. Null when REDIS_URL is unset or connect failed. */
export async function getRedisWrite(): Promise<Redis | null> {
  const url = resolveAppRedisPrimaryUrl();
  if (!url) return null;
  return connectSlot(writeSlot, url);
}

/**
 * Read client: replica when USE_REDIS_REPLICA + REDIS_READ_URL, else primary.
 * Fail open: if replica is unavailable, returns primary.
 */
export async function getRedisRead(): Promise<Redis | null> {
  const write = await getRedisWrite();
  if (!write) return null;
  if (!shouldUseRedisReplicaReads()) return write;

  const readUrl = String(process.env.REDIS_READ_URL || '').trim();
  if (!readUrl) return write;

  // Same URL as primary → no second connection.
  const primaryUrl = resolveAppRedisPrimaryUrl();
  if (primaryUrl && readUrl === primaryUrl) return write;

  const replica = await connectSlot(readSlot, readUrl);
  return replica ?? write;
}

/**
 * Prefer write for RMW / consistency; otherwise read (replica when enabled).
 * Write-only command names always resolve to primary.
 */
export async function getRedisForCommand(command: string): Promise<Redis | null> {
  if (isRedisWriteOnlyCommand(command) || !isRedisReadCommand(command)) {
    return getRedisWrite();
  }
  return getRedisRead();
}

/** Pure GET with fail-open: replica error → retry once on primary. */
export async function redisGet(
  key: string,
  opts?: { preferPrimary?: boolean },
): Promise<string | null> {
  if (opts?.preferPrimary) {
    const write = await getRedisWrite();
    if (!write) return null;
    return write.get(key);
  }

  const read = await getRedisRead();
  if (!read) return null;

  try {
    return await read.get(key);
  } catch {
    // Fail open to primary if replica errors mid-flight.
    const write = await getRedisWrite();
    if (!write || write === read) return null;
    try {
      return await write.get(key);
    } catch {
      return null;
    }
  }
}

export async function redisSet(
  key: string,
  value: string,
  opts?: { ex?: number; px?: number; nx?: boolean; xx?: boolean },
): Promise<'OK' | null> {
  const write = await getRedisWrite();
  if (!write) return null;
  if (opts?.ex != null && opts.nx) return write.set(key, value, 'EX', opts.ex, 'NX');
  if (opts?.ex != null && opts.xx) return write.set(key, value, 'EX', opts.ex, 'XX');
  if (opts?.px != null && opts.nx) return write.set(key, value, 'PX', opts.px, 'NX');
  if (opts?.px != null && opts.xx) return write.set(key, value, 'PX', opts.px, 'XX');
  if (opts?.ex != null) return write.set(key, value, 'EX', opts.ex);
  if (opts?.px != null) return write.set(key, value, 'PX', opts.px);
  if (opts?.nx) return write.set(key, value, 'NX');
  if (opts?.xx) return write.set(key, value, 'XX');
  return write.set(key, value);
}

export async function redisDel(...keys: string[]): Promise<number> {
  const write = await getRedisWrite();
  if (!write || keys.length === 0) return 0;
  return write.del(...keys);
}

/** Test / process shutdown helper. */
export async function disconnectRedisClients(): Promise<void> {
  const slots = [writeSlot, readSlot];
  for (const slot of slots) {
    const client = slot.client;
    slot.client = null;
    slot.failed = false;
    slot.connecting = null;
    if (client) await client.quit().catch(() => undefined);
  }
}

/** Reset failure flags (selftests / after infra recovery). */
export function resetRedisClientState(): void {
  writeSlot.client = null;
  writeSlot.failed = false;
  writeSlot.connecting = null;
  readSlot.client = null;
  readSlot.failed = false;
  readSlot.connecting = null;
}
