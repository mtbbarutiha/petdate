/**
 * GET /api/pets/:id must reject non-numeric ids before SQLite bind (was HTTP 500).
 * Run: npx tsx src/routes/pets-id-guard.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'pets.ts'), 'utf8');

assert.match(src, /petsRouter\.get\('\/mine'/, 'GET /mine is registered before /:id');
assert.match(src, /شناسه پت نامعتبر است/, 'non-numeric pet id returns 400 copy');
assert.match(src, /Number\.isFinite\(petId\)/, 'GET /:id guards NaN');

const mineIdx = src.indexOf("petsRouter.get('/mine'");
const idIdx = src.indexOf("petsRouter.get('/:id'");
assert.ok(mineIdx >= 0 && idIdx >= 0 && mineIdx < idIdx, '/mine is declared before /:id');

console.log('pets-id-guard.selftest: ok');
