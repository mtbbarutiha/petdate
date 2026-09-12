import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const chatPage = fs.readFileSync(path.join(root, 'pages/ChatPage.tsx'), 'utf8');
const vetPage = fs.readFileSync(path.join(root, 'pages/VetChatPage.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'lib/api.ts'), 'utf8');
const hook = fs.readFileSync(path.join(root, 'hooks/useChatViewportHeight.ts'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles/chat.css'), 'utf8');

assert.match(chatPage, /PlaymateChatToolbar/, 'gift toolbar in playmate chat');
assert.match(chatPage, /onClick=\{\(\) => void blockPeer\(\)\}/, 'block menu wires blockPeer');
assert.match(chatPage, /مسدود کردن/, 'block from chat menu');
assert.match(chatPage, /حذف از فهرست گفتگوها/, 'dismiss conversation');
assert.match(chatPage, /tg-chat-list-dismiss/, 'list-row dismiss control');
assert.match(chatPage, /chat-dismiss-confirm/, 'dismiss uses ConfirmModal');
assert.match(chatPage, /requestDismissFromList/, 'list trash opens confirm first');
assert.match(chatPage, /ChatVoicePlayer/, 'voice player in playmate chat');
assert.match(chatPage, /ChatGiftBubble/, 'gift bubble');
assert.match(vetPage, /ChatVoicePlayer/, 'voice player in vet chat');
assert.match(vetPage, /مسدود کردن/, 'block in vet chat');
assert.match(api, /sendPlaydateGift/, 'gift API client');
assert.match(api, /dismissPlaydateInbox/, 'dismiss playmate API');
assert.match(api, /addUserBlock/, 'block API client');
assert.match(hook, /composer-fixed-v9/, 'keyboard v9 hook');
assert.match(css, /--tg-vv-height/, 'shell uses visualViewport height');
assert.match(css, /\.tg-voice-player/, 'voice player styles');
assert.match(css, /\.tg-gift-bubble/, 'gift bubble styles');
/* Delete stays on same chat row (not a second line under the item) */
assert.match(
  css,
  /\.tg-chat-list-row\s*\{[^}]*flex-direction:\s*row/s,
  'chat list row is horizontal for dismiss'
);
assert.match(css, /\.tg-chat-list-dismiss\s*\{[^}]*flex:\s*0\s+0\s+auto/s, 'dismiss does not grow/wrap');
assert.match(
  css,
  /\.tg-chat-list-row\s*>\s*\.tg-chat-list-item\s*\{[^}]*width:\s*auto\s*!important/s,
  'list item yields width so dismiss stays inline'
);
assert.doesNotMatch(chatPage, /window\.confirm/, 'dismiss must not use window.confirm');

console.log('chatGiftVoice selftest ok');
