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
const css = readFileSync(join(root, 'styles/pepito.css'), 'utf8') + readFileSync(join(root, 'styles/pepito-shop.css'), 'utf8');
const nav = readFileSync(join(root, 'lib/siteNav.ts'), 'utf8');

assert.match(header, /pepito-nav-primary/, 'header has primary group');
assert.match(header, /pepito-nav-leading/, 'brand + primary share a leading group');
assert.match(
  header,
  /pepito-nav-leading[\s\S]*pepito-nav-brand[\s\S]*pepito-nav-actions/s,
  'DOM order is leading (brand/primary) then actions — RTL space-between parks tools left',
);
assert.match(header, /brandBelow/, 'header accepts shop search slot');
assert.match(header, /pepito-nav--with-search/, 'shop search marks the header for taller chrome');
assert.match(header, /pepito-nav-search-row/, 'mobile search is a full-width row under logo/tools');
assert.match(header, /pepito-nav-desktop-search/, 'desktop search sits in the primary row');
assert.match(header, /nav-mobile-events/, 'mobile header exposes Events shortcut');
assert.match(header, /showMobileEvents/, 'Events pill can be disabled (shop)');
assert.match(header, /pepito-nav-main/, 'logo, links, and utilities share one header row site-wide');
assert.doesNotMatch(header, /pepito-nav-brand--search/, 'mobile search is not nested under the logo column');
assert.match(header, /pepito-nav-brand/, 'logo lives in the brand cluster');
assert.doesNotMatch(header, /ShopProductSearch/, 'SiteHeader does not import shop search (slot only)');
assert.match(header, /pepito-nav-actions/, 'header has utilities group');
assert.match(header, /LanguageToggle/, 'utilities include language');
assert.match(header, /ThemeToggle/, 'utilities include theme');
assert.match(header, /NavUserCluster/, 'utilities include cart/wallet/profile');
const actionsBlock = header.slice(header.indexOf('pepito-nav-actions'));
assert.ok(
  actionsBlock.indexOf('<NavUserCluster') < actionsBlock.indexOf('<LanguageToggle') &&
    actionsBlock.indexOf('<LanguageToggle') < actionsBlock.indexOf('<ThemeToggle'),
  'actions keep physical LTR order: cluster → lang → theme',
);
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
assert.match(magazine, /showMobileEvents=\{false\}/, 'magazine hides mobile Events pill');
assert.match(magazine, /hideActionOnMobile/, 'magazine hides خانه on mobile (logo is home)');
assert.match(magazine, /PAGE_SIZE = 20/, 'magazine shows at least 20 per page');
assert.match(magazine, /magazine-view-all/, 'magazine has مشاهده همه link');
assert.match(css, /pepito-magazine-grid[\s\S]{0,80}repeat\(4/, 'magazine desktop grid is 4 columns');
assert.match(header, /LazySiteDesktopNav/, 'primary includes role shortcuts');
assert.doesNotMatch(header, /SiteNavOverflow/, 'header no longer mounts overflow More menu');
assert.match(
  header,
  /sectionLinks\.map/,
  'all section extras render inline (not sliced into overflow)'
);
assert.match(header, /nav-mobile-events/, 'mobile header exposes Events shortcut');
assert.match(header, /showMobileEvents/, 'shop can suppress mobile Events pill');
assert.match(header, /hideActionOnMobile/, 'header can hide text actions on mobile');
assert.match(header, /t\('nav\.games'\)/, 'mobile Events shortcut uses nav.games label');
assert.doesNotMatch(
  header,
  /nav\.petShop/,
  'shared header does not hardcode shop text links'
);

assert.match(chrome, /SiteHeader/, 'LandingChrome uses shared header');
assert.match(chrome, /landingSectionLinks/, 'LandingChrome uses marketing extras');
assert.match(chrome, /appNav \? \[\] : landingSectionLinks/, 'app shell drops marketing extras');
assert.match(chrome, /showMobileEvents/, 'LandingChrome can suppress mobile Events');
assert.match(chrome, /showDesktopNav/, 'LandingChrome can suppress desktop role shortcuts');
assert.match(chrome, /hideActionOnMobile/, 'LandingChrome can hide action on mobile');
assert.match(welcome, /SiteHeader/, 'Welcome uses shared header');
assert.match(welcome, /welcomeSectionLinks/, 'Welcome uses hash extras without games/shop');
assert.match(welcome, /deferDesktopNav/, 'Welcome still defers desktop shortcuts for landing TBT');
assert.match(shop, /SiteHeader/, 'ShopChrome uses shared header');
assert.match(shop, /showDesktopNav=\{false\}/, 'shop hides هم بازی/شاپ/ایونت‌ها desktop nav');
assert.match(shop, /showMobileEvents=\{false\}/, 'shop hides mobile Events pill');

const authShell = readFileSync(join(root, 'components/AuthShell.tsx'), 'utf8');
assert.match(authShell, /showMobileEvents=\{false\}/, 'auth chrome hides mobile Events pill');
assert.match(authShell, /showDesktopNav=\{false\}/, 'auth chrome hides desktop Events/shop/playmate');
assert.doesNotMatch(
  authShell,
  /common\.home/,
  'auth does not default header action to خانه (logo is home)',
);
assert.match(
  authShell,
  /actionLabel=\{backLabel\}/,
  'auth only shows a header action when backLabel is set (OTP/onboarding)',
);
assert.match(shop, /pepito-nav--shop/, 'shop marks header for aligned tools + search chrome');
assert.match(shop, /showOrders/, 'shop keeps Orders icon in the left cluster');
assert.doesNotMatch(shop, /shopSectionLinks/, 'shop no longer mounts text سفارش‌ها in primary nav');
assert.doesNotMatch(shop, /sectionLinks=/, 'shop leading side is logo + search only');
assert.match(shop, /brandBelow/, 'shop search is passed into the header');
assert.match(shop, /ShopProductSearch/, 'ShopChrome mounts primary product search');
assert.doesNotMatch(shop, /pd-shop-search-bar/, 'search is no longer a separate sticky bar');
assert.doesNotMatch(shop, /min-width: 860px/, 'desktop vs mobile search split removed');
assert.doesNotMatch(chrome, /ShopProductSearch/, 'landing chrome has no shop product search');
assert.doesNotMatch(welcome, /ShopProductSearch/, 'homepage chrome has no shop product search');

const landingKeys = landingSectionLinks({ vetConsultEnabled: true }).map((l) => l.key);
const welcomeKeys = welcomeSectionLinks().map((l) => l.key);
assert.deepEqual(landingKeys, ['services', 'adoption', 'reviews', 'vet', 'faq']);
assert.deepEqual(welcomeKeys, ['services', 'adoption', 'reviews', 'news', 'faq']);
assert.ok(!landingKeys.includes('games') && !landingKeys.includes('shop'));
assert.ok(!welcomeKeys.includes('games') && !welcomeKeys.includes('shop'));
assert.ok(!shopSectionLinks().some((l) => l.key === 'games' || l.key === 'cart'));
assert.ok(
  !shopSectionLinks().some((l) => l.key === 'store' || l.to === '/shop'),
  'shop extras must not duplicate SiteDesktopNav شاپ → /shop',
);
assert.deepEqual(
  shopSectionLinks().map((l) => l.key),
  [],
  'shop header extras are empty — Orders icon is in NavUserCluster',
);
assert.ok(
  !shopSectionLinks().some((l) => l.key === 'dog' || l.key === 'cat' || l.key === 'bird'),
  'shop pages do not show dog/cat/bird header filters',
);
assert.ok(
  !shopSectionLinks().some((l) => l.key === 'orders'),
  'orders text link removed from shop primary nav (icon remains in cluster)',
);
assert.ok(
  landingSectionLinks({ vetConsultEnabled: true }).some((l) => l.testId === 'nav-adoption'),
  'پذیرش stays testable'
);

assert.match(desktopNav, /data-testid=\{`nav-\$\{item\.key\}`\}/, 'shortcuts keep nav-games test id');
assert.match(desktopNav, /pepito-nav-section-link/, 'role shortcuts share خدمات text class');
assert.doesNotMatch(desktopNav, /<item\.icon/, 'role shortcuts are text-only (no icon pills)');

assert.match(css, /\.pepito-nav-primary/, 'primary group styled');
assert.match(css, /\.pepito-nav-leading/, 'leading group styled');
assert.match(
  css,
  /\.pepito-nav-main[\s\S]{0,120}justify-content:\s*space-between/,
  'header row spaces leading and tools site-wide'
);
assert.match(
  css,
  /\.pepito-nav-main\s*\{[^}]*flex:\s*1 1 auto/,
  'mobile nav-main grows inside flex .pepito-nav so space-between has free space'
);
assert.match(
  css,
  /@media \(max-width: 859px\)[\s\S]*?\.pepito-nav-actions\s*\{[^}]*margin-left:\s*0\s*!important/,
  'mobile pins actions with physical margin-left:0 (ltr island must not reinterpret inline-start)'
);
assert.match(
  css,
  /@media \(max-width: 859px\)[\s\S]*?\.pepito-nav-actions\s*\{[^}]*margin-inline-start:\s*0\s*!important/,
  'mobile zeros actions margin-inline-start (ltr island would pull tools to the logo)'
);
assert.match(
  css,
  /\.pepito-nav-brand--search\s*\{[\s\S]{0,220}width:\s*max-content/,
  'legacy logo-column search styles remain for compatibility'
);
assert.match(
  css,
  /\.pepito-nav-search-row\s*\{[\s\S]{0,220}margin-block-start:\s*0\.65rem/,
  'mobile search row sits below the icon row with clear vertical margin'
);
assert.match(
  css,
  /\.pepito-nav-search-row\s*\{[\s\S]{0,220}width:\s*100%/,
  'mobile search row spans the full usable header width'
);
assert.match(
  css,
  /\.pepito-nav--shop[\s\S]{0,160}\.pepito-nav-actions[\s\S]{0,80}align-items:\s*center/,
  'shop header utilities share one vertical centerline'
);
assert.match(
  css,
  /\.pepito-nav--mobile-search[\s\S]{0,120}\.pepito-nav-main[\s\S]{0,80}align-items:\s*center/,
  'mobile search header keeps logo and tools on one axis'
);
assert.match(
  css,
  /\.pd-shop-page[\s\S]{0,80}\.pd-shop-hero[\s\S]{0,120}margin-top:\s*0\s*!important/,
  'desktop sticky shop nav does not leave a gap above the hero'
);
assert.match(
  css,
  /@media \(min-width: 860px\)[\s\S]{0,900}\.pepito-nav-primary\s*\{[\s\S]{0,180}flex:\s*0 1 auto/,
  'desktop primary nav shrink-wraps beside the brand (not flex-grow away from logo)'
);
assert.match(
  css,
  /@media \(min-width: 860px\)[\s\S]{0,1600}\.pepito-nav-actions\s*\{[^}]*margin-left:\s*0\s*!important/,
  'desktop pins actions to physical left (margin-left:0, not ms-auto)'
);
assert.match(
  css,
  /@media \(min-width: 860px\)[\s\S]{0,1600}\.pepito-nav-actions\s*\{[^}]*margin-inline-start:\s*0\s*!important/,
  'desktop must not use ms-auto on the LTR actions island (RTL cluster bug)'
);
assert.doesNotMatch(
  css,
  /\.pepito-nav-actions\s*\{[^}]*margin-inline-start:\s*auto/,
  'no .pepito-nav-actions rule may use ms-auto (direction:ltr → margin-left on RTL)'
);
assert.match(
  css,
  /\.pepito-nav-actions\s*\{[\s\S]{0,400}margin-left:\s*0\s*!important/,
  'base actions styles pin physical margin-left:0'
);
assert.match(
  css,
  /\.pepito-nav-user-cluster\s*\{[\s\S]{0,120}position:\s*static/,
  'user cluster stays in-flow inside actions (no absolute left reservation)'
);
assert.doesNotMatch(
  css,
  /\.pepito-nav--app\s*\{[^}]*padding-left:\s*calc\(var\(--pepito-gutter-x\)\s*\+\s*\d/,
  'app header must not reserve absolute-cluster left padding'
);
const criticalHtml = readFileSync(join(root, '../index.html'), 'utf8');
assert.match(
  criticalHtml,
  /\.pepito-nav-main\{[^}]*justify-content:space-between/,
  'critical CSS spaces logo and tools before hashed CSS applies'
);
assert.match(
  criticalHtml,
  /\.pepito-nav-leading\{/,
  'critical CSS knows the leading | actions two-child layout'
);
assert.match(
  criticalHtml,
  /\.pepito-nav-actions\{[^}]*margin-left:0/,
  'critical CSS pins physical margin-left:0 on the LTR actions island'
);
assert.match(
  criticalHtml,
  /\.pepito-nav-actions\{[^}]*margin-inline-start:0/,
  'critical CSS must not use ms-auto on the LTR actions island (RTL cluster bug)'
);
assert.match(
  css,
  /\.pepito-nav-search-row[\s\S]{0,200}\.pd-shop-search/,
  'mobile search row owns the shop search pill'
);
assert.match(css, /\.pepito-nav-search-row/, 'full-width mobile search row styles present');
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

assert.match(
  css,
  /\.pepito-nav--shop[\s\S]{0,160}\.pepito-nav-main[\s\S]{0,80}align-items:\s*center/,
  'shop header logo row and tools share a centerline',
);
assert.match(
  css,
  /\.pd-shop-page[\s\S]{0,80}\.pepito-nav-profile[\s\S]{0,80}display:\s*block\s*!important/,
  'shop keeps profile avatar visible on mobile beside Orders',
);
assert.match(css, /\.pepito-nav-profile-shortcuts/, 'profile menu hosts relocated nav shortcuts');

const profileMenu = readFileSync(join(root, 'components/ProfileMenu.tsx'), 'utf8');
assert.match(profileMenu, /profile-shortcut-events/, 'profile menu includes Events shortcut');
assert.match(profileMenu, /profile-shortcut-playmate/, 'profile menu includes playmate shortcut');
assert.match(profileMenu, /profile-shortcut-shop/, 'profile menu includes shop shortcut');
assert.match(profileMenu, /to="\/events"/, 'Events shortcut targets /events');

const darkCss = readFileSync(join(root, 'styles/theme-dark.css'), 'utf8') + readFileSync(join(root, 'styles/theme-dark-shop.css'), 'utf8');
assert.match(
  darkCss,
  /html\[data-theme='dark'\]\s*\.pepito-games-status[\s\S]{0,80}color:\s*#f8fafc/,
  'dark theme forces light text on open/closed status badges',
);
assert.match(
  darkCss,
  /html\[data-theme='dark'\]\s*\.pepito-games-card-media\s*\.pepito-games-status[\s\S]{0,120}color:\s*#f8fafc/,
  'dark cover status badge text is light on dark glass',
);
assert.match(
  darkCss,
  /html\[data-theme='dark'\]\s*\.pepito-games-status\.is-open[\s\S]{0,120}color:\s*#ecfdf5/,
  'dark open status keeps readable light green text',
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
