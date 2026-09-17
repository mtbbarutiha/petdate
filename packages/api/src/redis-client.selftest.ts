/**
 * Selftest for Redis dual-client routing (no live Redis required).
 * Run: npx tsx src/redis-client.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  isRedisReadCommand,
  isRedisWriteOnlyCommand,
  resetRedisClientState,
  resolveAppRedisPrimaryUrl,
  resolveAppRedisReadUrl,
  shouldUseRedisReplicaReads,
} from './redis-client';

assert.equal(isRedisReadCommand('GET'), true);
assert.equal(isRedisReadCommand('mget'), true);
assert.equal(isRedisReadCommand('hgetall'), true);
assert.equal(isRedisReadCommand('SET'), false);
assert.equal(isRedisWriteOnlyCommand('SET'), true);
assert.equal(isRedisWriteOnlyCommand('setnx'), true);
assert.equal(isRedisWriteOnlyCommand('SETNX'), true);
assert.equal(isRedisWriteOnlyCommand('multi'), true);
assert.equal(isRedisWriteOnlyCommand('publish'), true);
assert.equal(isRedisWriteOnlyCommand('xadd'), true);
assert.equal(isRedisWriteOnlyCommand('get'), false);

const prev = {
  REDIS_URL: process.env.REDIS_URL,
  REDIS_READ_URL: process.env.REDIS_READ_URL,
  USE_REDIS_REPLICA: process.env.USE_REDIS_REPLICA,
};

function restoreEnv() {
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  resetRedisClientState();
}

try {
  delete process.env.REDIS_URL;
  delete process.env.REDIS_READ_URL;
  delete process.env.USE_REDIS_REPLICA;
  resetRedisClientState();
  assert.equal(shouldUseRedisReplicaReads(), false);
  assert.equal(resolveAppRedisPrimaryUrl(), null);
  assert.equal(resolveAppRedisReadUrl(), null);

  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  process.env.REDIS_READ_URL = 'redis://127.0.0.1:6380';
  process.env.USE_REDIS_REPLICA = 'false';
  assert.equal(shouldUseRedisReplicaReads(), false);
  assert.equal(resolveAppRedisPrimaryUrl(), 'redis://127.0.0.1:6379');
  // Flag off → read URL resolves to primary.
  assert.equal(resolveAppRedisReadUrl(), 'redis://127.0.0.1:6379');

  process.env.USE_REDIS_REPLICA = 'true';
  assert.equal(shouldUseRedisReplicaReads(), true);
  assert.equal(resolveAppRedisReadUrl(), 'redis://127.0.0.1:6380');

  // Flag on but no REDIS_READ_URL → do not invent a replica endpoint.
  delete process.env.REDIS_READ_URL;
  assert.equal(shouldUseRedisReplicaReads(), false);
  assert.equal(resolveAppRedisReadUrl(), 'redis://127.0.0.1:6379');

  process.env.REDIS_READ_URL = 'redis://127.0.0.1:6380';
  process.env.USE_REDIS_REPLICA = '1';
  assert.equal(shouldUseRedisReplicaReads(), true);
  process.env.USE_REDIS_REPLICA = 'yes';
  assert.equal(shouldUseRedisReplicaReads(), true);
  process.env.USE_REDIS_REPLICA = 'on';
  assert.equal(shouldUseRedisReplicaReads(), true);
} finally {
  restoreEnv();
}

console.log('redis-client.selftest: OK');
