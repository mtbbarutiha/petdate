/**
 * ReplyKeyboard must not ship Bot API `style` (inline-only) — Telegram 400.
 * Visual distinction on reply menus uses emoji prefixes (shop/invite/coins/roles).
 * Inline keyboards (e.g. coin packages) MAY keep .success()/.primary().
 * Run: npx tsx packages/bot/src/keyboards-reply-styles.selftest.ts
 */
import assert from 'node:assert/strict';
import { InlineKeyboard, Keyboard } from 'grammy';
import { MY_ROLES_LABEL } from '@petdate/shared';
import {
  COMMON_MENU,
  coinsShopKeyboard,
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

// Reply menus restore color via emoji (styles are stripped)
assert.match(COMMON_MENU.shop, /🛒|🛍️|🟢/, 'shop has colorful emoji');
assert.match(COMMON_MENU.invite, /🎁|💙/, 'invite has colorful emoji');
assert.match(COMMON_MENU.coins, /🪙|💰|💙/, 'coins has colorful emoji');
assert.match(MY_ROLES_LABEL, /🎭/, 'MY_ROLES has colorful emoji');

// Inline coin packages KEEP Bot API styles
const coinsRaw = JSON.parse(JSON.stringify(coinsShopKeyboard(null))) as {
  inline_keyboard?: Array<Array<{ style?: string; text?: string }>>;
};
const inlineStyles = (coinsRaw.inline_keyboard ?? []).flatMap((row) =>
  row.map((b) => b.style).filter(Boolean)
);
assert.ok(inlineStyles.length >= 1, 'coin package inline keyboard keeps style');

console.log('keyboards-reply-styles.selftest: ok');
