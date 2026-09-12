/**
 * Web: breed autocomplete + pet/user photo split + playmate owner thumb.
 * Run: npx tsx packages/web/src/components/breedPhotoSplit.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');

const breedPicker = readFileSync(join(dir, 'BreedPicker.tsx'), 'utf8');
const profilePage = readFileSync(join(root, 'pages/ProfilePage.tsx'), 'utf8');
const chatPage = readFileSync(join(root, 'pages/ChatPage.tsx'), 'utf8');
const chatCss = readFileSync(join(root, 'styles/chat.css'), 'utf8');

assert.match(breedPicker, /breedMatchesQuery/, 'BreedPicker uses FA/EN matcher');
assert.match(breedPicker, /role="combobox"/, 'BreedPicker is combobox autocomplete');
assert.match(breedPicker, /breed-picker-suggestions/, 'BreedPicker shows suggestion list');
assert.match(breedPicker, /فارسی یا انگلیسی/, 'placeholder mentions FA/EN search');

assert.doesNotMatch(
  profilePage,
  /primaryPet\?\.imageUrl/,
  'profile avatar must not fall back to pet photo'
);
assert.match(
  profilePage,
  /resolvePublicAvatarUrl\(display\.avatarUrl/,
  'profile avatar uses user avatar only (never face-verify video)'
);

assert.match(chatPage, /tg-request-card-owner/, 'request card shows owner thumb');
assert.match(chatCss, /\.tg-request-card-owner\b/, 'owner thumb CSS present');
assert.match(chatCss, /\.tg-request-card-photo\s*\{[\s\S]*?inset:\s*0/, 'pet photo is full-bleed cover');
assert.match(
  chatCss,
  /\.tg-request-card-photo\s*\{[\s\S]*?border-radius:\s*0/,
  'pet photo is rectangular cover (not circle)'
);
assert.match(
  chatCss,
  /\.tg-request-card-cover\s*\{[\s\S]*?height:\s*clamp\(200px/,
  'cover has Telegram-like generous height'
);
assert.match(
  chatCss,
  /\.tg-request-card-owner\s*\{[\s\S]*?bottom:\s*12px/,
  'owner thumb overlays bottom-start of cover (Telegram style)'
);
assert.match(chatCss, /inset-inline-start:\s*12px/, 'owner thumb start-edge overlay');
assert.match(
  chatPage,
  /tg-chat-peer-avatar--initials/,
  'chat header uses initials instead of pet photo when owner avatar missing'
);
assert.doesNotMatch(
  chatPage,
  /peerOwnerAvatar \?[\s\S]*PetAvatar[\s\S]*peerPet\.imageUrl/,
  'chat header must not show pet photo as owner avatar'
);

console.log('breedPhotoSplit.selftest: ok');
