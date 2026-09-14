/**
 * DigiKala-style similar products ranking + PDP wiring.
 * Run: npx tsx packages/web/src/lib/shopSimilarProducts.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyLiveShopCatalog,
  getLiveProducts,
  getProduct,
  SHOP_PRODUCTS,
  type ShopProduct,
} from '../data/shopCatalog';
import {
  getSimilarProducts,
  isSpecialSaleBadge,
  similarLowStockQty,
  similarProductScore,
  SIMILAR_PRODUCTS_LIMIT,
} from './shopSimilarProducts';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, '../pages/shop/ShopProductPage.tsx'), 'utf8');
const rail = readFileSync(join(here, '../components/shop/ShopSimilarProducts.tsx'), 'utf8');
const card = readFileSync(join(here, '../components/shop/ShopProductCard.tsx'), 'utf8');
const css = readFileSync(join(here, '../styles/pepito.css'), 'utf8');
const dark = readFileSync(join(here, '../styles/theme-dark.css'), 'utf8');
const ci = readFileSync(join(here, '../../../../scripts/ci-selftest.sh'), 'utf8');

assert.ok(SHOP_PRODUCTS.length >= 8, 'catalog has enough SKUs to test similarity');
const current = SHOP_PRODUCTS[0]!;
assert.ok(current, 'seed product');

const similar = getSimilarProducts(current, SIMILAR_PRODUCTS_LIMIT);
assert.ok(similar.length > 0, 'finds similar products from live/static catalog');
assert.ok(similar.length <= 12, 'caps near DigiKala rail length');
assert.ok(
  similar.every((p) => p.id !== current.id),
  'excludes current product',
);
assert.ok(
  similar.every(
    (p) => p.categorySlug === current.categorySlug || p.brandId === current.brandId,
  ),
  'same category and/or same brand only',
);

const brandOnly: ShopProduct = {
  ...current,
  id: '__score-brand__',
  slug: 'score-brand',
  categorySlug: '__other-cat__',
  brandId: current.brandId,
};
const catOnly: ShopProduct = {
  ...current,
  id: '__score-cat__',
  slug: 'score-cat',
  categorySlug: current.categorySlug,
  brandId: '__other-brand__',
};
const both: ShopProduct = {
  ...current,
  id: '__score-both__',
  slug: 'score-both',
  categorySlug: current.categorySlug,
  brandId: current.brandId,
  inStock: true,
};
assert.equal(similarProductScore(current, current), -1, 'self scores out');
assert.ok(similarProductScore(current, both) > similarProductScore(current, catOnly));
assert.ok(similarProductScore(current, catOnly) > similarProductScore(current, brandOnly));
assert.equal(similarProductScore(current, { ...brandOnly, brandId: 'x', categorySlug: 'y' }), -1);

assert.equal(similarLowStockQty({ ...current, stockQty: 3 }), 3);
assert.equal(similarLowStockQty({ ...current, stockQty: 25 }), null);
assert.equal(similarLowStockQty({ ...current, stockQty: 0 }), null);
assert.ok(isSpecialSaleBadge('sale'));
assert.ok(isSpecialSaleBadge('hot'));
assert.equal(isSpecialSaleBadge('new'), false);

// Live hydrate carries stockQty for low-stock UI.
applyLiveShopCatalog({
  products: getLiveProducts().slice(0, 3).map((p, i) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    brandId: p.brandId,
    categorySlug: p.categorySlug,
    petTypes: p.petTypes,
    priceToman: p.priceToman,
    compareAtToman: p.compareAtToman,
    image: p.image,
    images: p.images,
    badge: p.badge,
    inStock: true,
    stockQty: i === 0 ? 2 : 40,
    params: p.params,
    description: p.description,
    featured: p.featured,
    titleEn: p.titleEn,
  })),
});
const hydrated = getProduct(current.id);
assert.ok(hydrated, 'hydrated product');
assert.equal(hydrated!.stockQty, 2, 'applyLiveShopCatalog keeps stockQty');
assert.equal(similarLowStockQty(hydrated!), 2);

assert.match(page, /ShopSimilarProducts/, 'PDP imports similar rail');
assert.match(page, /<ShopSimilarProducts\s+product=\{product\}\s*\/>/, 'PDP mounts similar rail');
assert.doesNotMatch(page, /خریداران این کالا را هم دیده‌اند/, 'old grid eyebrow removed');
assert.match(rail, /data-testid="shop-similar-products"/, 'rail test id');
assert.match(rail, /کالاهای مشابه/, 'rail title');
assert.match(rail, /getSimilarProducts/, 'uses similarity helper');
assert.match(rail, /ShopRailNavButtons/, 'similar rail uses shared L/R buttons');
assert.match(card, /variant\s*===\s*['"]similar['"]/, 'card similar variant');
assert.match(card, /فروش ویژه/, 'special sale label');
assert.match(css, /\.pd-dk-similar\b/, 'similar CSS present');
assert.match(css, /\.pd-dk-similar-title\b/, 'title accent styles');
assert.match(css, /\.pd-dk-similar-next\b/, 'legacy chevron class kept');
assert.match(css, /\.pd-shop-rail-btn\b/, 'visible L/R rail buttons');
assert.match(css, /\.pd-dk-similar-track[\s\S]{0,180}overflow-x:\s*hidden/, 'similar rail hides native scrollbar');
assert.match(dark, /pd-dk-similar/, 'dark mode styles for similar rail');
assert.match(ci, /shopSimilarProducts\.selftest/, 'CI runs similar products selftest');

console.log('shopSimilarProducts.selftest: ok');
