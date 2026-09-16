/**
 * Guard: province / breed / all search results must open as InlineKeyboard rows,
 * never as JPEG list-card collage (DoorDooria-style).
 * Run: cd packages/bot && npx tsx src/handlers/search-keyboard-list.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PetProfile } from '@petdate/shared';
import { searchPetsListKeyboard } from '../keyboards.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const searchSrc = readFileSync(join(dir, 'search.ts'), 'utf8');

assert.doesNotMatch(
  searchSrc,
  /fetchPetsListCardBuffer|fetchNearbyListCardBuffer|search-list\.jpg|nearby-list\.jpg|collageModes/,
  'showSearchResults must not render JPEG list-card collage'
);
assert.match(
  searchSrc,
  /searchPetsListKeyboard\(pets,\s*mode,\s*safePage,\s*PAGE_SIZE\)/,
  'results use DoorDooria inline list keyboard'
);
assert.match(
  searchSrc,
  /editMessageText\(text,\s*\{\s*parse_mode:\s*'HTML',\s*reply_markup:\s*kb\s*\}\)/,
  'pagination edits text+keyboard instead of re-sending collage photos'
);

function fakePet(partial: Partial<PetProfile> & { id: number; name: string }): PetProfile {
  return {
    ownerId: 1,
    species: 'dog',
    ...partial,
  } as PetProfile;
}

const pets = [
  fakePet({ id: 1, name: 'Hachiko', breed: 'گلدن رتریور', city: 'تهران' }),
  fakePet({ id: 2, name: 'کرکی', breed: 'شیتزو', city: 'پردیس' }),
];
const kb = searchPetsListKeyboard(pets, 'province', 0, 8);
const petBtns = kb.inline_keyboard
  .flat()
  .filter((b) => 'callback_data' in b && String(b.callback_data).startsWith('search:pet:'));
assert.equal(petBtns.length, 2);
for (const btn of petBtns) {
  assert.ok('text' in btn);
  assert.match(btn.text, /^🐾 /);
  assert.ok(!btn.text.includes('فاصله نامشخص'));
}

console.log('search-keyboard-list.selftest: ok');
