/**
 * HTTP: invalid game / section ids return 400 Persian JSON — never 500.
 * Run: cd packages/api && npx tsx src/routes/games-http.selftest.ts
 */
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-games-http-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.NODE_ENV = 'production';
delete process.env.ALLOW_DEMO_SEEDS;
delete process.env.ALLOW_DEMO_SEED;

import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

function request(
  app: Express,
  method: string,
  path: string
): Promise<{ status: number; body: { error?: string } }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      const req = http.request(
        { hostname: '127.0.0.1', port, path, method },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c as Buffer));
          res.on('end', () => {
            server.close();
            const raw = Buffer.concat(chunks).toString('utf8');
            let body: { error?: string } = {};
            try {
              body = JSON.parse(raw) as { error?: string };
            } catch {
              body = { error: raw };
            }
            resolve({ status: res.statusCode || 0, body });
          });
        }
      );
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      req.end();
    });
  });
}

async function main() {
  const express = (await import('express')).default;
  const { getDb } = await import('../db.ts');
  getDb();
  const { gamesRouter } = await import('./games.ts');
  const { sectionsRouter } = await import('./sections.ts');

  const app = express();
  app.use(express.json());
  app.use('/api/games', gamesRouter);
  app.use('/api/sections', sectionsRouter);

  const list = await request(app, 'GET', '/api/games/list');
  assert.equal(list.status, 200, 'happy-path /list stays 200');
  assert.ok(Array.isArray(list.body as unknown as unknown[]), 'list returns array');

  const root = await request(app, 'GET', '/api/games');
  assert.equal(root.status, 200, 'happy-path GET / stays 200');

  const badIds = ['NaN', 'undefined', 'abc', 'list-not', '1.5', '-1', '0'];
  for (const id of badIds) {
    const url = `/api/games/${encodeURIComponent(id)}`;
    const res = await request(app, 'GET', url);
    assert.equal(res.status, 400, `${url} must be 400 not ${res.status}`);
    assert.match(String(res.body.error || ''), /شناسه/, `${url} Persian error`);
  }

  const badSection = await request(app, 'GET', '/api/games/list?sectionId=NaN');
  assert.equal(badSection.status, 400, 'invalid sectionId query is 400');
  assert.match(String(badSection.body.error || ''), /شناسه/);

  const emptySection = await request(app, 'GET', '/api/games/list?sectionId=');
  assert.equal(emptySection.status, 200, 'empty sectionId lists all (not 500)');

  const undefSection = await request(app, 'GET', '/api/games/list?sectionId=undefined');
  assert.equal(undefSection.status, 400, 'sectionId=undefined is 400');

  for (const id of ['NaN', 'abc', 'undefined']) {
    const url = `/api/sections/${encodeURIComponent(id)}/games`;
    const res = await request(app, 'GET', url);
    assert.equal(res.status, 400, `${url} must be 400 not ${res.status}`);
    assert.match(String(res.body.error || ''), /شناسه/);
  }

  console.log('games-http.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
