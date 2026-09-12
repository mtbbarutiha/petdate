/**
 * Breed FA/EN search normalization.
 * Run: npx tsx packages/shared/src/catalog-breed-search.selftest.ts
 */
import assert from 'node:assert/strict';
import { breedMatchesQuery, normalizeBreedQuery, PET_BREEDS_SEED } from './catalog';

assert.equal(normalizeBreedQuery('  Husky  '), 'husky');
assert.equal(normalizeBreedQuery('هاسکی'), 'هاسکی');
assert.equal(normalizeBreedQuery('چی‌واوا'), 'چیواوا'); // ZWNJ stripped
assert.equal(normalizeBreedQuery('يک'), 'یک'); // Arabic letters folded

const husky = PET_BREEDS_SEED.find((b) => b.nameEn === 'Siberian Husky')!;
assert.ok(husky, 'seed has Siberian Husky');
assert.ok(breedMatchesQuery(husky, 'husky'), 'EN: husky');
assert.ok(breedMatchesQuery(husky, 'Husky'), 'EN: Husky case');
assert.ok(breedMatchesQuery(husky, 'هاسکی'), 'FA: هاسکی');
assert.ok(breedMatchesQuery(husky, 'سیبری'), 'FA partial');
assert.ok(breedMatchesQuery(husky, 'siberian'), 'EN partial');
assert.ok(!breedMatchesQuery(husky, 'poodle'), 'no false match');

const chihuahua = PET_BREEDS_SEED.find((b) => b.nameEn === 'Chihuahua')!;
assert.ok(breedMatchesQuery(chihuahua, 'چیواوا'), 'FA without ZWNJ finds چی‌واوا');
assert.ok(breedMatchesQuery(chihuahua, 'chihuahua'), 'EN chihuahua');

console.log('catalog-breed-search.selftest: ok');
