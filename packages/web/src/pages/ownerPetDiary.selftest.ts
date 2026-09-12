/**
 * Owner hub must expose دفتر خاطرات (same APIs as public pet page).
 * Run: npx tsx packages/web/src/pages/ownerPetDiary.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');
const detail = readFileSync(join(dir, 'PetDetailPage.tsx'), 'utf8');
const myPets = readFileSync(join(dir, 'MyPetsPage.tsx'), 'utf8');
const fa = readFileSync(join(root, 'i18n/locales/fa.ts'), 'utf8');
const en = readFileSync(join(root, 'i18n/locales/en.ts'), 'utf8');
const dark = readFileSync(join(root, 'styles/theme-dark.css'), 'utf8');
const css = readFileSync(join(root, 'styles/pepito.css'), 'utf8');

assert.match(detail, /id="pet-diary"/, 'owner pet detail has #pet-diary anchor');
assert.match(detail, /listPetDiary/, 'owner detail lists diary');
assert.match(detail, /createPetDiaryEntry/, 'owner detail creates diary entries');
assert.match(detail, /deletePetDiaryEntry/, 'owner detail deletes diary entries');
assert.match(detail, /pepito-pet-diary/, 'reuses pepito-pet-diary styles');
assert.match(detail, /isMyPet[\s\S]*pet-diary|pet-diary[\s\S]*isMyPet/, 'diary gated by isMyPet');
assert.match(detail, /href="#pet-diary"/, 'owner actions link to diary');
assert.match(detail, /location\.hash === '#pet-diary'/, 'hash scroll for diary');

assert.match(myPets, /#pet-diary/, 'MyPets cards link to diary hash');
assert.match(myPets, /pets\.diaryShort/, 'MyPets uses diary i18n key');
assert.match(myPets, /BookOpen/, 'MyPets diary action uses BookOpen icon');

assert.match(fa, /diaryShort:\s*"خاطرات"/, 'FA diary short label');
assert.match(en, /diaryShort:\s*"Diary"/, 'EN diary short label');
assert.match(fa, /diaryOf:/, 'FA diaryOf key');
assert.match(en, /diaryOf:/, 'EN diaryOf key');

assert.match(css, /\.pepito-pet-diary\s*\{[\s\S]*--pet-diary-ink/, 'diary CSS vars on section');
assert.match(css, /\.pepito-my-pets-action--diary/, 'MyPets diary action style');
assert.match(dark, /html\[data-theme='dark'\][\s\S]*\.pepito-pet-diary/, 'dark mode diary overrides');
assert.match(dark, /--pet-diary-ink:\s*#efe6d8/, 'dark diary ink readable');

console.log('ownerPetDiary.selftest: ok');
