/**
 * Shop product search contract: chrome placement, hotkey, results route.
 * Run: npx tsx packages/web/src/components/shop/shopProductSearch.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SHOP_SEARCH_DROPDOWN_LIMIT,
  isShopSearchHotkey,
  shopProductPath,
  shopSearchResultsPath,
} from '../../lib/shopProductSearch.ts';

assert.equal(shopSearchResultsPath(''), '/shop/c/all');
assert.equal(shopSearchResultsPath('  '), '/shop/c/all');
assert.equal(
  shopSearchResultsPath('رویال'),
  `/shop/c/all?q=${encodeURIComponent('رویال')}`
);
assert.equal(
  shopProductPath('dog-food-royal-canin-mini-adult-2kg'),
  '/shop/product/dog-food-royal-canin-mini-adult-2kg'
);
assert.equal(SHOP_SEARCH_DROPDOWN_LIMIT, 8);

assert.equal(isShopSearchHotkey({ key: 'k', metaKey: true, ctrlKey: false, altKey: false }), true);
assert.equal(isShopSearchHotkey({ key: 'K', metaKey: false, ctrlKey: true, altKey: false }), true);
assert.equal(isShopSearchHotkey({ key: 'k', metaKey: false, ctrlKey: false, altKey: false }), false);
assert.equal(isShopSearchHotkey({ key: 'k', metaKey: true, ctrlKey: false, altKey: true }), false);
assert.equal(isShopSearchHotkey({ key: 'f', metaKey: true, ctrlKey: false, altKey: false }), false);

const here = dirname(fileURLToPath(import.meta.url));
const chrome = readFileSync(join(here, 'ShopChrome.tsx'), 'utf8');
const search = readFileSync(join(here, 'ShopProductSearch.tsx'), 'utf8');
const css = readFileSync(join(here, '../../styles/pepito.css'), 'utf8');
const dark = readFileSync(join(here, '../../styles/theme-dark.css'), 'utf8');
const fa = readFileSync(join(here, '../../i18n/locales/fa.ts'), 'utf8');
const en = readFileSync(join(here, '../../i18n/locales/en.ts'), 'utf8');
const category = readFileSync(join(here, '../../pages/shop/ShopCategoryPage.tsx'), 'utf8');
const ci = readFileSync(join(here, '../../../../../scripts/ci-selftest.sh'), 'utf8');

assert.match(chrome, /ShopProductSearch/, 'ShopChrome mounts primary product search');
assert.match(chrome, /pd-shop-search-bar/, 'search sits in sticky chrome bar under nav');
assert.match(search, /isShopSearchHotkey/, 'Ctrl\\/Cmd+K focuses search (no visible badge)');
assert.doesNotMatch(search, /pd-shop-search-kbd/, 'Ctrl+K badge removed from search UI');
assert.doesNotMatch(search, /Ctrl\+K/, 'no Ctrl+K label in search component');
assert.match(search, /shopSearchResultsPath/, 'submit navigates to listing ?q=');
assert.match(search, /filterProducts/, 'dropdown filters live catalog');
assert.match(search, /data-testid="shop-product-search"/, 'search test id');
assert.match(css, /\.pd-shop-search-pill/, 'pill search styles');
assert.match(css, /\.pd-shop-search-bar[\s\S]*position:\s*sticky/, 'search bar sticky');
assert.match(
  css,
  /@media \(max-width: 859px\)[\s\S]*\.pd-shop-page \.pd-shop-search-bar[\s\S]{0,180}top:\s*0/,
  'mobile shop search sticks to the viewport top'
);
assert.match(css, /@media \(max-width: 720px\), \(pointer: coarse\)[\s\S]*\.pd-shop-search-bar/, 'mobile sticky search rules');
assert.match(dark, /pd-shop-search-pill/, 'dark mode search styles');
assert.match(fa, /search:\s*"جستجو"/, 'FA shop.search');
assert.match(en, /search:\s*"Search"/, 'EN shop.search');
assert.match(fa, /searchSeeAll/, 'FA see-all results copy');
assert.match(en, /searchSeeAll/, 'EN see-all results copy');
assert.match(category, /searchParams\.get\('q'\)/, 'category listing already honors ?q=');
assert.match(ci, /shopProductSearch\.selftest/, 'CI runs shop product search selftest');

console.log('shopProductSearch.selftest: ok');
