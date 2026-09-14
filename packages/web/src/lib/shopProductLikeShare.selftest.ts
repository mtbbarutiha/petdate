/**
 * Shop PDP Like + Share contract (vertical DigiKala action rail).
 * Run: npx tsx packages/web/src/lib/shopProductLikeShare.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { productPublicUrl } from './share.ts';
import {
  isShopFavorite,
  SHOP_FAVORITES_STORAGE_KEY,
  toggleShopFavoriteId,
} from './shopFavorites.ts';

assert.equal(productPublicUrl('royal-canin-mini-adult-2kg'), '/shop/product/royal-canin-mini-adult-2kg');
assert.equal(productPublicUrl('p221'), '/shop/product/p221');
assert.equal(productPublicUrl(''), '/shop');

assert.equal(SHOP_FAVORITES_STORAGE_KEY, 'petdate.shop.favorites.v1');
assert.deepEqual(toggleShopFavoriteId('p221', []), ['p221']);
assert.deepEqual(toggleShopFavoriteId('p221', ['p221']), []);
assert.deepEqual(toggleShopFavoriteId('p222', ['p221']), ['p221', 'p222']);
assert.equal(isShopFavorite('p221', ['p221', 'p223']), true);
assert.equal(isShopFavorite('p999', ['p221']), false);
assert.deepEqual(toggleShopFavoriteId('  ', ['p221']), ['p221']);

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, '../pages/shop/ShopProductPage.tsx'), 'utf8');
const css = readFileSync(join(here, '../styles/pepito.css'), 'utf8');
const dark = readFileSync(join(here, '../styles/theme-dark.css'), 'utf8');

assert.match(page, /useShopFavorites/, 'PDP uses shop favorites hook');
assert.match(page, /shareOrCopyUrl/, 'PDP reuses Web Share / clipboard helper');
assert.match(page, /productPublicUrl/, 'PDP shares product URL helper');
assert.match(page, /pd-dk-action-rail/, 'PDP renders DigiKala vertical action rail');
assert.match(page, /pd-dk-gallery-with-rail/, 'rail sits beside product gallery');
assert.doesNotMatch(page, /pd-dk-tools/, 'horizontal like/share row removed from info column');
assert.match(page, /aria-label="عملیات کالا"/, 'action rail labeled in Persian');
assert.match(page, /اشتراک‌گذاری/, 'Share label in Persian');
assert.match(page, /Heart/, 'Like uses Heart icon');
assert.match(page, /Share2/, 'Share uses Share2 icon');

assert.match(css, /\.pd-dk-action-rail\s*\{/, 'action rail styles');
assert.match(css, /\.pd-dk-action-rail-btn\.is-liked\s*\{/, 'liked state styles');
assert.match(dark, /html\[data-theme='dark'\]\s*\.pd-dk-action-rail-btn\b/, 'dark theme rail styles');

console.log('shopProductLikeShare.selftest: ok');
