/**
 * Pet slug + diary DB helpers.
 * Run: npx tsx src/routes/pets-slug-diary.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dbSrc = readFileSync(join(process.cwd(), 'src/db.ts'), 'utf8');
const petsSrc = readFileSync(join(process.cwd(), 'src/routes/pets.ts'), 'utf8');

assert.match(dbSrc, /ALTER TABLE pets ADD COLUMN slug TEXT/, 'additive pets.slug column');
assert.match(dbSrc, /CREATE TABLE IF NOT EXISTS pet_diary_entries/, 'pet_diary_entries table');
assert.match(dbSrc, /function backfillPetSlugs/, 'slug backfill on boot');
assert.match(dbSrc, /allocatePetSlug/, 'unique slug allocator');
assert.match(dbSrc, /listPetDiaryEntries/, 'list diary entries');
assert.match(dbSrc, /addPetDiaryEntry/, 'add diary entry');
assert.match(petsSrc, /slug: pet\.slug/, 'public pet card includes slug');

console.log('pets-slug-diary.selftest: ok');
