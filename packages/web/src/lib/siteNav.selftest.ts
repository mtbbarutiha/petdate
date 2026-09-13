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
const desktopNav = readFileSync(join(root, 'components/SiteDesktopNav.tsx'), 'utf8');
const chatPaw = readFileSync(join(root, 'components/icons/ChatPawIcon.tsx'), 'utf8');

assert.match(chatPaw, /ChatPawIcon/, 'custom chats/playmate icon exists');
assert.doesNotMatch(chatPaw, /scale\(/, 'ChatPaw has no extra scale — same visual box as Lucide siblings');
assert.match(nav, /ChatPawIcon/, 'dock chats use ChatPawIcon');
assert.match(nav, /export function isMobileDockHidden/, 'shared mobile-dock hide helper');
assert.match(dock, /isMobileDockHidden/, 'dock uses shared hide helper');

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
assert.match(dock, /const DOCK_ICON_PX = 24/, 'dock icons share a single 24px box');
assert.match(dock, /size=\{DOCK_ICON_PX\}/, 'every dock glyph uses DOCK_ICON_PX (no per-item size)');
assert.doesNotMatch(dock, /size=\{chats/, 'center chats is not a different icon size');
assert.match(dock, /width=\{DOCK_ICON_PX\}/, 'profile avatar width matches dock icon box');
assert.match(dock, /height=\{DOCK_ICON_PX\}/, 'profile avatar height matches dock icon box');

const pepitoCss = readFileSync(join(root, 'styles/pepito.css'), 'utf8');
assert.doesNotMatch(
  pepitoCss,
  /\.pepito-landing-mobile-dock-link--chats\s*\{[^}]*(?:border-radius:\s*999px|translateY|box-shadow)/,
  'center chats slot has no elevated circular ring/backdrop'
);
assert.doesNotMatch(
  pepitoCss,
  /\.pepito-landing-mobile-dock-link--chats svg/,
  'center chats SVG has no separate width/height override'
);
assert.match(
  pepitoCss,
  /--pepito-dock-icon-size:\s*24px/,
  'dock icon token is 24px for every item'
);
assert.match(
  pepitoCss,
  /\.pepito-landing-mobile-dock-link svg[\s\S]*?width:\s*var\(--pepito-dock-icon-size\)/,
  'all dock SVGs use the shared icon token'
);
assert.match(
  pepitoCss,
  /\.pepito-landing-mobile-dock-avatar\s*\{[\s\S]*?width:\s*var\(--pepito-dock-icon-size\)/,
  'profile avatar box matches dock icon token'
);
assert.match(
  pepitoCss,
  /\.pepito-landing-mobile-dock-link\s*\{[\s\S]*?min-height:\s*44px/,
  'dock tap targets stay at least 44px'
);
assert.match(
  pepitoCss,
  /\.pepito-landing-mobile-dock\s*\{[^}]*overflow:\s*hidden/,
  'mobile dock clips content so icons cannot overflow the pill'
);

assert.doesNotMatch(
  desktopNav,
  /item\.icon/,
  'desktop header is text-only (#380) — dock glyph token must not leak'
);
assert.match(desktopNav, /pepito-nav-section-link/, 'desktop shortcuts share the خدمات text class');
assert.match(desktopNav, /t\(`nav\.\$\{item\.key\}`\)/, 'desktop header renders nav label text');

const ownerRail = layout.slice(layout.indexOf('const OWNER_NAV'), layout.indexOf('const VET_NAV'));
const playmateIdx = ownerRail.indexOf("to: '/chats'");
const gamesIdx = ownerRail.indexOf("to: '/games'");
assert.ok(playmateIdx > 0 && gamesIdx > playmateIdx, 'owner rail keeps هم بازی before Games');

console.log('siteNav.selftest: ok');
