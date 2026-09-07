/**
 * Guard: playmate web→Telegram fan-out must not be a silent no-op.
 * (ae3a4ca stubbed notifyPlaydateChatTelegram and broke cross-platform chat.)
 */
import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(path.join(__dirname, 'telegram-chat-notify.ts'), 'utf8');

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(src.includes('Deliver a playdate chat line from web/API'), 'missing deliver implementation');
assert(!src.includes('Playmate chat is web-only'), 'stub comment must not remain');
assert(src.includes('telegramCallForm'), 'media form upload required');
assert(src.includes('ownerChatTelegramKeyboard'), 'reply keyboard required');
assert(src.includes('rememberDelivery'), 'tg refs required for wipe');

console.log('telegram-chat-notify.selftest: ok');
