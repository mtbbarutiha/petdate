/**
 * Guard: inbox/list avatars resolve web-static + API paths, gender fallback on error.
 * Run: npx tsx packages/web/src/components/inboxPeerAvatar.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const avatar = readFileSync(join(here, 'InboxPeerAvatar.tsx'), 'utf8');
const api = readFileSync(join(here, '../lib/api.ts'), 'utf8');
const inbox = readFileSync(join(here, '../lib/inboxConversations.ts'), 'utf8');
const playdateMap = readFileSync(join(here, '../lib/playdateMap.ts'), 'utf8');
const chatPage = readFileSync(join(here, '../pages/ChatPage.tsx'), 'utf8');
const ci = readFileSync(join(here, '../../../../scripts/ci-selftest.sh'), 'utf8');

assert.match(avatar, /defaultAvatarUrlForGender/, 'falls back to gender default stock photo');
assert.match(avatar, /setSrc\(primary \|\| genderFallback\)/, 'resets src when URL/gender changes');
assert.match(avatar, /referrerPolicy="no-referrer"/, 'hotlink-safe referrer for Google/CDN avatars');
assert.match(avatar, /genderFallback && src !== genderFallback/, 'onError tries gender stock before initials');

const mediaFn = api.match(/export function resolvePublicMediaUrl[\s\S]*?^}/m)?.[0] || '';
assert.match(mediaFn, /raw\.startsWith\('\/agents\/'\)/, 'agent persona JPGs stay on web origin');
assert.match(mediaFn, /raw\.startsWith\('\/images\/'\)/, 'default gender avatars stay on web origin');
assert.match(mediaFn, /raw\.startsWith\('\/pets\/'\)/, 'stock pet JPGs stay on web origin');
assert.match(mediaFn, /raw\.startsWith\('\/brand\/'\)/, 'brand assets stay on web origin');

assert.match(playdateMap, /ownerAvatarUrl/, 'UI pet keeps owner avatar from API');
assert.match(playdateMap, /ownerGender/, 'UI pet keeps owner gender for avatar fallback');
assert.match(inbox, /peerAvatarUrl: peer\.ownerAvatarUrl/, 'playmate inbox prefers owner face');
assert.match(chatPage, /InboxPeerAvatar/, 'chat list uses InboxPeerAvatar for owner face');
assert.match(chatPage, /gender=\{peer\?\.ownerGender\}/, 'list passes owner gender into avatar');

assert.match(ci, /inboxPeerAvatar\.selftest/, 'CI runs inbox avatar selftest');

console.log('inboxPeerAvatar.selftest: ok');
