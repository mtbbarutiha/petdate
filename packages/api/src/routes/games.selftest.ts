/**
 * Games route id parsing + /list alias wiring — no DB / network.
 * Run: npx tsx packages/api/src/routes/games.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePositiveIntId } from './parse-positive-int-id.ts';

assert.equal(parsePositiveIntId('list'), null, 'list is not an id');
assert.equal(parsePositiveIntId('abc'), null, 'abc is not an id');
assert.equal(parsePositiveIntId('NaN'), null, 'NaN string');
assert.equal(parsePositiveIntId(NaN), null, 'NaN number');
assert.equal(parsePositiveIntId(0), null, 'zero');
assert.equal(parsePositiveIntId(-1), null, 'negative');
assert.equal(parsePositiveIntId(1.5), null, 'float');
assert.equal(parsePositiveIntId(''), null, 'empty');
assert.equal(parsePositiveIntId(undefined), null, 'undefined');
assert.equal(parsePositiveIntId('42'), 42, 'numeric string');
assert.equal(parsePositiveIntId(7), 7, 'int');
assert.equal(parsePositiveIntId(' 9 '), 9, 'trimmed');

const src = readFileSync(join(process.cwd(), 'src/routes/games.ts'), 'utf8');
assert.match(src, /gamesRouter\.get\('\/list'/, 'GET /list alias registered');
assert.match(src, /parsePositiveIntId/, 'id parsing used');
assert.match(src, /شناسه بازی نامعتبر است/, 'invalid game id 400 copy');

const listIdx = src.indexOf("gamesRouter.get('/list'");
const idIdx = src.indexOf("gamesRouter.get('/:id'");
assert.ok(listIdx >= 0 && idIdx >= 0 && listIdx < idIdx, '/list declared before /:id');

console.log('games.selftest: ok');
