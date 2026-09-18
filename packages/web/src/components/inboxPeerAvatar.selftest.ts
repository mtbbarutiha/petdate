/**
 * Guard: inbox/list avatars resolve web-static + API paths.
 * Owner rows use a real photo or initials — not one shared gender portrait.
 * Run: npx tsx packages/web/src/components/inboxPeerAvatar.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const avatar = readFileSync(join(here, 'InboxPeerAvatar.tsx'), 'utf8');
const mediaUrl = readFileSync(join(here, '../lib/mediaUrl.ts'), 'utf8');
const api = readFileSync(join(here, '../lib/api.ts'), 'utf8');
const inbox = readFileSync(join(here, '../lib/inboxConversations.ts'), 'utf8');
const playdateMap = readFileSync(join(here, '../lib/playdateMap.ts'), 'utf8');
const chatPage = readFileSync(join(here, '../pages/ChatPage.tsx'), 'utf8');
const ci = readFileSync(join(here, '../../../../scripts/ci-selftest.sh'), 'utf8');

assert.match(avatar, /allowStockFallback = false/, 'gender stock face is opt-in, not the default');
assert.match(avatar, /isGenderDefaultAvatarPath/, 'drops a shared gender JPG passed as the owner photo');
assert.match(avatar, /defaultAvatarUrlForGender/, 'stock face helper remains for explicit opt-in');
assert.match(avatar, /setSrc\(primary \|\| genderFallback\)/, 'resets src when URL/gender changes');
assert.match(avatar, /referrerPolicy="no-referrer"/, 'hotlink-safe referrer for Google/CDN avatars');
assert.match(avatar, /genderFallback && src !== genderFallback/, 'opt-in stock is tried only when enabled');

assert.match(api, /export \{ resolvePublicAvatarUrl, resolvePublicMediaUrl \} from '\.\/mediaUrl'/, 'api re-exports media URL helpers');
const mediaFn = mediaUrl.match(/export function resolvePublicMediaUrl[\s\S]*?^}/m)?.[0] || '';
assert.match(mediaFn, /raw\.startsWith\('\/agents\/'\)/, 'agent persona JPGs stay on web origin');
assert.match(mediaFn, /raw\.startsWith\('\/images\/'\)/, 'default gender avatars stay on web origin');
assert.match(mediaFn, /raw\.startsWith\('\/pets\/'\)/, 'stock pet JPGs stay on web origin');
assert.match(mediaFn, /raw\.startsWith\('\/brand\/'\)/, 'brand assets stay on web origin');

assert.match(playdateMap, /ownerAvatarUrl/, 'UI pet keeps owner avatar from API');
assert.match(playdateMap, /isGenderDefaultAvatarPath/, 'playmate rows drop shared gender stock photos');
assert.match(playdateMap, /ownerGender/, 'UI pet keeps owner gender');
assert.match(inbox, /peerAvatarUrl: peer\.ownerAvatarUrl/, 'playmate inbox prefers owner face');
assert.doesNotMatch(
  inbox,
  /peerAvatarUrl: peer\.ownerAvatarUrl \|\| peer\.imageUrl/,
  'playmate inbox must not use the pet photo as the owner face'
);
assert.match(chatPage, /InboxPeerAvatar/, 'chat list uses InboxPeerAvatar for owner face');
assert.doesNotMatch(
  chatPage,
  /gender=\{peer\?\.ownerGender\}/,
  'chat list does not paint one shared gender face on every owner'
);

assert.match(ci, /inboxPeerAvatar\.selftest/, 'CI runs inbox avatar selftest');

console.log('inboxPeerAvatar.selftest: ok');
