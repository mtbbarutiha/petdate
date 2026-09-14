/**
 * Desktop header hierarchy: brand | all primary text links inline | utilities.
 * No «بیشتر» overflow — section extras render directly in the nav row.
 * Games/shop must not appear as both marketing text and SiteDesktopNav shortcuts.
 * Role shortcuts share the خدمات plain-text treatment (no outlined icon pills).
 * Run: npx tsx packages/web/src/components/siteHeader.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { landingSectionLinks, welcomeSectionLinks, shopSectionLinks } from './siteHeaderLinks.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const header = readFileSync(join(root, 'components/SiteHeader.tsx'), 'utf8');
const desktopNav = readFileSync(join(root, 'components/SiteDesktopNav.tsx'), 'utf8');
const chrome = readFileSync(join(root, 'components/LandingChrome.tsx'), 'utf8');
const welcome = readFileSync(join(root, 'pages/WelcomePage.tsx'), 'utf8');
const shop = readFileSync(join(root, 'components/shop/ShopChrome.tsx'), 'utf8');
const css = readFileSync(join(root, 'styles/pepito.css'), 'utf8');
const nav = readFileSync(join(root, 'lib/siteNav.ts'), 'utf8');

assert.match(header, /pepito-nav-primary/, 'header has primary group');
assert.match(header, /brandBelow/, 'header accepts shop search under the logo');
assert.match(header, /pepito-nav--with-search/, 'shop search marks the header for taller chrome');
assert.match(header, /pepito-nav-brand--search/, 'search stacks under the brand/logo column');
assert.match(header, /pepito-nav-main/, 'logo, links, and utilities share one header row site-wide');
assert.doesNotMatch(header, /pepito-nav-search-row/, 'search is not a full-width second row');
assert.match(header, /pepito-nav-brand/, 'logo lives in the brand cluster');
assert.doesNotMatch(header, /ShopProductSearch/, 'SiteHeader does not import shop search (slot only)');
assert.match(header, /pepito-nav-actions/, 'header has utilities group');
assert.match(header, /LanguageToggle/, 'utilities include language');
assert.match(header, /ThemeToggle/, 'utilities include theme');
assert.match(header, /NavUserCluster/, 'utilities include cart/wallet/profile');
assert.match(
  header,
  /compactChrome/,
  'mobile + shop use compact lang/theme chips'
);
const navCluster = readFileSync(join(root, 'components/NavUserCluster.tsx'), 'utf8');
assert.match(navCluster, /to="\/auth\/login"/, 'guest login icon targets /auth/login');
assert.match(navCluster, /IconLogin/, 'guest login uses first-party icon (no lucide)');
assert.match(navCluster, /data-testid="nav-login-icon"/, 'guest login icon is testable');
assert.match(navCluster, /!isLoggedIn \?/, 'login icon is guests-only (avatar covers logged-in)');
assert.ok(
  navCluster.indexOf('pepito-nav-login-icon') < navCluster.indexOf('pd-shop-cart-link'),
  'login icon renders immediately before cart in the LTR cluster',
);
assert.match(header, /isGuestLoginTextAction/, 'header drops duplicate text ورود/Login actions');
const adoptionList = readFileSync(join(root, 'pages/AdoptionListPage.tsx'), 'utf8');
const adoptionDetail = readFileSync(join(root, 'pages/AdoptionDetailPage.tsx'), 'utf8');
const vetLanding = readFileSync(join(root, 'pages/VetConsultLandingPage.tsx'), 'utf8');
const faq = readFileSync(join(root, 'pages/FaqPage.tsx'), 'utf8');
const magazine = readFileSync(join(root, 'pages/MagazinePage.tsx'), 'utf8');
assert.doesNotMatch(
  adoptionList,
  /actionLabel=\{t\('common\.login'\)\}/,
  'adoption list does not pass text ورود into SiteHeader',
);
assert.doesNotMatch(
  adoptionDetail,
  /actionLabel=\{t\('common\.login'\)\}/,
  'adoption detail does not pass text ورود into SiteHeader',
);
assert.doesNotMatch(vetLanding, /actionLabel=["']خانه["']/, 'vet landing has no text خانه header action');
assert.doesNotMatch(welcome, /actionLabel/, 'homepage does not pass a header text action');
assert.doesNotMatch(faq, /actionLabel/, 'FAQ does not pass a header text action');
assert.doesNotMatch(shop, /actionLabel/, 'shop chrome does not pass a header text action');
assert.doesNotMatch(
  magazine,
  /actionLabel=\{t\('common\.login'\)\}/,
  'magazine does not pass text ورود into header chrome',
);
assert.match(header, /LazySiteDesktopNav/, 'primary includes role shortcuts');
assert.doesNotMatch(header, /SiteNavOverflow/, 'header no longer mounts overflow More menu');
assert.match(
  header,
  /sectionLinks\.map/,
  'all section extras render inline (not sliced into overflow)'
);
assert.doesNotMatch(
  header,
  /nav\.games|nav\.petShop/,
  'shared header does not hardcode duplicate games/shop text links'
);

assert.match(chrome, /SiteHeader/, 'LandingChrome uses shared header');
assert.match(chrome, /landingSectionLinks/, 'LandingChrome uses marketing extras');
assert.match(chrome, /appNav \? \[\] : landingSectionLinks/, 'app shell drops marketing extras');
assert.match(welcome, /SiteHeader/, 'Welcome uses shared header');
assert.match(welcome, /welcomeSectionLinks/, 'Welcome uses hash extras without games/shop');
assert.match(welcome, /deferDesktopNav/, 'Welcome still defers desktop shortcuts for landing TBT');
assert.match(shop, /SiteHeader/, 'ShopChrome uses shared header');
assert.match(shop, /shopSectionLinks/, 'shop extras use shared section links');
assert.match(shop, /brandBelow/, 'shop search is passed into the header');
assert.match(shop, /ShopProductSearch/, 'ShopChrome mounts primary product search');
assert.doesNotMatch(shop, /pd-shop-search-bar/, 'search is no longer a separate sticky bar');
assert.doesNotMatch(shop, /min-width: 860px/, 'desktop vs mobile search split removed');
assert.doesNotMatch(chrome, /ShopProductSearch/, 'landing chrome has no shop product search');
assert.doesNotMatch(welcome, /ShopProductSearch/, 'homepage chrome has no shop product search');

const landingKeys = landingSectionLinks({ vetConsultEnabled: true }).map((l) => l.key);
const welcomeKeys = welcomeSectionLinks().map((l) => l.key);
assert.deepEqual(landingKeys, ['services', 'adoption', 'vet', 'faq']);
assert.deepEqual(welcomeKeys, ['services', 'adoption', 'news', 'faq']);
assert.ok(!landingKeys.includes('games') && !landingKeys.includes('shop'));
assert.ok(!welcomeKeys.includes('games') && !welcomeKeys.includes('shop'));
assert.ok(!shopSectionLinks().some((l) => l.key === 'games' || l.key === 'cart'));
assert.ok(
  !shopSectionLinks().some((l) => l.key === 'store' || l.to === '/shop'),
  'shop extras must not duplicate SiteDesktopNav شاپ → /shop',
);
assert.deepEqual(
  shopSectionLinks().map((l) => l.key),
  ['orders'],
  'shop header extras are orders only (no species filter chrome)',
);
assert.ok(
  !shopSectionLinks().some((l) => l.key === 'dog' || l.key === 'cat' || l.key === 'bird'),
  'shop pages do not show dog/cat/bird header filters',
);
assert.ok(
  landingSectionLinks({ vetConsultEnabled: true }).some((l) => l.testId === 'nav-adoption'),
  'پذیرش stays testable'
);

assert.match(desktopNav, /data-testid=\{`nav-\$\{item\.key\}`\}/, 'shortcuts keep nav-games test id');
assert.match(desktopNav, /pepito-nav-section-link/, 'role shortcuts share خدمات text class');
assert.doesNotMatch(desktopNav, /<item\.icon/, 'role shortcuts are text-only (no icon pills)');

assert.match(css, /\.pepito-nav-primary/, 'primary group styled');
assert.match(
  css,
  /\.pepito-nav-main[\s\S]{0,120}justify-content:\s*space-between/,
  'mobile header row spaces logo and tools site-wide'
);
assert.match(
  css,
  /\.pepito-nav-brand--search[\s\S]{0,200}\.pd-shop-search\.is-expanded/,
  'compact logo-column search expands on focus'
);
assert.doesNotMatch(css, /\.pepito-nav-search-row/, 'full-width search row styles removed');
assert.match(
  css,
  /\.pepito-nav-links\.pepito-nav-section-inline[\s\S]{0,120}display:\s*flex/,
  'desktop shows all section extras inline'
);
assert.doesNotMatch(
  css,
  /@media \(min-width: 1440px\)[\s\S]{0,200}\.pepito-nav-links\.pepito-nav-section-inline[\s\S]{0,80}display:\s*flex/,
  'inline extras are not gated behind 1440px anymore'
);
assert.doesNotMatch(css, /\.pepito-nav-overflow-btn/, 'More overflow button styles removed');
assert.match(css, /isolation:\s*isolate/, 'header isolates stacking so lang/theme cannot ghost');
assert.match(
  css,
  /\.pepito-nav-actions[\s\S]{0,200}direction:\s*ltr/,
  'utilities keep a stable physical order'
);

assert.match(nav, /withGamesAfterShop/, 'desktop shortcuts still append Games after شاپ (#344)');
assert.match(
  css,
  /\.pepito-site-desktop-nav-link[\s\S]{0,220}font-weight:\s*600/,
  'role shortcuts use the same 600 weight as خدمات'
);
assert.match(
  css,
  /\.pepito-site-desktop-nav-link[\s\S]{0,280}background:\s*none/,
  'role shortcuts have no pill fill'
);
assert.doesNotMatch(
  css,
  /@media \(min-width: 860px\) and \(max-width: 959px\)[\s\S]{0,180}\.pepito-site-desktop-nav-link span/,
  'narrow desktop no longer hides labels for icon-only pills'
);
assert.doesNotMatch(
  nav.slice(nav.indexOf('export function siteNavMobileForRole'), nav.indexOf('export function siteNavDesktopForRole')),
  /\bGAMES\b/,
  'mobile dock builder still does not insert Games'
);

console.log('siteHeader.selftest: ok');
