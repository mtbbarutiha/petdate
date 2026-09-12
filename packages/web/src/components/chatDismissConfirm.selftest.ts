/**
 * Inbox / thread dismiss must open ConfirmModal (not window.confirm / immediate API).
 * Run: npx tsx packages/web/src/components/chatDismissConfirm.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');
const chatPage = readFileSync(join(root, 'pages/ChatPage.tsx'), 'utf8');
const css = readFileSync(join(root, 'styles/chat.css'), 'utf8');

assert.match(chatPage, /from '\.\/ConfirmModal'|from '\.\.\/components\/ConfirmModal'/, 'ChatPage imports ConfirmModal');
assert.match(chatPage, /chat-dismiss-confirm/, 'dismiss confirm has test id');
assert.match(chatPage, /dismissConfirm/, 'dismiss confirm state');
assert.match(chatPage, /requestDismissFromList/, 'list trash opens confirm, not API');
assert.match(chatPage, /requestDismissFromThread/, 'thread menu opens confirm, not API');
assert.match(chatPage, /confirmDismissPending/, 'confirm handler exists');
assert.match(chatPage, /می‌خواهید این گفتگو از فهرست چت‌ها حذف شود؟/, 'FA body asks to remove from list');
assert.match(chatPage, /confirmLabel="تأیید"/, 'FA confirm label');
assert.match(chatPage, /cancelLabel="انصراف"/, 'FA cancel label');
assert.doesNotMatch(chatPage, /window\.confirm/, 'must not use native window.confirm');
assert.doesNotMatch(
  chatPage,
  /onDismiss=\{\(item\) => void dismissInboxRow\(item\)\}/,
  'list dismiss must not call API immediately'
);
assert.doesNotMatch(
  chatPage,
  /onClick=\{\(\) => void removeFromInbox\(\)\}/,
  'thread dismiss must not call API immediately'
);

/* Same-row trash (coordinate with layout fix) */
assert.match(
  css,
  /\.tg-chat-list-row\s*\{[^}]*flex-direction:\s*row/s,
  'chat list row is horizontal for dismiss'
);
assert.match(css, /\.tg-chat-list-dismiss\s*\{[^}]*flex:\s*0\s+0\s+auto/s, 'dismiss stays inline');

console.log('chatDismissConfirm.selftest: ok');
