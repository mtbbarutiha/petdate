/**
 * Shop UX batch: home rails, filter toggle, expanded filters.
 * Run: npx tsx packages/web/src/components/shop/shopUxBatch.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SHOP_PARAM_FILTER_DIMS,
  SHOP_UNBACKED_FILTER_DIMS,
  collectParamFilterOptions,
  filterProducts,
  getBestsellingProducts,
  getHomeRailProducts,
} from '../../data/shopCatalog.ts';

const here = dirname(fileURLToPath(import.meta.url));
const home = readFileSync(join(here, '../../pages/shop/ShopHomePage.tsx'), 'utf8');
const category = readFileSync(join(here, '../../pages/shop/ShopCategoryPage.tsx'), 'utf8');
const rail = readFileSync(join(here, 'ShopHomeRail.tsx'), 'utf8');
const css = readFileSync(join(here, '../../styles/pepito.css'), 'utf8');
const ci = readFileSync(join(here, '../../../../../scripts/ci-selftest.sh'), 'utf8');

assert.match(home, /ShopTopBrands/, 'top brands before rails');
assert.match(home, /پرفروش‌ترین‌های پت/, 'bestsellers section');
assert.match(home, /دسته‌بندی‌های گربه/, 'cat categories section');
assert.match(home, /دسته‌بندی‌های سگ/, 'dog categories section');
assert.match(home, /shop-home-bestsellers/, 'bestsellers test id');
assert.match(home, /ShopHomeRail/, 'uses shared DigiKala rail');
// Order under Top Brands: bestsellers → cat → dog
const brandsIdx = home.indexOf('<ShopTopBrands');
const bestIdx = home.indexOf('پرفروش‌ترین‌های پت');
const catIdx = home.indexOf('دسته‌بندی‌های گربه');
const dogIdx = home.indexOf('دسته‌بندی‌های سگ');
assert.ok(brandsIdx > 0 && bestIdx > brandsIdx, 'bestsellers after top brands');
assert.match(home, /ShopPromoBanners/, 'two promo banners on home');
assert.doesNotMatch(home, /pd-shop-journey/, '3-step journey strip removed');
assert.doesNotMatch(home, /title: 'انتخاب کن'/, 'journey copy gone');
assert.doesNotMatch(home, /pd-shop-pet-tabs/, 'no top-of-home species filter chrome');
assert.match(home, /pd-shop-dk-tile/, 'rectangular category tiles');
assert.doesNotMatch(home, /pd-shop-dk-circle/, 'emoji circles replaced');
assert.doesNotMatch(home, /c\.emoji/, 'category rail does not use emoji');
const promoIdx = home.indexOf('<ShopPromoBanners');
assert.ok(promoIdx > bestIdx, 'promo banners after bestsellers');
assert.ok(catIdx > promoIdx, 'cat rail after promo banners');
assert.ok(dogIdx > catIdx, 'dog rail after cat rail');

assert.match(rail, /مشاهده همه/, 'view-all link');
assert.match(rail, /onPillChange/, 'pill filters');
assert.match(rail, /pill\.id !== 'all'/, 'pill toggle deselects to all');

assert.match(category, /FilterAccordion/, 'DigiKala accordion filters');
assert.match(category, /SHOP_PARAM_FILTER_DIMS/, 'catalog-backed param dims');
assert.match(category, /SHOP_UNBACKED_FILTER_DIMS/, 'documents unbacked DigiKala dims');
assert.match(category, /if \(active\) onSelect\(''\)/, 'chip toggle deselect');
assert.match(category, /active && pt\.id !== 'all'/, 'pet type toggle deselect');
assert.match(category, /pd-shop-filter-select/, 'dropdown for long option lists');

assert.ok(SHOP_PARAM_FILTER_DIMS.length >= 5, 'several catalog-backed dims');
assert.ok(SHOP_UNBACKED_FILTER_DIMS.some((d) => d.key === 'color'), 'color listed as unbacked');
assert.ok(collectParamFilterOptions('وزن').length > 0, 'weight options from catalog');
assert.ok(collectParamFilterOptions('کشور_برند').length > 0, 'country options from catalog');

const weight = collectParamFilterOptions('وزن')[0]!;
const filtered = filterProducts({ params: { وزن: weight } });
assert.ok(filtered.length > 0, 'param filter returns matches');
assert.ok(filtered.every((p) => p.params.وزن === weight), 'param filter exact match');

assert.ok(getBestsellingProducts('all', 8).length > 0, 'bestsellers helper');
assert.ok(getHomeRailProducts({ pet: 'cat', limit: 6 }).length > 0, 'cat rail products');
assert.ok(getHomeRailProducts({ pet: 'dog', limit: 6 }).length > 0, 'dog rail products');

assert.match(rail, /ShopRailNavButtons/, 'home rails expose L/R buttons');
assert.match(css, /\.pd-shop-rail-btn\b/, 'shared rail button styles');
assert.match(css, /\.pd-shop-home-rail-track[\s\S]{0,180}overflow-x:\s*hidden/, 'home rail hides native scrollbar');
assert.match(css, /\.pd-shop-dk-strip\s*\{[\s\S]{0,320}overflow-x:\s*hidden/, 'category strip hides native scrollbar');
assert.match(css, /\.pd-shop-promo-banners\b/, 'promo banner styles');
const promoSrc = readFileSync(join(here, 'ShopPromoBanners.tsx'), 'utf8');
assert.match(promoSrc, /پت‌دیت/, 'promo banners include PetDate name');
assert.match(promoSrc, /برای پت شما/, 'first promo headline');
assert.match(promoSrc, /مناسب پت شما/, 'second promo headline');
assert.match(promoSrc, /shop-promo-banners/, 'promo test id');
assert.match(css, /\.pd-shop-filter-acc\b/, 'filter accordion styles');
assert.match(ci, /shopUxBatch\.selftest/, 'CI runs shop UX batch selftest');

console.log('shopUxBatch.selftest: ok');
