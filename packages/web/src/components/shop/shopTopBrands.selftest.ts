/**
 * Shop «برندهای برتر» carousel contract.
 * Run: npx tsx packages/web/src/components/shop/shopTopBrands.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..'); // packages/web
const catalog = readFileSync(join(root, 'src/data/shopCatalog.ts'), 'utf8');
const home = readFileSync(join(root, 'src/pages/shop/ShopHomePage.tsx'), 'utf8');
const carousel = readFileSync(join(root, 'src/components/shop/ShopTopBrands.tsx'), 'utf8');
const css = readFileSync(join(root, 'src/styles/pepito.css'), 'utf8') + readFileSync(join(root, 'src/styles/pepito-shop.css'), 'utf8');
const dark = readFileSync(join(root, 'src/styles/theme-dark.css'), 'utf8') + readFileSync(join(root, 'src/styles/theme-dark-shop.css'), 'utf8');
const adminPage = join(root, 'src/admin/pages/AdminShopBrandsPage.tsx');
const adminRoutes = readFileSync(join(root, 'src/App.tsx'), 'utf8');

assert.match(catalog, /SHOP_TOP_BRAND_IDS/, 'top brand id list exists');
assert.match(catalog, /logoUrl/, 'ShopBrand has logoUrl');
assert.match(catalog, /getTopBrands/, 'getTopBrands helper exists');
assert.match(catalog, /id: 'fidar-patira'/, 'Fidar Patira brand seeded');
assert.match(catalog, /id: 'vipet'/, 'VIPET brand seeded');
assert.match(catalog, /id: 'celebone'/, 'Celebone brand seeded');
assert.match(catalog, /id: 'monello'/, 'Monello brand seeded');

for (const id of [
  'royal-canin',
  'josera',
  'mofeed',
  'fidar-patira',
  'wanpy',
  'vipet',
  'reflex',
  'gourmet',
  'celebone',
  'monello',
]) {
  const logo = join(root, 'public/shop/brands', `${id}.png`);
  assert.ok(existsSync(logo), `logo file missing: ${id}.png`);
}

assert.match(home, /ShopTopBrands/, 'shop home renders Top Brands carousel');
assert.doesNotMatch(
  home,
  /pd-shop-brand-chip/,
  'old text-only brand chips replaced on home'
);

assert.match(carousel, /pd-shop-top-brands/, 'carousel root class');
assert.match(carousel, /\/shop\/c\/all\?brand=/, 'brand click filters via category route');
assert.match(carousel, /ShopRailNavButtons/, 'RTL brand rail uses shared L/R buttons');
assert.match(carousel, /scrollBySide/, 'carousel scrolls visual-left/right');

assert.match(css, /\.pd-shop-top-brands/, 'carousel styles present');
assert.match(css, /\.pd-shop-top-brand-logo/, 'logo cell styles present');
assert.match(css, /\.pd-shop-top-brand-tile/, 'logo tiles for dark/light contrast');
assert.match(dark, /pd-shop-top-brands/, 'dark mode styles for top brands');
assert.match(dark, /pd-shop-top-brand-tile/, 'dark mode light logo tiles');
assert.match(carousel, /pd-shop-top-brand-tile/, 'carousel renders logo tiles');

assert.ok(existsSync(adminPage), 'admin brands page exists');
assert.match(adminRoutes, /shop\/brands/, 'admin brands route registered');

console.log('shopTopBrands.selftest: ok');
