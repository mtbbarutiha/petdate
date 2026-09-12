/**
 * Guard: Games UI (#325) must not kick کیف پول or گفتگو/هم بازی out of the mobile dock.
 * Chats/playmate is the center dock slot (swapped with شاپ).
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
const chatPaw = readFileSync(join(root, 'components/icons/ChatPawIcon.tsx'), 'utf8');

assert.match(chatPaw, /ChatPawIcon/, 'custom chats/playmate icon exists');
assert.match(nav, /ChatPawIcon/, 'dock chats use ChatPawIcon');

const guestBlock = nav.slice(nav.indexOf('export const SITE_NAV_GUEST'), nav.indexOf('export const SITE_NAV_AUTH'));
assert.match(guestBlock, /PLAYMATE_CHATS/);
assert.match(guestBlock, /SHOP,/);
assert.match(guestBlock, /MY_PETS/);
assert.match(guestBlock, /LOGIN/);
assert.doesNotMatch(guestBlock, /\bGAMES\b/, 'guest mobile dock must not include Games');
assert.ok(
  guestBlock.indexOf('SHOP,') < guestBlock.indexOf('PLAYMATE_CHATS'),
  'guest dock: شاپ before هم بازی (chats center of 4-slot bar)'
);

const authBlock = nav.slice(nav.indexOf('export const SITE_NAV_AUTH'), nav.indexOf('function withGamesAfterShop'));
assert.match(authBlock, /PLAYMATE_CHATS/);
assert.match(authBlock, /WALLET/);
assert.match(authBlock, /PROFILE/);
assert.doesNotMatch(authBlock, /\bGAMES\b/, 'auth mobile default must not include Games');
assert.ok(
  authBlock.indexOf('SHOP_AUTH') < authBlock.indexOf('PLAYMATE_CHATS') &&
    authBlock.indexOf('MY_PETS') < authBlock.indexOf('PLAYMATE_CHATS'),
  'auth dock: هم بازی after شاپ + پت (center slot)'
);

const mobileFn = nav.slice(nav.indexOf('export function siteNavMobileForRole'), nav.indexOf('export function siteNavDesktopForRole'));
assert.match(
  mobileFn,
  /case 'pet_owner':[\s\S]*return \[SHOP_AUTH, MY_PETS, PLAYMATE_CHATS, WALLET, PROFILE\]/,
  'owner dock: شاپ / پت‌های من / هم بازی (مرکز) / کیف پول / پروفایل'
);
assert.match(
  mobileFn,
  /case 'no_pet':[\s\S]*return \[SHOP_AUTH, MY_PETS, CHATS, WALLET, PROFILE\]/,
  'no_pet dock: شاپ / پت‌های من / گفتگو (مرکز) / کیف پول / پروفایل'
);
assert.match(
  mobileFn,
  /case 'vet':[\s\S]*return \[VET_PANEL, SHOP_AUTH, CHATS, WALLET, PROFILE\]/,
  'vet dock: پنل → شاپ → گفتگو (مرکز) → کیف پول'
);
assert.match(
  mobileFn,
  /case 'trainer':[\s\S]*return \[TRAINER_PANEL, SHOP_AUTH, CHATS, WALLET, PROFILE\]/,
  'trainer dock: پنل → شاپ → گفتگو (مرکز) → کیف پول'
);
assert.match(
  mobileFn,
  /default:[\s\S]*return \[SHOP_AUTH, MY_PETS, CHATS, WALLET, PROFILE\]/,
  'default dock keeps گفتگو center + کیف پول'
);
assert.match(mobileFn, /tone: 'finance'|WALLET/, 'wallet stays in every role dock');
assert.doesNotMatch(mobileFn, /\bGAMES\b/, 'mobile dock builder must not insert Games');

assert.match(nav, /function withGamesAfterShop/, 'Games is appended after شاپ for desktop only');
assert.match(nav, /function desktopOrderFromMobile/, 'desktop restores chats-before-shop order');
assert.match(
  nav,
  /export function siteNavDesktopForRole[\s\S]*desktopOrderFromMobile/,
  'desktop header may include Games without touching the dock'
);

assert.match(dock, /siteNavMobileForUser/, 'mobile dock uses role mobile set');
assert.match(dock, /SITE_NAV_GUEST/, 'guest dock uses SITE_NAV_GUEST');
assert.match(
  dock,
  /pepito-landing-mobile-dock-link--chats/,
  'center chats/playmate dock slot has --chats class'
);
assert.match(dock, /size=\{chats \? 28 : 24\}/, 'center ChatPaw icon is slightly larger than siblings');

const pepitoCss = readFileSync(join(root, 'styles/pepito.css'), 'utf8');
assert.doesNotMatch(
  pepitoCss,
  /\.pepito-landing-mobile-dock-link--chats\s*\{[^}]*(?:border-radius:\s*999px|translateY|box-shadow)/,
  'center chats slot has no elevated circular ring/backdrop'
);
assert.match(
  pepitoCss,
  /\.pepito-landing-mobile-dock-link--chats svg[\s\S]*?width:\s*28px/,
  'center chats SVG sized 28px in CSS (fits 44px slot)'
);
assert.match(
  pepitoCss,
  /\.pepito-landing-mobile-dock\s*\{[^}]*overflow:\s*hidden/,
  'mobile dock clips content so center icon cannot overflow the pill'
);

const ownerRail = layout.slice(layout.indexOf('const OWNER_NAV'), layout.indexOf('const VET_NAV'));
const playmateIdx = ownerRail.indexOf("to: '/chats'");
const gamesIdx = ownerRail.indexOf("to: '/games'");
assert.ok(playmateIdx > 0 && gamesIdx > playmateIdx, 'owner rail keeps هم بازی before Games');

console.log('siteNav.selftest: ok');
