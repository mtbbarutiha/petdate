/**
 * secure-chat-wipe — callback payloads + ended wipe copy for TG inline CTA.
 * Run: npx tsx src/services/secure-chat-wipe.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  SECURE_WIPE_CB,
  secureChatEndedWipeText,
  secureChatWipeInlineKeyboard,
} from './telegram-chat-notify';

function main() {
  assert.equal(SECURE_WIPE_CB.playdate(42), 'securewipe:pd:42');
  assert.equal(SECURE_WIPE_CB.vet(7), 'securewipe:vc:7');

  const pdKb = secureChatWipeInlineKeyboard('playdate', 99);
  assert.equal(pdKb.inline_keyboard[0]?.[0]?.text, '🗑 حذف کل چت');
  assert.equal(pdKb.inline_keyboard[0]?.[0]?.callback_data, 'securewipe:pd:99');

  const vcKb = secureChatWipeInlineKeyboard('vet', 12);
  assert.equal(vcKb.inline_keyboard[0]?.[0]?.callback_data, 'securewipe:vc:12');

  const pdText = secureChatEndedWipeText('playdate');
  assert.match(pdText, /چت امن/);
  assert.match(pdText, /همبازی/);
  assert.match(pdText, /دکمه/);

  const vcText = secureChatEndedWipeText('vet');
  assert.match(vcText, /مشاوره/);

  // Telegram callback_data hard limit
  assert.ok(SECURE_WIPE_CB.playdate(1_000_000_000).length <= 64);
  assert.ok(SECURE_WIPE_CB.vet(1_000_000_000).length <= 64);

  console.log('secure-chat-wipe.selftest: OK');
}

main();
