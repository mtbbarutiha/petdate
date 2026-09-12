/**
 * Find-playmate chats empty state must stay usable on ≤768 / ≤480
 * without regressing desktop header clearance (#294).
 * Run: npx tsx packages/web/src/components/playmateEmptyMobile.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');
const chatCss = readFileSync(join(root, 'styles/chat.css'), 'utf8');
const pepito = readFileSync(join(root, 'styles/pepito.css'), 'utf8');
const globalCss = readFileSync(join(root, 'styles/global.css'), 'utf8');
const chatPage = readFileSync(join(root, 'pages/ChatPage.tsx'), 'utf8');

assert.match(
  chatCss,
  /@media \(max-width: 768px\)[\s\S]*?\.tg-chat-list-empty[\s\S]*?align-content:\s*start/,
  'mobile empty pane top-aligns so CTA is not center-clipped'
);
assert.match(
  chatCss,
  /@media \(max-width: 768px\)[\s\S]*?overflow-x:\s*clip/,
  'mobile empty pane clips horizontal overflow'
);
assert.match(
  chatCss,
  /@media \(max-width: 768px\)[\s\S]*?safe-area-inset-bottom/,
  'mobile empty pane clears bottom safe-area'
);
assert.match(
  chatCss,
  /@media \(max-width: 480px\)[\s\S]*?\.tg-chat-list-empty/,
  '≤480px empty typography/padding rules present'
);
assert.match(
  chatCss,
  /\.find-playmate-one[\s\S]*?overflow-x:\s*clip/,
  'fee card clips divider bleed instead of page scroll'
);
assert.match(
  globalCss,
  /\.find-playmate-one[\s\S]*?overflow-x:\s*clip/,
  'global fee card also clips horizontal bleed'
);
assert.match(
  globalCss,
  /\.find-playmate-one__fee[\s\S]*?overflow-wrap:\s*anywhere/,
  'fee line wraps on narrow widths'
);

assert.match(
  pepito,
  /@media \(min-width: 860px\)[\s\S]*?\.find-playmate-header[\s\S]*?max-width:\s*min\(46%/,
  'desktop header clearance from #294 preserved'
);
assert.match(
  pepito,
  /@media \(max-width: 480px\)[\s\S]*?\.find-playmate-header[\s\S]*?max-width:\s*min\(64vw/,
  '≤480px header mute+CTA shrinks to avoid logo collision'
);
assert.match(
  pepito,
  /@media \(max-width: 859px\)[\s\S]*?\.tg-chat-list-empty \.find-playmate-one/,
  'mobile empty fee card hug rules preserved'
);

assert.match(
  chatPage,
  /tg-chat-list-empty--hub[\s\S]*?ChatEmptyVisual[\s\S]*?chats\.emptyTitle[\s\S]*?FindPlaymatePanel/,
  'mobile empty inbox shows title + find-playmate CTA'
);
assert.match(
  chatPage,
  /FindPlaymatePanel compact showRequests=\{false\}/,
  'mobile empty keeps fee+CTA above fold without requests stack'
);

console.log('playmateEmptyMobile.selftest: ok');
