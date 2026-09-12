/**
 * Silent-chat mute in chats header must open ConfirmModal with clear copy
 * (not a bare toggle). Run: npx tsx packages/web/src/components/silentChatConfirm.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');
const panel = readFileSync(join(dir, 'FindPlaymatePanel.tsx'), 'utf8');
const pepito = readFileSync(join(root, 'styles/pepito.css'), 'utf8');
const fa = readFileSync(join(root, 'i18n/locales/fa.ts'), 'utf8');
const en = readFileSync(join(root, 'i18n/locales/en.ts'), 'utf8');

assert.match(panel, /silent-chat-confirm/, 'mute confirm modal has test id');
assert.match(panel, /silentConfirmOpen/, 'mute opens confirm state');
assert.match(panel, /openSilentConfirm/, 'mute button opens confirm, not bare toggle');
assert.match(panel, /chats\.silentEnableBody/, 'enable copy uses i18n');
assert.match(panel, /chats\.silentDisableBody/, 'disable copy uses i18n');
assert.match(panel, /aria-haspopup="dialog"/, 'mute button announces dialog');
assert.doesNotMatch(
  panel,
  /onClick=\{\(\) => void toggleSilent\(\)\}/,
  'mute must not toggle silently without confirm'
);

assert.match(fa, /silentEnableBody:/, 'FA has silent enable body');
assert.match(fa, /دیگر درخواست چت/, 'FA enable body mentions no more chat requests');
assert.match(en, /silentEnableBody:/, 'EN has silent enable body');
assert.match(en, /no longer receive/, 'EN enable body mentions no longer receive');
assert.match(en, /silentDisableBody:/, 'EN has silent disable body');

assert.match(
  pepito,
  /@media \(min-width: 860px\)[\s\S]*?\.find-playmate-header[\s\S]*?max-width:\s*min\(46%/,
  'desktop shrinks find-playmate header away from logo'
);
assert.match(
  pepito,
  /@media \(max-width: 859px\)[\s\S]*?\.find-playmate-header/,
  'mobile find-playmate header rules preserved'
);

console.log('silentChatConfirm.selftest: ok');
