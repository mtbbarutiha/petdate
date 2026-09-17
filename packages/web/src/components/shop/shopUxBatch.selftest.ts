/**
 * Shop UX batch: home rails, filter toggle, expanded filters.
 * Run: npx tsx packages/web/src/components/shop/shopUxBatch.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
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
const css = readFileSync(join(here, '../../styles/pepito.css'), 'utf8') + readFileSync(join(here, '../../styles/pepito-shop.css'), 'utf8');
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
assert.match(home, /pd-shop-dk-tile--photo/, 'illustrated category tiles');
assert.match(home, /ShopCategoryArt/, 'category rail uses category art component');
assert.doesNotMatch(home, /shopCategoryIcon\(/, 'category rail does not use Lucide icon map');
assert.doesNotMatch(home, /pd-shop-dk-circle/, 'emoji circles replaced');
assert.doesNotMatch(home, /c\.emoji/, 'category rail does not use emoji');
const promoIdx = home.indexOf('<ShopPromoBanners');
assert.ok(promoIdx > bestIdx, 'promo banners after bestsellers');
assert.ok(catIdx > promoIdx, 'cat rail after promo banners');
assert.ok(dogIdx > catIdx, 'dog rail after cat rail');

assert.match(rail, /مشاهده همه/, 'view-all link');
assert.match(rail, /onPillChange/, 'pill filters');
assert.match(rail, /pill\.id !== 'all'/, 'pill toggle deselects to all');
assert.match(rail, /useTouchSafePillActivate/, 'pills activate on touch pointerup');
assert.match(css, /\.pd-shop-home-rail-frame[\s\S]{0,160}isolation:\s*isolate/, 'rail frame stacking isolation');
assert.match(css, /\.pd-shop-rail-btn[\s\S]{0,360}z-index:\s*6/, 'chevron z-index above track');

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
assert.match(css, /\.pd-shop-rail-btn--left\b/, 'physical left rail button');
assert.match(css, /\.pd-shop-rail-btn--right\b/, 'physical right rail button');
assert.match(
  css,
  /\.pd-shop-rail-btn--left[\s\S]{0,80}left:\s*0\.2rem/,
  'left control is physical left (not inset-inline, which mirrors in RTL)'
);
assert.match(css, /\.pd-shop-home-rail-track[\s\S]{0,220}overflow-x:\s*auto/, 'home rail allows swipe scroll');
assert.match(css, /\.pd-shop-home-rail-track[\s\S]{0,360}scrollbar-width:\s*none/, 'home rail hides native scrollbar');
assert.match(css, /\.pd-shop-dk-strip\s*\{[\s\S]{0,360}overflow-x:\s*auto/, 'category strip allows swipe scroll');
assert.match(css, /\.pd-shop-dk-strip\s*\{[\s\S]{0,520}scrollbar-width:\s*none/, 'category strip hides native scrollbar');
assert.match(
  css,
  /MOBILE_SHOP_LAYOUT_FIX[\s\S]{0,2800}\.pd-shop-dk-strip\s*\{[\s\S]{0,200}overflow-x:\s*auto/,
  'mobile layout fix keeps category strip overflow-x auto (not hidden)'
);
assert.doesNotMatch(
  css,
  /MOBILE_SHOP_LAYOUT_FIX[\s\S]{0,2800}\.pd-shop-dk-strip\s*\{[\s\S]{0,120}overflow-x:\s*hidden/,
  'mobile must not kill category touch swipe with overflow-x:hidden'
);
assert.match(css, /\.pd-shop-promo-banners\b/, 'promo banner styles');
const promoSrc = readFileSync(join(here, 'ShopPromoBanners.tsx'), 'utf8');
assert.match(promoSrc, /پت‌دیت/, 'promo banners include PetDate name');
assert.match(promoSrc, /برای پت شما/, 'first promo headline');
assert.match(promoSrc, /مناسب پت شما/, 'second promo headline');
assert.match(promoSrc, /promo-for-your-pet\.jpg/, 'first banner has a photo');
assert.match(promoSrc, /promo-fits-your-pet\.jpg/, 'second banner has a photo');
assert.match(promoSrc, /pd-shop-promo-banner-mark/, 'PetDate wordmark on banners');
assert.match(css, /\.pd-shop-promo-banner-photo\b/, 'banner photo layer');
const webRoot = join(here, '../../..');
assert.ok(existsSync(join(webRoot, 'public/media/shop/promo-for-your-pet.jpg')), 'groom banner photo on disk');
assert.ok(existsSync(join(webRoot, 'public/media/shop/promo-fits-your-pet.jpg')), 'travel banner photo on disk');
const art = readFileSync(join(here, 'shopCategoryIcons.tsx'), 'utf8');
assert.match(art, /ShopCategoryArt/, 'category art component');
assert.match(art, /SHOP_CATEGORY_PHOTOS/, 'category → illustration map export');
assert.match(art, /\/media\/shop\/categories\/illustrations/, 'unique SVGs under illustrations/');
assert.match(art, /pd-shop-dk-photo/, 'art img uses category photo class');
assert.doesNotMatch(art, /lucide-react/, 'category art is not Lucide outlines');
assert.match(art, /dog-food/, 'dog food has its own art kind');
assert.match(art, /cat-food/, 'cat food has a distinct art kind');
assert.match(art, /dog-toys/, 'dog toys distinct');
assert.match(art, /cat-toys/, 'cat toys distinct');
assert.ok(
  existsSync(join(webRoot, 'public/media/shop/categories/illustrations/dog-food.svg')),
  'dog-food illustration on disk'
);
assert.ok(
  existsSync(join(webRoot, 'public/media/shop/categories/illustrations/cat-food.svg')),
  'cat-food illustration on disk'
);
assert.ok(
  existsSync(join(webRoot, 'public/media/shop/categories/illustrations/dog-toys.svg')),
  'dog-toys illustration on disk'
);
assert.ok(
  existsSync(join(webRoot, 'public/media/shop/categories/illustrations/cat-toys.svg')),
  'cat-toys illustration on disk'
);
const dogFoodSvg = readFileSync(
  join(webRoot, 'public/media/shop/categories/illustrations/dog-food.svg'),
  'utf8'
);
const catFoodSvg = readFileSync(
  join(webRoot, 'public/media/shop/categories/illustrations/cat-food.svg'),
  'utf8'
);
assert.notEqual(dogFoodSvg, catFoodSvg, 'dog and cat food illustrations must differ');
assert.match(css, /\.pd-shop-dk-photo\b/, 'category photo styles');
assert.match(css, /\.pd-shop-filter-acc\b/, 'filter accordion styles');
assert.match(ci, /shopUxBatch\.selftest/, 'CI runs shop UX batch selftest');

console.log('shopUxBatch.selftest: ok');
