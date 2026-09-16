/**
 * Permanent sample pet events catalog — runs in production without ALLOW_DEMO_SEEDS.
 * Run: cd packages/api && npx tsx src/sample-pet-events-seed.selftest.ts
 */
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-sample-events-${process.pid}.db`;
process.env.NODE_ENV = 'production';
process.env.ALLOW_DEMO_SEEDS = '0';
process.env.ALLOW_DEMO_SEED = '0';
delete process.env.SEED_DEMO_DATA;

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SAMPLE_EVENTS_CATALOG_MARKER,
  SAMPLE_EVENTS_HOST_TELEGRAM_ID,
  SAMPLE_PET_EVENTS,
  cancelJunkOpenEvents,
  seedSamplePetEvents,
} from './sample-pet-events-seed.ts';

async function main() {
  const { getDb, dbService } = await import('./db');
  const db = getDb();

  // Boot already seeds via getDb() even with NODE_ENV=production / ALLOW_DEMO_SEEDS=0.
  const afterBoot = dbService.listGames({ status: 'open' }).filter((g) =>
    SAMPLE_PET_EVENTS.some((s) => s.title === g.title)
  );
  assert.equal(afterBoot.length, SAMPLE_PET_EVENTS.length, 'boot seeds catalog events in production');

  const first = seedSamplePetEvents(db);
  const second = seedSamplePetEvents(db);
  assert.equal(first.inserted, 0, 'idempotent: no duplicate insert');
  assert.equal(first.updated, SAMPLE_PET_EVENTS.length, 'first refresh updates all samples');
  assert.equal(second.inserted, 0, 'second pass inserts nothing');
  assert.equal(second.updated, SAMPLE_PET_EVENTS.length, 'second pass updates all samples');

  const host = db
    .prepare('SELECT id, telegram_id, name FROM users WHERE telegram_id = ?')
    .get(SAMPLE_EVENTS_HOST_TELEGRAM_ID) as
    | { id: number; telegram_id: string; name: string }
    | undefined;
  assert.ok(host, 'catalog host exists');
  assert.equal(host!.telegram_id, SAMPLE_EVENTS_HOST_TELEGRAM_ID);
  assert.equal(host!.name, 'پت‌دیت');

  const open = dbService.listGames({ status: 'open' });
  const samples = open.filter((g) =>
    SAMPLE_PET_EVENTS.some((s) => s.title === g.title)
  );
  assert.equal(samples.length, SAMPLE_PET_EVENTS.length, 'all open catalog events');

  for (const def of SAMPLE_PET_EVENTS) {
    const g = samples.find((x) => x.title === def.title);
    assert.ok(g, def.title);
    assert.equal(g!.gameType, def.gameType);
    assert.equal(g!.photoUrl, def.photo);
    assert.equal(g!.photoStatus, 'approved');
    assert.equal(g!.province, def.province);
    assert.equal(g!.city, def.city);
    assert.equal(g!.joinFeeCoins, def.joinFee);
    assert.ok(
      String(g!.services || '').includes(SAMPLE_EVENTS_CATALOG_MARKER),
      `${def.title} has catalog marker`
    );
  }

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const photos = SAMPLE_PET_EVENTS.map((d) => d.photo);
  assert.equal(new Set(photos).size, photos.length, 'each catalog event has a unique cover photo');
  for (const def of SAMPLE_PET_EVENTS) {
    const photoPath = path.join(repoRoot, 'packages/web/public', def.photo.replace(/^\//, ''));
    assert.ok(fs.existsSync(photoPath), `stock photo exists: ${def.photo}`);
    const st = fs.statSync(photoPath);
    assert.ok(st.size > 40_000, `${def.photo} should be a real cover (got ${st.size} bytes)`);
  }

  // Soft-deleted host + garbage volleyball title (matches live junk pattern).
  const soft = db
    .prepare(
      `INSERT INTO users (telegram_id, name, username, coins, role, onboarding)
       VALUES (?, ?, ?, 0, 'pet_owner', 'profile_complete')`
    )
    .run(`junk_host_${process.pid}`, '[حذف‌شده #999]', null);
  const softHostId = Number(soft.lastInsertRowid);
  db.prepare(
    `INSERT INTO games (
      title, game_type, host_user_id, location, scheduled_at, max_players, status, description
    ) VALUES (?, 'volleyball', ?, 'ونک', ?, 9, 'open', ?)`
  ).run('بقثقثفقث', softHostId, new Date().toISOString(), 'شسیشسیسشیشسیشسی');

  const cancelled = cancelJunkOpenEvents(db);
  assert.ok(cancelled >= 1, 'junk cancelled');
  const junk = db
    .prepare(`SELECT status FROM games WHERE title = ?`)
    .get('بقثقثفقث') as { status: string };
  assert.equal(junk.status, 'cancelled');

  const stillOpen = dbService.listGames({ status: 'open' });
  assert.equal(
    stillOpen.filter((g) => g.title === 'بقثقثفقث').length,
    0,
    'junk not in open list'
  );

  console.log('sample-pet-events-seed.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
