/**
 * Guard: «نمایش بصورت لیستی» must be a vertical InlineKeyboard people list
 * (name · distance · city), NOT a JPEG collage path.
 */
import assert from 'node:assert/strict';
import type { PetProfile } from '@petdate/shared';
import { nearbyInlineListKeyboard, nearbySummaryKeyboard } from '../keyboards';

const LIST_RE = /^nearby:list:(\d+)$/;
const PET_RE = /^search:pet:(\d+)$/;

function fakePet(partial: Partial<PetProfile> & { id: number; name: string }): PetProfile {
  return {
    ownerId: 1,
    species: 'dog',
    ...partial,
  } as PetProfile;
}

function main(): void {
  const summary = nearbySummaryKeyboard(5);
  const summaryDatas: string[] = [];
  for (const row of summary.inline_keyboard) {
    for (const btn of row) {
      if ('callback_data' in btn && typeof btn.callback_data === 'string') {
        summaryDatas.push(btn.callback_data);
      }
      if ('text' in btn && btn.text.includes('نمایش بصورت لیستی')) {
        assert.equal(btn.callback_data, 'nearby:list:0');
      }
    }
  }
  assert.ok(summaryDatas.includes('nearby:list:0'), 'summary must open nearby:list:0');

  const pets = [
    fakePet({ id: 11, name: 'ریکس', distanceKm: 1.2, city: 'مشهد', ownerCity: 'مشهد' }),
    fakePet({ id: 22, name: 'میلو', distanceKm: 0.05, ownerCity: 'تهران' }),
    fakePet({ id: 33, name: 'لوکا', distanceKm: 8 }),
  ];

  const kb = nearbyInlineListKeyboard(pets, 0, 8, 3);
  const rows = kb.inline_keyboard;
  assert.ok(rows.length >= 3, 'one row per pet expected');

  const petBtns = rows
    .flat()
    .filter((b) => 'callback_data' in b && typeof b.callback_data === 'string' && PET_RE.test(b.callback_data));

  assert.equal(petBtns.length, 3, 'three tappable people rows');
  for (const btn of petBtns) {
    assert.ok('text' in btn);
    assert.ok(!btn.text.includes('📸') && !btn.text.toLowerCase().includes('jpeg'), 'must not look like photo dump');
    assert.ok(PET_RE.test(String(btn.callback_data)), `bad pet callback: ${btn.callback_data}`);
  }

  const rix = petBtns[0]!;
  assert.ok('text' in rix);
  assert.match(rix.text, /ریکس/);
  assert.match(rix.text, /مشهد/);
  assert.match(rix.text, /کیلومتر|متر|نزدیک/);

  const pageKb = nearbyInlineListKeyboard(
    Array.from({ length: 8 }, (_, i) => fakePet({ id: i + 1, name: `P${i}`, distanceKm: i })),
    1,
    8,
    20
  );
  const pageDatas = pageKb.inline_keyboard
    .flat()
    .map((b) => ('callback_data' in b ? b.callback_data : null))
    .filter((d): d is string => typeof d === 'string' && d.startsWith('nearby:list:'));
  for (const d of pageDatas) {
    assert.ok(LIST_RE.test(d), `pagination must match handler: ${d}`);
  }
  assert.ok(pageDatas.includes('nearby:list:0'), 'prev page');
  assert.ok(pageDatas.includes('nearby:list:2'), 'next page');

  console.log('nearby-inline-list.selftest: ok');
}

main();
