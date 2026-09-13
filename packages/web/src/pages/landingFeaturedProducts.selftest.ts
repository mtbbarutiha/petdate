/**
 * Landing «محصولات ویژه ما» must use the live shop catalog (p221–p235 + p250–p274),
 * not hardcoded demo SKUs / Pepito stock photos.
 * Run: npx tsx packages/web/src/pages/landingFeaturedProducts.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFeaturedProducts, SHOP_PRODUCTS } from '../data/shopCatalog.ts';

const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
const below = readFileSync(join(webSrc, 'pages/WelcomeBelowFold.tsx'), 'utf8');

assert.match(below, /getFeaturedProducts/, 'landing featured grid reads shop catalog');
assert.match(below, /formatToman/, 'landing shows live catalog prices');
assert.match(below, /productTitleForLang/, 'landing titles follow shop locale helper');
assert.match(below, /LANDING_FEATURED_LIMIT/, 'landing caps the teaser grid size');
assert.doesNotMatch(below, /PRODUCT_DEFS/, 'no hardcoded landing product defs');
assert.doesNotMatch(
  below,
  /landing\.prodBowl|landing\.prodToy|landing\.prodLitter|landing\.prodFood/,
  'no stale demo product i18n titles on landing shop grid'
);
assert.doesNotMatch(
  below,
  /dog-bowls-1-p41|cat-toys-1-p131|cat-litter-1-p161|cat-food-2-p102/,
  'no purged demo PDP links on landing'
);
assert.doesNotMatch(
  below,
  /\/pepito\/uploads\/(?:01-1\.png|1-1\.jpg|03\.png|06-1\.png)/,
  'no mismatched Pepito demo assets on landing shop grid'
);

const featured = getFeaturedProducts();
assert.ok(featured.length >= 4, 'live catalog has featured products for the landing grid');
assert.equal(SHOP_PRODUCTS.length, 40, 'live shop is the 40-SKU catalog');

const liveIds = new Set(SHOP_PRODUCTS.map((p) => p.id));
for (const p of featured.slice(0, 4)) {
  assert.ok(liveIds.has(p.id), `featured ${p.id} is in the live catalog`);
  assert.match(p.id, /^p(22[1-9]|23[0-5]|25\d|26\d|27[0-4])$/, `featured ${p.id} is a live SKU`);
  assert.ok(p.image.startsWith('/pepito/uploads/'), `featured ${p.id} image is under uploads`);
  assert.ok(!p.image.includes('01-1.png') && !p.image.includes('03.png'), `featured ${p.id} image is not a demo stock shot`);
  assert.ok(p.title.trim().length > 0, `featured ${p.id} has a title`);
  assert.ok(p.priceToman > 0, `featured ${p.id} has a price`);
  assert.doesNotMatch(p.slug, /-p([1-9]|[1-9]\d|[12]\d{2})$/, `featured ${p.id} is not a demo p1–p220 slug`);
}

console.log('landingFeaturedProducts.selftest: ok');
