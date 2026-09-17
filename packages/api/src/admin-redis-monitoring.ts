/**
 * Admin Redis topology probe — primary (write) + optional read replica.
 * Uses INFO / PING only. Never returns passwords or full redis:// URLs.
 */
import type { CheckStatus, ServiceCheck } from './admin-monitoring';
import { checkDown, checkNotConfigured, checkUp, checkWarn } from './admin-monitoring';

const DEFAULT_PRIMARY_URL = 'redis://127.0.0.1:6379';
const DEFAULT_REPLICA_URL = 'redis://127.0.0.1:6380';
const PROBE_TIMEOUT_MS = 1500;

export type RedisInstanceRole = 'primary' | 'replica';

export type RedisInstanceSnapshot = {
  label: RedisInstanceRole;
  host: string;
  port: number;
  status: CheckStatus;
  role: string | null;
  usedMemory: string | null;
  usedMemoryBytes: number | null;
  maxmemory: string | null;
  connectedClients: number | null;
  connectedSlaves: number | null;
  masterLinkStatus: string | null;
  masterLastIoSecondsAgo: number | null;
  replicationOffset: number | null;
  readOnly: boolean | null;
  pingLatencyMs: number | null;
  detail: string;
};

export type RedisTopologyOverall = 'healthy' | 'degraded' | 'down';

export type RedisTopology = {
  overall: RedisTopologyOverall;
  primary: RedisInstanceSnapshot;
  replica: RedisInstanceSnapshot;
  /** Informational — app read-splitting flag; monitoring always probes replica. */
  useReplicaReads: boolean;
  generatedAt: string;
};

export function resolveRedisPrimaryUrl(): string {
  const raw = String(process.env.REDIS_URL || '').trim();
  return raw || DEFAULT_PRIMARY_URL;
}

export function resolveRedisReplicaUrl(): string {
  const raw = String(process.env.REDIS_READ_URL || '').trim();
  return raw || DEFAULT_REPLICA_URL;
}

export function isRedisReplicaReadsEnabled(): boolean {
  const v = String(process.env.USE_REDIS_REPLICA || '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/** Safe host/port for API responses — never include credentials. */
export function redisEndpointFromUrl(url: string, defaultPort: number): { host: string; port: number } {
  try {
    const u = new URL(url);
    return {
      host: u.hostname || '127.0.0.1',
      port: Number(u.port || defaultPort) || defaultPort,
    };
  } catch {
    return { host: '127.0.0.1', port: defaultPort };
  }
}

/** Parse Redis INFO bulk string into a flat key → value map. */
export function parseRedisInfo(info: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of String(info || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx <= 0) continue;
    out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return out;
}

function parseIntOrNull(v: string | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatBytesHuman(bytes: number | null): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes === 0) return '0B';
  const units = ['B', 'K', 'M', 'G', 'T'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  const rounded = n >= 10 || i === 0 ? Math.round(n) : Math.round(n * 10) / 10;
  return `${rounded}${units[i]}`;
}

export function snapshotFromInfo(
  label: RedisInstanceRole,
  host: string,
  port: number,
  infoMap: Record<string, string>,
  pingLatencyMs: number | null,
): RedisInstanceSnapshot {
  const role = (infoMap.role || '').toLowerCase() || null;
  const usedMemoryBytes = parseIntOrNull(infoMap.used_memory);
  const maxmemoryBytes = parseIntOrNull(infoMap.maxmemory);
  const connectedClients = parseIntOrNull(infoMap.connected_clients);
  const connectedSlaves = parseIntOrNull(infoMap.connected_slaves);
  const masterLinkStatus = infoMap.master_link_status || null;
  const masterLastIoSecondsAgo = parseIntOrNull(infoMap.master_last_io_seconds_ago);
  const replicationOffset =
    parseIntOrNull(infoMap.slave_repl_offset) ?? parseIntOrNull(infoMap.master_repl_offset);
  const readOnlyRaw = infoMap.slave_read_only ?? infoMap.replica_read_only;
  const readOnly =
    readOnlyRaw == null
      ? role === 'slave' || role === 'replica'
        ? true
        : null
      : readOnlyRaw === '1' || readOnlyRaw.toLowerCase() === 'yes';

  const usedMemory = infoMap.used_memory_human || formatBytesHuman(usedMemoryBytes);
  const maxmemory =
    maxmemoryBytes != null && maxmemoryBytes > 0
      ? infoMap.maxmemory_human || formatBytesHuman(maxmemoryBytes)
      : 'unlimited';

  let status: CheckStatus = 'up';
  const parts: string[] = [`${host}:${port}`];
  if (role) parts.push(role);
  if (usedMemory) parts.push(`mem ${usedMemory}`);
  if (connectedClients != null) parts.push(`${connectedClients} clients`);
  if (pingLatencyMs != null) parts.push(`${pingLatencyMs}ms`);

  if (label === 'primary') {
    if (role && role !== 'master') {
      status = 'warn';
      parts.push('نقش غیرمنتظره');
    }
    if (connectedSlaves != null) parts.push(`${connectedSlaves} slaves`);
  } else {
    if (role && role !== 'slave' && role !== 'replica') {
      status = 'warn';
      parts.push('نقش غیرمنتظره');
    }
    if (masterLinkStatus) {
      parts.push(`link ${masterLinkStatus}`);
      if (masterLinkStatus !== 'up') status = 'warn';
    }
    if (masterLastIoSecondsAgo != null && masterLastIoSecondsAgo > 30) {
      status = 'warn';
      parts.push(`lag ${masterLastIoSecondsAgo}s`);
    } else if (masterLastIoSecondsAgo != null) {
      parts.push(`io ${masterLastIoSecondsAgo}s ago`);
    }
    if (readOnly === false) {
      status = 'warn';
      parts.push('writable');
    } else if (readOnly) {
      parts.push('read-only');
    }
  }

  return {
    label,
    host,
    port,
    status,
    role,
    usedMemory,
    usedMemoryBytes,
    maxmemory,
    connectedClients,
    connectedSlaves,
    masterLinkStatus,
    masterLastIoSecondsAgo,
    replicationOffset,
    readOnly,
    pingLatencyMs,
    detail: parts.join(' · '),
  };
}

function downSnapshot(
  label: RedisInstanceRole,
  host: string,
  port: number,
  detail: string,
): RedisInstanceSnapshot {
  return {
    label,
    host,
    port,
    status: 'down',
    role: null,
    usedMemory: null,
    usedMemoryBytes: null,
    maxmemory: null,
    connectedClients: null,
    connectedSlaves: null,
    masterLinkStatus: null,
    masterLastIoSecondsAgo: null,
    replicationOffset: null,
    readOnly: label === 'replica' ? true : null,
    pingLatencyMs: null,
    detail,
  };
}

async function probeRedisInstance(
  label: RedisInstanceRole,
  url: string,
  defaultPort: number,
): Promise<RedisInstanceSnapshot> {
  const { host, port } = redisEndpointFromUrl(url, defaultPort);
  try {
    const { default: Redis } = await import('ioredis');
    const client = new Redis(url, {
      connectTimeout: PROBE_TIMEOUT_MS,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    client.on('error', () => {
      /* probe result covers this */
    });
    try {
      await client.connect();
      const started = Date.now();
      const pong = await Promise.race([
        client.ping(),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Redis PING timeout')), PROBE_TIMEOUT_MS),
        ),
      ]);
      const pingLatencyMs = Date.now() - started;
      if (String(pong).toUpperCase() !== 'PONG') {
        return {
          ...downSnapshot(label, host, port, `${host}:${port} · پاسخ غیرمنتظره`),
          status: 'warn',
          pingLatencyMs,
          detail: `${host}:${port} · پاسخ غیرمنتظره`,
        };
      }
      let infoRaw = '';
      try {
        infoRaw = String(
          await Promise.race([
            client.info(),
            new Promise<string>((_, reject) =>
              setTimeout(() => reject(new Error('Redis INFO timeout')), PROBE_TIMEOUT_MS),
            ),
          ]),
        );
      } catch {
        return {
          label,
          host,
          port,
          status: 'warn',
          role: null,
          usedMemory: null,
          usedMemoryBytes: null,
          maxmemory: null,
          connectedClients: null,
          connectedSlaves: null,
          masterLinkStatus: null,
          masterLastIoSecondsAgo: null,
          replicationOffset: null,
          readOnly: label === 'replica' ? true : null,
          pingLatencyMs,
          detail: `${host}:${port} · PONG · INFO ناموفق`,
        };
      }
      return snapshotFromInfo(label, host, port, parseRedisInfo(infoRaw), pingLatencyMs);
    } finally {
      try {
        client.disconnect();
      } catch {
        /* */
      }
    }
  } catch (err) {
    const msg = (err as Error).message || 'unreachable';
    return downSnapshot(label, host, port, `${host}:${port} · ${msg}`);
  }
}

export function classifyRedisTopologyOverall(
  primary: RedisInstanceSnapshot,
  replica: RedisInstanceSnapshot,
): RedisTopologyOverall {
  if (primary.status === 'down') return 'down';
  if (primary.status === 'warn' || replica.status !== 'up') return 'degraded';
  return 'healthy';
}

export function redisSnapshotToServiceCheck(snap: RedisInstanceSnapshot): ServiceCheck {
  if (snap.status === 'up') {
    return checkUp(snap.detail, {
      latencyMs: snap.pingLatencyMs ?? undefined,
    });
  }
  if (snap.status === 'warn') {
    return checkWarn(snap.detail, {
      latencyMs: snap.pingLatencyMs ?? undefined,
    });
  }
  if (snap.status === 'not_configured') {
    return checkNotConfigured(snap.detail);
  }
  return checkDown(snap.detail, {
    latencyMs: snap.pingLatencyMs ?? undefined,
  });
}

/** Probe primary + replica for admin monitoring. */
export async function probeRedisTopology(): Promise<RedisTopology> {
  const primaryUrl = resolveRedisPrimaryUrl();
  const replicaUrl = resolveRedisReplicaUrl();
  const [primary, replica] = await Promise.all([
    probeRedisInstance('primary', primaryUrl, 6379),
    probeRedisInstance('replica', replicaUrl, 6380),
  ]);
  return {
    overall: classifyRedisTopologyOverall(primary, replica),
    primary,
    replica,
    useReplicaReads: isRedisReplicaReadsEnabled(),
    generatedAt: new Date().toISOString(),
  };
}
