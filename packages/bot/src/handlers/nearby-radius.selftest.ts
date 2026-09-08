/**
 * Guard: radius inline buttons must use callback_data nearby:radius:<km>
 * matching the handler regex and NEARBY_RADII_KM allow-list.
 */
import assert from 'node:assert/strict';
import { NEARBY_RADII_KM, nearbyRadiusKeyboard } from '../keyboards';

const HANDLER_RE = /^nearby:radius:(\d+)$/;

function main(): void {
  const kb = nearbyRadiusKeyboard();
  const datas: string[] = [];
  for (const row of kb.inline_keyboard) {
    for (const btn of row) {
      if ('callback_data' in btn && typeof btn.callback_data === 'string') {
        if (btn.callback_data.startsWith('nearby:radius:')) {
          datas.push(btn.callback_data);
        }
      }
    }
  }

  assert.equal(datas.length, NEARBY_RADII_KM.length, 'expected one button per radius');

  const parsed: number[] = [];
  for (const data of datas) {
    const m = data.match(HANDLER_RE);
    assert.ok(m, `callback_data must match handler regex: ${data}`);
    const km = Number(m![1]);
    assert.ok((NEARBY_RADII_KM as readonly number[]).includes(km), `unexpected radius ${km}`);
    parsed.push(km);
  }

  assert.deepEqual([...parsed].sort((a, b) => a - b), [...NEARBY_RADII_KM].sort((a, b) => a - b));

  // Simulate the previous bug: answering only AFTER getCtxUser would leave the
  // client spinner hanging. This selftest only locks the callback contract.
  console.log('nearby-radius.selftest: ok', parsed.join(','));
}

main();
