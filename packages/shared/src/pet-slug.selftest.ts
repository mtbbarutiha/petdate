/**
 * Run: npx tsx packages/shared/src/pet-slug.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  isNumericPetIdParam,
  petPublicPath,
  slugifyPetName,
  PET_SLUG_RESERVED,
} from './pet-slug';

assert.equal(slugifyPetName('Benji'), 'benji');
assert.equal(slugifyPetName('Teddy'), 'teddy');
assert.equal(slugifyPetName('بنجی'), 'bnji');
assert.equal(slugifyPetName('داکوتا'), 'dakvta');
assert.equal(slugifyPetName('  Max  Rex  '), 'max-rex');
assert.equal(slugifyPetName('۳۵'), 'pet');
assert.equal(slugifyPetName('35'), 'pet');
assert.equal(slugifyPetName('photos'), 'pet');
assert.ok(PET_SLUG_RESERVED.has('nearby'));
assert.equal(isNumericPetIdParam('35'), true);
assert.equal(isNumericPetIdParam('benji'), false);
assert.equal(petPublicPath({ id: 35, slug: 'teddy' }), '/pet/teddy');
assert.equal(petPublicPath({ id: 35 }), '/pet/35');
console.log('pet-slug.selftest: ok');
