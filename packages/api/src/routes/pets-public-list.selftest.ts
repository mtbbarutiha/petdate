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
assert.match(src, /sanitizePetPhotosForViewer/, 'pending photos stripped via shared helper');
assert.match(src, /sendPhotoPlaceholder/, 'unapproved image route serves placeholder');
assert.match(src, /export function publicOwnerAvatarUrl/, 'search cards resolve a real owner avatar');
assert.match(
  src,
  /ownerAvatarUrl: publicOwnerAvatarUrl\(pet\.ownerAvatarUrl\)/,
  'public discovery card includes ownerAvatarUrl'
);
assert.match(src, /isGenderDefaultAvatarPath\(raw\)/, 'shared gender stock face is not an owner photo');
assert.match(src, /publicImageUrlForStored\(raw\)/, 'telegram file_id owner photos become web URLs');
assert.doesNotMatch(
  src,
  /Never include[\s\S]{0,120}owner avatar/,
  'public card no longer documents stripping the owner avatar'
);
const listStart = src.indexOf("petsRouter.get('/',");
const nearbyStart = src.indexOf("petsRouter.get('/nearby'");
assert.ok(listStart >= 0 && nearbyStart > listStart, 'GET / is declared before /nearby');
assert.doesNotMatch(
  src.slice(listStart, nearbyStart),
  /res\.json\(pets\);/,
  'GET / no longer returns raw listPets objects'
);

console.log('pets-public-list.selftest: ok');
