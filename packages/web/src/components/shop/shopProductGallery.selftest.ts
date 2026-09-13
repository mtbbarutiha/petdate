/**
 * Digikala-like PDP gallery + fullscreen lightbox contract.
 * Run: npx tsx packages/web/src/components/shop/shopProductGallery.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepShopGalleryIndex } from '../../lib/shopGalleryNav.ts';

assert.equal(stepShopGalleryIndex(0, 3, 1), 1);
assert.equal(stepShopGalleryIndex(2, 3, 1), 0);
assert.equal(stepShopGalleryIndex(0, 3, -1), 2);
assert.equal(stepShopGalleryIndex(1, 0, 1), 0);

const here = dirname(fileURLToPath(import.meta.url));
const gallery = readFileSync(join(here, 'ShopProductGallery.tsx'), 'utf8');
const page = readFileSync(join(here, '../../pages/shop/ShopProductPage.tsx'), 'utf8');
const css = readFileSync(join(here, '../../styles/pepito.css'), 'utf8');

assert.match(page, /ShopProductGallery/, 'PDP uses gallery component');
assert.match(gallery, /createPortal/, 'lightbox portals to document.body');
assert.match(gallery, /data-testid="shop-product-lightbox"/, 'lightbox test id');
assert.match(gallery, /نمایش تصویر در اندازه بزرگ/, 'main image click opens lightbox');
assert.match(gallery, /pd-dk-gallery-track/, 'main area is a slider track');
assert.match(gallery, /pd-dk-thumbs/, 'thumbnail strip under main');
assert.match(gallery, /pd-dk-lightbox/, 'fullscreen lightbox');
assert.match(gallery, /همه تصاویر/, 'optional all-images grid button');
assert.match(gallery, /useDialogFocusTrap/, 'ESC + focus trap on lightbox');
assert.match(gallery, /ArrowRight/, 'keyboard next');
assert.match(gallery, /pd-dk-lightbox-arrow/, 'circular lightbox chevrons');
assert.match(gallery, /pd-dk-lightbox-close/, 'close X');
assert.match(gallery, /pd-dk-lightbox-thumbs/, 'lightbox thumb strip');

assert.match(css, /\.pd-dk-lightbox\s*\{[^}]*background:\s*#000/, 'lightbox black backdrop');
assert.match(css, /\.pd-dk-lightbox-arrow\s*\{[^}]*border-radius:\s*50%/, 'circular lightbox arrows');
assert.match(css, /\.pd-dk-gallery-arrow\s*\{[^}]*border-radius:\s*50%/, 'circular PDP arrows');
assert.match(
  css,
  /\.pd-dk-gallery-main\s*\{[^}]*background:\s*#ffffff/,
  'PDP well stays #ffffff — no purple chrome rewrite'
);
assert.match(
  css,
  /\.pd-shop-card-media\s*\{[^}]*background:\s*#ffffff/,
  'listing card photo well untouched'
);
assert.match(css, /\.pd-dk-lightbox-thumb\.is-active\s*\{[^}]*border-color:\s*#fff/, 'active lightbox thumb');

console.log('shopProductGallery.selftest: ok');
