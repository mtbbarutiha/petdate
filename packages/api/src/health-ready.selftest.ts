/**
 * Readiness helper — no live Postgres/Redis required.
 * Run: cd packages/api && npx tsx src/health-ready.selftest.ts
 */
import assert from 'node:assert/strict';

const prevDb = process.env.DATABASE_URL;
const prevRedis = process.env.REDIS_URL;

process.env.DATABASE_URL = '';
process.env.REDIS_URL = '';

async function main() {
  const { checkReadiness, pingPostgres, pingRedis } = await import('./health-ready');

  assert.equal(await pingPostgres(), 'skipped', 'empty DATABASE_URL skips postgres');
  assert.equal(await pingRedis(), 'skipped', 'empty REDIS_URL skips redis');

  const ready = await checkReadiness();
  assert.equal(ready.ok, true, 'ready when data plane not configured');
  assert.equal(ready.postgres, 'skipped');
  assert.equal(ready.redis, 'skipped');
  assert.equal(ready.service, 'petdate-api');

  process.env.DATABASE_URL = 'postgresql://petdate:petdate@127.0.0.1:59999/petdate';
  assert.equal(await pingPostgres(250), 'down', 'unreachable postgres is down');
  const down = await checkReadiness(250);
  assert.equal(down.ok, false, 'ready fails when configured postgres is unreachable');
  assert.equal(down.postgres, 'down');

  console.log('health-ready.selftest: ok');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
    if (prevRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prevRedis;
  });
