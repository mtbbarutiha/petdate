/**
 * Mobile chats: header Find CTA + small discovery chips at top.
 * Fee card / full discovery panel stay on desktop thread pane only.
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
const discovery = readFileSync(join(dir, 'PetDiscoveryPanel.tsx'), 'utf8');
const discoveryBar = readFileSync(join(dir, 'ChatDiscoveryBar.tsx'), 'utf8');

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
  chatPage,
  /tg-chat-list-empty--hub[\s\S]*?ChatEmptyVisual[\s\S]*?chats\.emptyTitle/,
  'mobile empty inbox shows title without duplicating fee/discovery card'
);
const playmateEmptyBranch = chatPage.match(
  /\) : \(\s*<>\s*<ChatEmptyVisual \/>\s*<h2>\{t\('chats\.emptyTitle'\)\}<\/h2>\s*<p>\{t\('chats\.pickLead'\)\}<\/p>\s*<\/>\s*\)/
)?.[0];
assert.ok(playmateEmptyBranch, 'playmate empty list is title+lead only (no fee card)');
assert.doesNotMatch(
  playmateEmptyBranch || '',
  /FindPlaymatePanel/,
  'mobile empty list must not embed FindPlaymatePanel (header CTA covers find)'
);
assert.doesNotMatch(
  chatPage,
  /tg-chat-list-hub-cta/,
  'list body must not re-show fee+discovery strip'
);
assert.match(chatPage, /ChatDiscoveryBar/, 'mobile list mounts discovery chip bar');
assert.match(chatPage, /showMobileDiscovery/, 'discovery bar is mobile-only gate');
assert.match(chatPage, /HubCta variant="header"/, 'header keeps Find Playmate CTA');
assert.match(
  chatPage,
  /if \(desktop\) \{[\s\S]*?FindPlaymatePanel compact showRequests=\{false\}/,
  'desktop thread empty pane keeps full find+discovery panel'
);

assert.match(discovery, /variant\?: 'panel' \| 'bar'/, 'PetDiscoveryPanel supports bar variant');
assert.match(discovery, /pepito-pet-discovery--bar/, 'bar class applied');
assert.match(discoveryBar, /variant="bar"/, 'ChatDiscoveryBar uses bar chips');
assert.match(pepito, /\.pepito-pet-discovery--bar/, 'bar styles present');
assert.match(
  pepito,
  /@media \(min-width: 860px\)[\s\S]*?\.tg-chat-list-discovery-bar[\s\S]*?display:\s*none/,
  'desktop hides list discovery bar (thread pane owns it)'
);

console.log('playmateEmptyMobile.selftest: ok');
