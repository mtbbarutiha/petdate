/**
 * ReplyKeyboard must not ship Bot API `style` (inline-only) — Telegram 400.
 * Run: npx tsx packages/bot/src/keyboards-reply-styles.selftest.ts
 */
import assert from 'node:assert/strict';
import { Keyboard } from 'grammy';
import {
  finalizeReplyKeyboard,
  mainMenuKeyboard,
  paymentReceiptReplyKeyboard,
  roleReplyKeyboard,
  yesNoReplyKeyboard,
} from './keyboards.ts';

function buttonStyles(kb: Keyboard): string[] {
  const raw = JSON.parse(JSON.stringify(kb)) as {
    keyboard?: Array<Array<{ style?: string }>>;
  };
  const styles: string[] = [];
  for (const row of raw.keyboard ?? []) {
    for (const btn of row) {
      if (btn.style) styles.push(btn.style);
    }
  }
  return styles;
}

const styled = new Keyboard().text('A').primary().text('B').success().resized();
assert.ok(buttonStyles(styled).length >= 2, 'fixture has styles');
assert.deepEqual(buttonStyles(finalizeReplyKeyboard(styled)), [], 'finalize strips styles');
assert.equal(
  JSON.parse(JSON.stringify(finalizeReplyKeyboard(styled))).resize_keyboard,
  true,
  'keeps resize_keyboard'
);

assert.deepEqual(buttonStyles(roleReplyKeyboard([])), [], 'role reply has no styles');
assert.deepEqual(buttonStyles(mainMenuKeyboard('pet_owner', ['pet_owner'])), [], 'main menu has no styles');
assert.deepEqual(buttonStyles(yesNoReplyKeyboard()), [], 'yes/no has no styles');
assert.deepEqual(buttonStyles(paymentReceiptReplyKeyboard()), [], 'payment receipt has no styles');

console.log('keyboards-reply-styles.selftest: ok');
