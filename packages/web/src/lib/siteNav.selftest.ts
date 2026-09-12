/**
 * Guard: Games UI (#325) must not kick کیف پول or گفتگو/هم بازی out of the mobile dock.
 * Run: npx tsx packages/web/src/lib/siteNav.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nav = readFileSync(join(root, 'lib/siteNav.ts'), 'utf8');
const dock = readFileSync(join(root, 'components/LandingMobileDock.tsx'), 'utf8');
const layout = readFileSync(join(root, 'components/Layout.tsx'), 'utf8');

const guestBlock = nav.slice(nav.indexOf('export const SITE_NAV_GUEST'), nav.indexOf('export const SITE_NAV_AUTH'));
assert.match(guestBlock, /SHOP,/);
assert.match(guestBlock, /PLAYMATE_CHATS/);
assert.match(guestBlock, /MY_PETS/);
assert.match(guestBlock, /LOGIN/);
assert.doesNotMatch(guestBlock, /\bGAMES\b/, 'guest mobile dock must not include Games');

const authBlock = nav.slice(nav.indexOf('export const SITE_NAV_AUTH'), nav.indexOf('function withGamesAfterShop'));
assert.match(authBlock, /PLAYMATE_CHATS/);
assert.match(authBlock, /WALLET/);
assert.match(authBlock, /PROFILE/);
assert.doesNotMatch(authBlock, /\bGAMES\b/, 'auth mobile default must not include Games');

const mobileFn = nav.slice(nav.indexOf('export function siteNavMobileForRole'), nav.indexOf('export function siteNavDesktopForRole'));
assert.match(
  mobileFn,
  /case 'pet_owner':[\s\S]*return \[SHOP_AUTH, PLAYMATE_CHATS, MY_PETS, WALLET, PROFILE\]/,
  'owner dock: شاپ / هم بازی / پت‌های من / کیف پول / پروفایل'
);
assert.match(
  mobileFn,
  /case 'no_pet':[\s\S]*return \[SHOP_AUTH, CHATS, MY_PETS, WALLET, PROFILE\]/,
  'no_pet dock: شاپ / گفتگو / پت‌های من / کیف پول / پروفایل'
);
assert.match(
  mobileFn,
  /case 'vet':[\s\S]*return \[SHOP_AUTH, VET_PANEL, CHATS, WALLET, PROFILE\]/,
  'vet dock keeps گفتگو + کیف پول'
);
assert.match(
  mobileFn,
  /case 'trainer':[\s\S]*return \[SHOP_AUTH, TRAINER_PANEL, CHATS, WALLET, PROFILE\]/,
  'trainer dock keeps گفتگو + کیف پول'
);
assert.match(
  mobileFn,
  /default:[\s\S]*return \[SHOP_AUTH, CHATS, MY_PETS, WALLET, PROFILE\]/,
  'default dock keeps گفتگو + کیف پول'
);
assert.doesNotMatch(mobileFn, /\bGAMES\b/, 'mobile dock builder must not insert Games');

assert.match(nav, /function withGamesAfterShop/, 'Games is appended after شاپ for desktop only');
assert.match(
  nav,
  /export function siteNavDesktopForRole[\s\S]*withGamesAfterShop/,
  'desktop header may include Games without touching the dock'
);

assert.match(dock, /siteNavMobileForUser/, 'mobile dock uses role mobile set');
assert.match(dock, /SITE_NAV_GUEST/, 'guest dock uses SITE_NAV_GUEST');

const ownerRail = layout.slice(layout.indexOf('const OWNER_NAV'), layout.indexOf('const VET_NAV'));
const playmateIdx = ownerRail.indexOf("to: '/chats'");
const gamesIdx = ownerRail.indexOf("to: '/games'");
assert.ok(playmateIdx > 0 && gamesIdx > playmateIdx, 'owner rail keeps هم بازی before Games');

console.log('siteNav.selftest: ok');
