/**
 * Desktop header hierarchy: brand | primary pills | overflow | utilities.
 * Games/shop must not appear as both marketing text and SiteDesktopNav pills.
 * Run: npx tsx packages/web/src/components/siteHeader.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { landingSectionLinks, welcomeSectionLinks, shopSectionLinks } from './siteHeaderLinks.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const header = readFileSync(join(root, 'components/SiteHeader.tsx'), 'utf8');
const overflow = readFileSync(join(root, 'components/SiteNavOverflow.tsx'), 'utf8');
const desktopNav = readFileSync(join(root, 'components/SiteDesktopNav.tsx'), 'utf8');
const chrome = readFileSync(join(root, 'components/LandingChrome.tsx'), 'utf8');
const welcome = readFileSync(join(root, 'pages/WelcomePage.tsx'), 'utf8');
const shop = readFileSync(join(root, 'components/shop/ShopChrome.tsx'), 'utf8');
const css = readFileSync(join(root, 'styles/pepito.css'), 'utf8');
const nav = readFileSync(join(root, 'lib/siteNav.ts'), 'utf8');

assert.match(header, /pepito-nav-primary/, 'header has primary group');
assert.match(header, /pepito-nav-actions/, 'header has utilities group');
assert.match(header, /LanguageToggle/, 'utilities include language');
assert.match(header, /ThemeToggle/, 'utilities include theme');
assert.match(header, /NavUserCluster/, 'utilities include cart/wallet/profile');
assert.match(header, /LazySiteDesktopNav/, 'primary includes role pills');
assert.match(header, /SiteNavOverflow/, 'secondary links go through overflow');
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
assert.match(welcome, /deferDesktopNav/, 'Welcome still defers pills for landing TBT');
assert.match(shop, /SiteHeader/, 'ShopChrome uses shared header');
assert.match(shop, /shopSectionLinks/, 'shop extras stay in overflow, not a second pill row');

const landingKeys = landingSectionLinks({ vetConsultEnabled: true }).map((l) => l.key);
const welcomeKeys = welcomeSectionLinks().map((l) => l.key);
assert.deepEqual(landingKeys, ['services', 'adoption', 'vet', 'faq']);
assert.deepEqual(welcomeKeys, ['services', 'adoption', 'news', 'faq']);
assert.ok(!landingKeys.includes('games') && !landingKeys.includes('shop'));
assert.ok(!welcomeKeys.includes('games') && !welcomeKeys.includes('shop'));
assert.ok(!shopSectionLinks().some((l) => l.key === 'games' || l.key === 'cart'));
assert.ok(
  landingSectionLinks({ vetConsultEnabled: true }).some((l) => l.testId === 'nav-adoption'),
  'پذیرش stays testable'
);

assert.match(desktopNav, /data-testid=\{`nav-\$\{item\.key\}`\}/, 'pills keep nav-games test id');
assert.match(overflow, /nav\.more/, 'overflow uses i18n more label');

assert.match(css, /\.pepito-nav-primary/, 'primary group styled');
assert.match(css, /\.pepito-nav-overflow/, 'overflow styled');
assert.match(
  css,
  /\.pepito-nav-links\.pepito-nav-section-inline[\s\S]{0,80}display:\s*none/,
  'mid-width hides inline extras (overflow instead of cramming)'
);
assert.match(
  css,
  /@media \(min-width: 1440px\)[\s\S]{0,200}\.pepito-nav-links\.pepito-nav-section-inline[\s\S]{0,80}display:\s*flex/,
  'wide desktop can show two extras inline'
);
assert.match(css, /isolation:\s*isolate/, 'header isolates stacking so lang/theme cannot ghost');
assert.match(
  css,
  /\.pepito-nav-actions[\s\S]{0,200}direction:\s*ltr/,
  'utilities keep a stable physical order'
);

assert.match(nav, /withGamesAfterShop/, 'desktop pills still append Games after شاپ (#344)');
assert.doesNotMatch(
  nav.slice(nav.indexOf('export function siteNavMobileForRole'), nav.indexOf('export function siteNavDesktopForRole')),
  /\bGAMES\b/,
  'mobile dock builder still does not insert Games'
);

console.log('siteHeader.selftest: ok');
