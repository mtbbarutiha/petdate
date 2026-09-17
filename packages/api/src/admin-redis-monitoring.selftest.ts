/**
 * Selftest for Redis INFO parsing + topology classification (no network).
 */
import assert from 'node:assert/strict';
import {
  classifyRedisTopologyOverall,
  isRedisReplicaReadsEnabled,
  parseRedisInfo,
  redisEndpointFromUrl,
  resolveRedisPrimaryUrl,
  resolveRedisReplicaUrl,
  snapshotFromInfo,
  type RedisInstanceSnapshot,
} from './admin-redis-monitoring';
import { isNonCriticalCheck } from './admin-monitoring';

const samplePrimaryInfo = `
# Server
redis_version:7.2.4
# Clients
connected_clients:12
# Memory
used_memory:1048576
used_memory_human:1.00M
maxmemory:0
# Replication
role:master
connected_slaves:1
master_repl_offset:99
`;

const sampleReplicaInfo = `
# Clients
connected_clients:3
# Memory
used_memory:524288
used_memory_human:512.00K
maxmemory:0
# Replication
role:slave
master_link_status:up
master_last_io_seconds_ago:2
slave_read_only:1
slave_repl_offset:99
`;

const parsed = parseRedisInfo(samplePrimaryInfo);
assert.equal(parsed.role, 'master');
assert.equal(parsed.connected_clients, '12');
assert.equal(parsed.used_memory_human, '1.00M');
assert.equal(parsed.connected_slaves, '1');

const primary = snapshotFromInfo('primary', '127.0.0.1', 6379, parsed, 4);
assert.equal(primary.status, 'up');
assert.equal(primary.role, 'master');
assert.equal(primary.connectedClients, 12);
assert.equal(primary.connectedSlaves, 1);
assert.equal(primary.usedMemory, '1.00M');
assert.equal(primary.pingLatencyMs, 4);
assert.match(primary.detail, /127\.0\.0\.1:6379/);

const replica = snapshotFromInfo(
  'replica',
  '127.0.0.1',
  6380,
  parseRedisInfo(sampleReplicaInfo),
  6,
);
assert.equal(replica.status, 'up');
assert.equal(replica.role, 'slave');
assert.equal(replica.masterLinkStatus, 'up');
assert.equal(replica.readOnly, true);
assert.equal(replica.masterLastIoSecondsAgo, 2);

const laggy = snapshotFromInfo(
  'replica',
  '127.0.0.1',
  6380,
  parseRedisInfo(`role:slave\nmaster_link_status:up\nmaster_last_io_seconds_ago:45\nslave_read_only:1\n`),
  1,
);
assert.equal(laggy.status, 'warn');

const brokenLink = snapshotFromInfo(
  'replica',
  '127.0.0.1',
  6380,
  parseRedisInfo(`role:slave\nmaster_link_status:down\nslave_read_only:1\n`),
  1,
);
assert.equal(brokenLink.status, 'warn');

const downReplica: RedisInstanceSnapshot = {
  ...replica,
  status: 'down',
  detail: '127.0.0.1:6380 · unreachable',
};
assert.equal(classifyRedisTopologyOverall(primary, replica), 'healthy');
assert.equal(classifyRedisTopologyOverall(primary, downReplica), 'degraded');
assert.equal(
  classifyRedisTopologyOverall({ ...primary, status: 'down' }, downReplica),
  'down',
);

assert.equal(isNonCriticalCheck('redisReplica', true), true);
assert.equal(isNonCriticalCheck('redis', true), false);

const ep = redisEndpointFromUrl('redis://:s3cret@10.0.0.5:6390/0', 6379);
assert.equal(ep.host, '10.0.0.5');
assert.equal(ep.port, 6390);
// Credentials must never appear in endpoint helpers used by the API.
assert.equal(JSON.stringify(ep).includes('s3cret'), false);

const prevPrimary = process.env.REDIS_URL;
const prevReplica = process.env.REDIS_READ_URL;
const prevUse = process.env.USE_REDIS_REPLICA;
try {
  delete process.env.REDIS_URL;
  delete process.env.REDIS_READ_URL;
  delete process.env.USE_REDIS_REPLICA;
  assert.equal(resolveRedisPrimaryUrl(), 'redis://127.0.0.1:6379');
  assert.equal(resolveRedisReplicaUrl(), 'redis://127.0.0.1:6380');
  assert.equal(isRedisReplicaReadsEnabled(), false);

  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  process.env.REDIS_READ_URL = 'redis://127.0.0.1:6380';
  process.env.USE_REDIS_REPLICA = 'true';
  assert.equal(resolveRedisPrimaryUrl(), 'redis://127.0.0.1:6379');
  assert.equal(resolveRedisReplicaUrl(), 'redis://127.0.0.1:6380');
  assert.equal(isRedisReplicaReadsEnabled(), true);
} finally {
  if (prevPrimary === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = prevPrimary;
  if (prevReplica === undefined) delete process.env.REDIS_READ_URL;
  else process.env.REDIS_READ_URL = prevReplica;
  if (prevUse === undefined) delete process.env.USE_REDIS_REPLICA;
  else process.env.USE_REDIS_REPLICA = prevUse;
}

console.log('admin-redis-monitoring.selftest: OK');
