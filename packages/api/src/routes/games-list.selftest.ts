/**
 * GET /api/games/list must not fall through to /:id (NaN → Postgres 500).
 * Run: cd packages/api && npx tsx src/routes/games-list.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(apiSrc, 'routes/games.ts'), 'utf8');
const db = readFileSync(join(apiSrc, 'db.ts'), 'utf8');

assert.match(src, /gamesRouter\.get\('\/list'/, 'GET /list is registered');
assert.match(src, /gamesRouter\.get\('\/'/, 'GET / is registered');
assert.match(src, /شناسه بازی نامعتبر است/, 'invalid game id returns 400 copy');
assert.match(src, /Number\.isFinite\(id\)/, 'game id is finite-checked');

const listIdx = src.indexOf("gamesRouter.get('/list'");
const idIdx = src.indexOf("gamesRouter.get('/:id'");
assert.ok(listIdx >= 0 && idIdx >= 0 && listIdx < idIdx, '/list is declared before /:id');

const slashIdx = src.indexOf("gamesRouter.get('/',");
assert.ok(slashIdx >= 0 && slashIdx < idIdx, 'GET / is declared before /:id');

assert.match(
  src,
  /parseGameId\(req\.params\.id\)/,
  '/:id and /:id/join use parseGameId (not Number() into SQL)'
);
assert.doesNotMatch(
  src,
  /getGame\(Number\(req\.params\.id\)\)/,
  'getGame no longer receives raw Number(params.id)'
);

assert.match(
  db,
  /getGame\(id: number\): Game \| null \{[\s\S]{0,80}Number\.isFinite\(id\)/,
  'getGame rejects NaN/non-positive ids before SQL'
);

console.log('games-list.selftest: ok');
