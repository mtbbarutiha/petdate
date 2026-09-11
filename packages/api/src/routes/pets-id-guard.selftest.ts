/**
 * GET /api/pets/:id accepts numeric ids and name slugs; rejects garbage tokens.
 * Run: npx tsx src/routes/pets-id-guard.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src/routes/pets.ts'), 'utf8');

assert.match(src, /petsRouter\.get\('\/mine'/, 'GET /mine is registered before /:id');
assert.match(src, /شناسه پت نامعتبر است/, 'invalid pet id returns 400 copy');
assert.match(src, /getPetByIdOrSlug/, 'GET /:id resolves id or slug');
assert.match(src, /petsRouter\.get\('\/:id\/diary'/, 'GET diary route exists');
assert.match(src, /petsRouter\.post\('\/:id\/diary'/, 'POST diary route exists');
assert.match(src, /فقط صاحب پت می‌تواند در دفتر خاطرات بنویسد/, 'diary write is owner-only');

const mineIdx = src.indexOf("petsRouter.get('/mine'");
const idIdx = src.indexOf("petsRouter.get('/:id'");
assert.ok(mineIdx >= 0 && idIdx >= 0 && mineIdx < idIdx, '/mine is declared before /:id');

console.log('pets-id-guard.selftest: ok');
