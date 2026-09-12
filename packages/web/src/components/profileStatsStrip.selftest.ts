/**
 * Guard: likes/views/coins/contacts strip is own-profile only,
 * placed under the hero — never on «پروفایل مخاطب» / peer cards.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const strip = readFileSync(join(root, 'components/ProfileStatsStrip.tsx'), 'utf8');
const profile = readFileSync(join(root, 'pages/ProfilePage.tsx'), 'utf8');
const chat = readFileSync(join(root, 'pages/ChatPage.tsx'), 'utf8');
const vetChat = readFileSync(join(root, 'pages/VetChatPage.tsx'), 'utf8');
const sharedPeer = readFileSync(
  join(root, '../../shared/src/peer-profile.ts'),
  'utf8'
);

assert.match(strip, /isOwnProfile/, 'strip requires isOwnProfile gate');
assert.match(strip, /if \(!isOwnProfile\) return null/, 'strip returns null when not own profile');
assert.match(strip, /data-testid="own-profile-stats"/, 'own-profile test id');
assert.match(strip, /<span>لایک<\/span>/, 'likes label');
assert.match(strip, /<span>بازدید<\/span>/, 'views label');
assert.match(strip, /<span>سکه<\/span>/, 'coins label');
assert.match(strip, /<span>مخاطب<\/span>/, 'contacts label');
assert.match(strip, /to="\/wallet"/, 'coins still links to wallet — data/API kept');

assert.match(profile, /import \{ ProfileStatsStrip \}/, 'own ProfilePage mounts the strip');
assert.match(profile, /pepito-profile-head/, 'hero + strip grouped under profile head');
assert.match(profile, /<ProfileStatsStrip[\s\S]*isOwnProfile/, 'ProfilePage passes isOwnProfile');

const headAt = profile.indexOf('pepito-profile-head');
const identityAt = profile.indexOf('pepito-profile-identity');
const stripAt = profile.indexOf('<ProfileStatsStrip');
const pulseAt = profile.indexOf('pepito-profile-pulse');
assert.ok(headAt > 0 && identityAt > headAt, 'identity stays inside profile head');
assert.ok(stripAt > identityAt, 'strip is after avatar/identity');
assert.ok(pulseAt > stripAt, 'completion pulse stays below the strip');
assert.doesNotMatch(profile, /pepito-profile-stats--type/, 'old mid-page --type strip removed');

assert.doesNotMatch(chat, /ProfileStatsStrip/, 'chat peer card must not import the strip');
assert.doesNotMatch(chat, /pepito-profile-stats/, 'chat peer card has no stats strip class');
assert.match(chat, /پروفایل طرف مقابل/, 'chat still has contact profile card');
const ownerCardAt = chat.indexOf('infoCard === \'owner\'');
assert.ok(ownerCardAt > 0, 'chat owner info card exists');
const ownerCardSlice = chat.slice(ownerCardAt, ownerCardAt + 2500);
assert.doesNotMatch(ownerCardSlice, /<span>لایک<\/span>/, 'chat owner card has no likes stat');
assert.doesNotMatch(ownerCardSlice, /<span>سکه<\/span>/, 'chat owner card has no coins stat');
assert.doesNotMatch(ownerCardSlice, /<span>مخاطب<\/span>/, 'chat owner card has no contacts stat');

assert.doesNotMatch(vetChat, /ProfileStatsStrip/, 'vet chat must not import the strip');
assert.doesNotMatch(vetChat, /pepito-profile-stats/, 'vet chat has no stats strip class');

assert.doesNotMatch(
  sharedPeer,
  /<span>لایک<\/span>|pepito-profile-stats/,
  'shared peer profile caption is not the web stats strip'
);

console.log('profileStatsStrip.selftest.ts: ok');
