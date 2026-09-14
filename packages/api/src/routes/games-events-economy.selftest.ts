/**
 * Event create cost, join fee debit, photo gating, pet types.
 * Run: cd packages/api && npx tsx src/routes/games-events-economy.selftest.ts
 */
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-games-economy-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.NODE_ENV = 'production';
delete process.env.ALLOW_DEMO_SEEDS;
delete process.env.ALLOW_DEMO_SEED;
delete process.env.SEED_DEMO_DATA;

import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import {
  EVENT_CREATE_COST,
  EVENT_GAME_TYPES,
  sanitizeGamePhotoForViewer,
} from '@petdate/shared';

function request(
  app: Express,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      const payload = body != null ? JSON.stringify(body) : undefined;
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : undefined,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c as Buffer));
          res.on('end', () => {
            server.close();
            const raw = Buffer.concat(chunks).toString('utf8');
            let parsed: Record<string, unknown> = {};
            try {
              parsed = JSON.parse(raw) as Record<string, unknown>;
            } catch {
              parsed = { error: raw };
            }
            resolve({ status: res.statusCode || 0, body: parsed });
          });
        }
      );
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

async function main() {
  assert.equal(EVENT_CREATE_COST, 100, 'create cost is 100 coins');
  assert.ok(EVENT_GAME_TYPES.includes('pet_dating'), 'pet_dating in types');
  assert.ok(EVENT_GAME_TYPES.includes('group_walk'), 'group_walk in types');
  assert.ok(!(EVENT_GAME_TYPES as readonly string[]).includes('football'), 'sports not in create list');

  const { getDb, dbService } = await import('../db.ts');
  getDb();

  const { user: host } = dbService.findOrCreateUser({
    telegramId: `evt_host_${process.pid}`,
    name: 'میزبان تست',
  });
  assert.ok(host?.id, 'host created');
  dbService.creditCoins(host.id, 500, undefined, { reason: 'test_topup', skipLedger: true });
  const hostStart = Number(dbService.getUserById(host.id)!.coins) || 0;

  const { user: poor } = dbService.findOrCreateUser({
    telegramId: `evt_poor_${process.pid}`,
    name: 'بی\u200cسکه',
  });
  assert.ok(poor?.id);
  const poorBal = Number(dbService.getUserById(poor.id)!.coins) || 0;
  if (poorBal >= EVENT_CREATE_COST) {
    dbService.debitCoins(poor.id, poorBal, { reason: 'test_drain', skipLedger: true });
  }

  const when = new Date();
  when.setDate(when.getDate() + 2);

  const denied = dbService.createGame({
    title: 'باید رد شود',
    gameType: 'pet_dating',
    hostUserId: poor.id,
    location: 'تهران',
    province: 'تهران',
    city: 'تهران',
    scheduledAt: when.toISOString(),
    maxPlayers: 8,
  });
  assert.ok(denied.error, 'insufficient coins blocks create');
  assert.equal(denied.need, EVENT_CREATE_COST);

  const created = dbService.createGame({
    title: 'پت دیتینگ تست',
    gameType: 'pet_dating',
    hostUserId: host.id,
    location: 'پارک ملت',
    province: 'تهران',
    city: 'تهران',
    scheduledAt: when.toISOString(),
    maxPlayers: 8,
    joinFeeCoins: 25,
    services: 'آب خنک',
    photoUrl: '/events/sample-dating.jpg',
  });
  assert.ok(!created.error, created.error || 'create ok');
  assert.ok(created.game?.id);
  assert.equal(created.game.photoStatus, 'pending', 'uploaded photo starts pending');
  assert.equal(created.game.joinFeeCoins, 25);
  assert.equal(created.game.services, 'آب خنک');

  const hostAfter = dbService.getUserById(host.id)!;
  assert.equal(Number(hostAfter.coins), hostStart - EVENT_CREATE_COST, 'create debit 100');

  const publicView = sanitizeGamePhotoForViewer(created.game, undefined);
  assert.equal(publicView.photoUrl, undefined, 'pending photo hidden from public');

  const hostView = sanitizeGamePhotoForViewer(created.game, host.id);
  assert.equal(hostView.photoUrl, '/events/sample-dating.jpg', 'host sees pending photo');

  dbService.setGamePhotoStatus(created.game.id, 'approved');
  const approved = dbService.getGame(created.game.id)!;
  assert.equal(
    sanitizeGamePhotoForViewer(approved, undefined).photoUrl,
    '/events/sample-dating.jpg',
    'approved photo public'
  );

  const { user: joiner } = dbService.findOrCreateUser({
    telegramId: `evt_join_${process.pid}`,
    name: 'عضو',
  });
  dbService.creditCoins(joiner.id, 100, undefined, { reason: 'test_topup', skipLedger: true });
  const joinerStart = Number(dbService.getUserById(joiner.id)!.coins) || 0;
  const beforeJoinHost = Number(dbService.getUserById(host.id)!.coins) || 0;
  const joined = dbService.joinGame(created.game.id, joiner.id);
  assert.ok(!joined.error, joined.error || 'join ok');
  const afterJoiner = dbService.getUserById(joiner.id)!;
  assert.equal(Number(afterJoiner.coins), joinerStart - 25, 'join fee debited');
  const afterHost = dbService.getUserById(host.id)!;
  assert.equal(Number(afterHost.coins), beforeJoinHost + 25, 'host credited join fee');

  const { user: broke } = dbService.findOrCreateUser({
    telegramId: `evt_broke_${process.pid}`,
    name: 'کمبود',
  });
  const brokeBal = Number(dbService.getUserById(broke.id)!.coins) || 0;
  if (brokeBal > 0) {
    dbService.debitCoins(broke.id, brokeBal, { reason: 'test_drain', skipLedger: true });
  }
  const joinFail = dbService.joinGame(created.game.id, broke.id);
  assert.ok(joinFail.error, 'join fails without coins');
  assert.equal(joinFail.need, 25);

  const express = (await import('express')).default;
  const { gamesRouter } = await import('./games.ts');
  const app = express();
  app.use(express.json());
  app.use('/api/games', gamesRouter);

  const meta = await request(app, 'GET', '/api/games/meta/types');
  assert.equal(meta.status, 200);
  const types = meta.body.types as string[];
  assert.ok(Array.isArray(types) && types.includes('pet_dating'));
  assert.equal(meta.body.createCostCoins, 100);

  const list = await request(app, 'GET', '/api/games/list');
  assert.equal(list.status, 200);
  const rows = list.body as unknown as Array<{ id: number; photoUrl?: string }>;
  const row = rows.find((r) => r.id === created.game.id);
  assert.ok(row, 'created event in list');
  assert.equal(row!.photoUrl, '/events/sample-dating.jpg', 'approved visible in list');

  console.log('games-events-economy.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
