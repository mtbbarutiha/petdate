/**
 * DigiKala-style shop breadcrumbs.
 * Run: npx tsx packages/web/src/lib/shopBreadcrumb.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEO } from '@petdate/shared';
import { getCategory, getProduct } from '../data/shopCatalog.ts';
import {
  shopCategoryBreadcrumbs,
  shopHomeBreadcrumbs,
  shopProductBreadcrumbs,
  shopSeoBreadcrumbItems,
} from './shopBreadcrumb.ts';

const home = shopHomeBreadcrumbs('fa');
assert.deepEqual(
  home.map((c) => c.label),
  [SEO.siteName, 'شاپ']
);
assert.equal(home[0]?.to, '/');
assert.equal(home[1]?.to, undefined);

const catTrail = shopCategoryBreadcrumbs({ lang: 'fa', categorySlug: 'cat-food' });
assert.deepEqual(
  catTrail.map((c) => c.label),
  [SEO.siteName, 'شاپ', 'گربه', 'غذای گربه']
);
assert.equal(catTrail[0]?.to, '/');
assert.equal(catTrail[1]?.to, '/shop');
assert.equal(catTrail[2]?.to, '/shop/c/all?pet=cat');
assert.equal(catTrail[3]?.to, undefined);

const allTrail = shopCategoryBreadcrumbs({ lang: 'fa', categorySlug: 'all' });
assert.deepEqual(
  allTrail.map((c) => c.label),
  [SEO.siteName, 'شاپ', 'همه محصولات']
);

const petAll = shopCategoryBreadcrumbs({ lang: 'fa', categorySlug: 'all', petType: 'cat' });
assert.deepEqual(
  petAll.map((c) => c.label),
  [SEO.siteName, 'شاپ', 'گربه']
);
assert.equal(petAll[2]?.to, undefined);

const product =
  getProduct('cat-food-royal-canin-persian-adult-400g') ?? getProduct('p223');
assert.ok(product, 'expected a live cat-food product for PDP trail');
assert.equal(product.categorySlug, 'cat-food');
const category = getCategory(product.categorySlug);
const pdp = shopProductBreadcrumbs({ lang: 'fa', product, category });
assert.equal(pdp[0]?.label, SEO.siteName);
assert.equal(pdp[1]?.label, 'شاپ');
assert.equal(pdp[1]?.to, '/shop');
if (category) {
  assert.equal(pdp[2]?.label, 'گربه');
  assert.equal(pdp[2]?.to, '/shop/c/all?pet=cat');
  assert.equal(pdp[3]?.label, category.labelFa);
  assert.equal(pdp[3]?.to, `/shop/c/${category.slug}`);
  assert.equal(pdp[4]?.to, undefined);
  assert.ok(pdp[4]?.label);
}

const seoCat = shopSeoBreadcrumbItems({ categorySlug: 'cat-food' });
assert.deepEqual(
  seoCat.map((c) => c.name),
  [SEO.siteName, 'شاپ', 'گربه', 'غذای گربه']
);

const here = dirname(fileURLToPath(import.meta.url));
const component = readFileSync(join(here, '../components/shop/ShopBreadcrumb.tsx'), 'utf8');
const categoryPage = readFileSync(join(here, '../pages/shop/ShopCategoryPage.tsx'), 'utf8');
const productPage = readFileSync(join(here, '../pages/shop/ShopProductPage.tsx'), 'utf8');
const homePage = readFileSync(join(here, '../pages/shop/ShopHomePage.tsx'), 'utf8');
const css = readFileSync(join(here, '../styles/pepito.css'), 'utf8');
const dark = readFileSync(join(here, '../styles/theme-dark.css'), 'utf8');
const ci = readFileSync(join(here, '../../../../scripts/ci-selftest.sh'), 'utf8');

assert.match(component, /aria-label="breadcrumb"/);
assert.match(component, /<ol className="pd-shop-breadcrumb-list"/);
assert.match(component, /aria-current/);
// Listing/home chrome: no breadcrumb bar under hero
assert.doesNotMatch(homePage, /ShopBreadcrumb/, 'shop home hides listing breadcrumbs');
assert.doesNotMatch(categoryPage, /ShopBreadcrumb/, 'category listing hides breadcrumbs');
// PDP keeps breadcrumbs above the gallery
assert.match(productPage, /ShopBreadcrumb/);
assert.match(productPage, /shopProductBreadcrumbs/);
assert.match(productPage, /pd-dk-pdp-breadcrumb/, 'PDP breadcrumbs sit above gallery');
assert.match(productPage, /pd-dk-gallery-col/, 'gallery column wraps breadcrumb + photo');
assert.match(css, /\.pd-shop-breadcrumb-list\s*\{/);
assert.match(css, /\.pd-shop-breadcrumb-sep\s*\{/);
assert.match(css, /\.pd-dk-pdp-breadcrumb/, 'PDP breadcrumb placement styles');
assert.match(dark, /html\[data-theme='dark'\]\s*\.pd-shop-breadcrumb\b/);
assert.match(ci, /shopBreadcrumb\.selftest\.ts/);

console.log('shopBreadcrumb.selftest: ok');
