/**
 * Guard: pet search menu is inline (DoorDooria-style), has required filters,
 * and never exposes مشهد / هم سن.
 */
import assert from 'node:assert/strict';
import {
  SEARCH_MENU_CALLBACKS,
  SEARCH_PETS_MENU,
  searchPetsMenuInlineKeyboard,
} from '../keyboards';

const GO_RE = /^search:go:([a-z]+)$/;

function main(): void {
  const kb = searchPetsMenuInlineKeyboard();
  const labels: string[] = [];
  const datas: string[] = [];

  for (const row of kb.inline_keyboard) {
    for (const btn of row) {
      if ('text' in btn && typeof btn.text === 'string') labels.push(btn.text);
      if ('callback_data' in btn && typeof btn.callback_data === 'string') {
        datas.push(btn.callback_data);
      }
    }
  }

  const joined = labels.join('\n');
  assert.ok(!joined.includes('مشهد'), 'Mashhad button must be removed');
  assert.ok(!joined.includes('هم سن'), 'Same-age button must not appear for pets');
  assert.ok(joined.includes('هم استانی') || joined.includes('هم‌استانی') || joined.includes('هم استانی‌ها') || joined.includes(SEARCH_PETS_MENU.sameProvince), 'same province');
  assert.ok(joined.includes(SEARCH_PETS_MENU.sameBreed), 'same breed');
  assert.ok(joined.includes(SEARCH_PETS_MENU.viewAll), 'view all');
  assert.ok(joined.includes(SEARCH_PETS_MENU.advanced), 'advanced');
  assert.ok(joined.includes(SEARCH_PETS_MENU.newest), 'newest pets');
  assert.ok(joined.includes(SEARCH_PETS_MENU.popular), 'popular pets');

  const expected = Object.values(SEARCH_MENU_CALLBACKS);
  assert.equal(datas.length, expected.length, 'one callback per menu action');
  for (const data of datas) {
    const m = data.match(GO_RE);
    assert.ok(m, `callback must match search:go:<mode>: ${data}`);
    assert.ok(expected.includes(data as (typeof expected)[number]), `unexpected ${data}`);
  }

  // reply-menu legacy mashhad label still exists for text routing, but not on inline kb
  assert.equal(SEARCH_PETS_MENU.mashhad, '🏙 مشهد');

  console.log('pet-search-menu.selftest: ok', datas.join(','));
}

main();
