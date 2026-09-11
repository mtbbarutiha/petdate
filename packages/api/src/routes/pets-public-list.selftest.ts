/**
 * Unauthenticated GET /api/pets must not dump a full owner roster.
 * Run: npx tsx src/routes/pets-public-list.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src/routes/pets.ts'), 'utf8');

assert.match(src, /function toPublicPetCard/, 'public pet card helper exists');
assert.match(src, /function presentPet/, 'viewer-aware presenter exists');
assert.match(src, /function isInternalBot/, 'bot token helper exists');
assert.match(src, /health: \{\}/, 'public card strips medical health');
assert.match(src, /lookingForPlaymate === undefined/, 'unauth list defaults to playmate cards');
assert.match(
  src,
  /ownerId != null && !privileged && viewerId == null/,
  'unauth ownerId filter is 401'
);
assert.match(src, /pets\.map\(\(pet\) => presentPet/, 'GET / maps through presenter');
const listStart = src.indexOf("petsRouter.get('/',");
const nearbyStart = src.indexOf("petsRouter.get('/nearby'");
assert.ok(listStart >= 0 && nearbyStart > listStart, 'GET / is declared before /nearby');
assert.doesNotMatch(
  src.slice(listStart, nearbyStart),
  /res\.json\(pets\);/,
  'GET / no longer returns raw listPets objects'
);

console.log('pets-public-list.selftest: ok');
