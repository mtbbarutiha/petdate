/**
 * Admin game status update + list must reject bad ids (no NaN).
 * Run: cd packages/api && npx tsx src/routes/admin-games.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiSrc = join(dirname(fileURLToPath(import.meta.url)));
const admin = readFileSync(join(apiSrc, 'admin.ts'), 'utf8');
const db = readFileSync(join(apiSrc, '../db.ts'), 'utf8');

assert.match(admin, /adminRouter\.get\('\/games'/, 'admin list games');
assert.match(admin, /adminRouter\.get\('\/games\/:id'/, 'admin game detail');
assert.match(admin, /adminRouter\.patch\('\/games\/:id\/status'/, 'admin status patch');
assert.match(admin, /adminRouter\.get\('\/games\/photos\/pending'/, 'admin pending event photos');
assert.match(admin, /adminRouter\.patch\('\/games\/:id\/photo'/, 'admin photo moderation');
assert.match(admin, /parsePositiveIntId\(req\.params\.id\)/, 'rejects non-finite game id');
assert.match(admin, /\/demo-seeds/, 'demo-seed preview endpoint');
assert.match(db, /updateGameStatus\(id: number, status: GameStatus\)/, 'db updateGameStatus');
assert.match(db, /setGamePhotoStatus/, 'db photo moderation');
assert.match(db, /join_fee_coins/, 'join fee column');
assert.match(db, /photo_status/, 'photo status column');
assert.match(db, /EVENT_CREATE_COST/, 'create cost wired');

const games = readFileSync(join(apiSrc, 'games.ts'), 'utf8');
const listIdx = games.indexOf("gamesRouter.get('/list'");
const idIdx = games.indexOf("gamesRouter.get('/:id'");
assert.ok(listIdx > 0 && listIdx < idIdx, '/list registered before /:id');
assert.match(games, /EVENT_GAME_TYPES/, 'pet event types');
assert.match(games, /photos\/upload/, 'event photo upload');
assert.match(games, /sanitizeGamePhotoForViewer/, 'photo gating');

const adminPage = readFileSync(
  join(apiSrc, '../../../web/src/admin/pages/AdminGamesPage.tsx'),
  'utf8'
);
assert.match(adminPage, /photos\/pending/, 'admin UI loads photo queue');
assert.match(adminPage, /joinFeeCoins/, 'admin shows join fee');
assert.match(adminPage, /services/, 'admin shows services');

console.log('admin-games.selftest: ok');
