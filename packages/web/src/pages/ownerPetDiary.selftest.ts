/**
 * Owner hub must expose دفتر خاطرات (same APIs as public pet page).
 * Run: npx tsx packages/web/src/pages/ownerPetDiary.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDiaryWhen } from '../lib/diaryDate.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');
const detail = readFileSync(join(dir, 'PetDetailPage.tsx'), 'utf8');
const publicPet = readFileSync(join(dir, 'PublicPetPage.tsx'), 'utf8');
const book = readFileSync(join(root, 'components/PetDiaryBook.tsx'), 'utf8');
const myPets = readFileSync(join(dir, 'MyPetsPage.tsx'), 'utf8');
const fa = readFileSync(join(root, 'i18n/locales/fa.ts'), 'utf8');
const en = readFileSync(join(root, 'i18n/locales/en.ts'), 'utf8');
const dark = readFileSync(join(root, 'styles/theme-dark.css'), 'utf8');
const css = readFileSync(join(root, 'styles/pepito.css'), 'utf8');

assert.match(detail, /id="pet-diary"/, 'owner pet detail has #pet-diary anchor');
assert.match(detail, /listPetDiary/, 'owner detail lists diary');
assert.match(detail, /createPetDiaryEntry/, 'owner detail creates diary entries');
assert.match(detail, /deletePetDiaryEntry/, 'owner detail deletes diary entries');
assert.match(detail, /PetDiaryBook/, 'owner detail uses shared diary book');
assert.match(detail, /pepito-pet-diary|PetDiaryBook/, 'reuses pepito-pet-diary styles');
assert.match(detail, /isMyPet[\s\S]*pet-diary|pet-diary[\s\S]*isMyPet/, 'diary gated by isMyPet');
assert.match(detail, /href="#pet-diary"/, 'owner actions link to diary');
assert.match(detail, /location\.hash === '#pet-diary'/, 'hash scroll for diary');

assert.match(publicPet, /PetDiaryBook/, 'public pet page uses shared diary book');
assert.match(publicPet, /listPetDiary/, 'public page lists diary');
assert.match(publicPet, /createPetDiaryEntry/, 'public page can create when owner');
assert.match(publicPet, /deletePetDiaryEntry/, 'public page can delete when owner');

assert.match(book, /pepito-pet-diary-portrait/, 'diary book shows pet portrait cover');
assert.match(book, /pepito-pet-diary-list/, 'continuous diary list');
assert.match(book, /createPetDiaryEntry|onSubmit/, 'compose still wired');
assert.match(book, /onDelete/, 'delete still wired');
assert.match(book, /pets\.diaryOf/, 'title uses i18n');
assert.match(book, /pets\.diarySubmit/, 'submit uses i18n');

assert.match(myPets, /#pet-diary/, 'MyPets cards link to diary hash');
assert.match(myPets, /pets\.diaryShort/, 'MyPets uses diary i18n key');
assert.match(myPets, /BookOpen/, 'MyPets diary action uses BookOpen icon');

assert.match(fa, /diaryShort:\s*"خاطرات"/, 'FA diary short label');
assert.match(en, /diaryShort:\s*"Diary"/, 'EN diary short label');
assert.match(fa, /diaryOf:/, 'FA diaryOf key');
assert.match(en, /diaryOf:/, 'EN diaryOf key');
assert.match(fa, /diaryLead:/, 'FA diary lead');
assert.match(en, /diaryLead:/, 'EN diary lead');
assert.match(fa, /diaryBack:/, 'FA diary back');
assert.match(en, /diaryBack:/, 'EN diary back');

assert.match(css, /\.pepito-pet-diary\s*\{[\s\S]*--pet-diary-ink/, 'diary CSS vars on section');
assert.match(css, /--pet-diary-hand/, 'handwriting font stack');
assert.match(css, /font-family:\s*'Gandom'/, 'Gandom handwriting face');
assert.match(css, /\.pepito-pet-diary-portrait/, 'cover portrait style');
assert.match(css, /\.pepito-pet-diary-submit[\s\S]*#6d3b32/, 'compose button is ink, not the form pill');
assert.match(css, /\.pepito-pet-diary-entry \+ \.pepito-pet-diary-entry/, 'continuous entries not cards');
assert.match(css, /\.pepito-my-pets-action--diary/, 'MyPets diary action style');
assert.match(
  css,
  /\.pepito-pet-profile\.is-diary-focus[\s\S]*\.pepito-pet-profile-hero/,
  'diary hash becomes a dedicated page'
);
assert.doesNotMatch(
  css,
  /\.pepito-pet-diary-entry\s*\{[\s\S]{0,180}border-radius:\s*14px/,
  'entries are not bordered cards'
);

assert.match(dark, /html\[data-theme='dark'\][\s\S]*\.pepito-pet-diary/, 'dark mode diary overrides');
assert.match(dark, /--pet-diary-ink:\s*#efe6d8/, 'dark diary ink readable');
assert.match(dark, /\.pepito-pet-diary-book/, 'dark styles the notebook sheet');

const whenFa = formatDiaryWhen('2026-09-12T10:00:00.000Z', 'fa');
const whenEn = formatDiaryWhen('2026-09-12T10:00:00.000Z', 'en');
assert.match(whenFa, /[۰-۹0-9]/, 'FA diary date has digits');
assert.match(whenEn, /Sep|September|12/, 'EN diary date is readable');

console.log('ownerPetDiary.selftest: ok');
