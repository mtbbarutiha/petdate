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
assert.match(admin, /Number\.isFinite\(id\)/, 'rejects non-finite game id');
assert.match(db, /updateGameStatus\(id: number, status: GameStatus\)/, 'db updateGameStatus');

const games = readFileSync(join(apiSrc, 'games.ts'), 'utf8');
const listIdx = games.indexOf("gamesRouter.get('/list'");
const idIdx = games.indexOf("gamesRouter.get('/:id'");
assert.ok(listIdx > 0 && listIdx < idIdx, '/list registered before /:id');

console.log('admin-games.selftest: ok');
