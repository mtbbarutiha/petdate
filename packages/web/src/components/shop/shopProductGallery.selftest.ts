/**
 * Digikala-like PDP gallery + fullscreen lightbox contract.
 * Run: npx tsx packages/web/src/components/shop/shopProductGallery.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shopGalleryPointerIntent, stepShopGalleryIndex } from '../../lib/shopGalleryNav.ts';

assert.equal(stepShopGalleryIndex(0, 3, 1), 1);
assert.equal(stepShopGalleryIndex(2, 3, 1), 0);
assert.equal(stepShopGalleryIndex(0, 3, -1), 2);
assert.equal(stepShopGalleryIndex(1, 0, 1), 0);
assert.equal(shopGalleryPointerIntent(0, true), 'open');
assert.equal(shopGalleryPointerIntent(12, true), 'open', 'small pointer jitter still opens lightbox');
assert.equal(shopGalleryPointerIntent(-50, true), 'next');
assert.equal(shopGalleryPointerIntent(50, true), 'prev');
assert.equal(shopGalleryPointerIntent(-80, false), 'open', 'single image never swipes');

const here = dirname(fileURLToPath(import.meta.url));
const gallery = readFileSync(join(here, 'ShopProductGallery.tsx'), 'utf8');
const page = readFileSync(join(here, '../../pages/shop/ShopProductPage.tsx'), 'utf8');
const app = readFileSync(join(here, '../../App.tsx'), 'utf8');
const chrome = readFileSync(join(here, 'ShopChrome.tsx'), 'utf8');
const css = readFileSync(join(here, '../../styles/pepito.css'), 'utf8');

assert.match(page, /ShopProductGallery/, 'PDP uses gallery component');
assert.match(page, /ShopProductAliasRedirect/, 'short /shop/:slug aliases the PDP');
assert.match(page, /pd-dk-action-rail/, 'PDP exposes DigiKala vertical like + share rail');
assert.match(page, /shareOrCopyUrl/, 'PDP share uses shared helper');
assert.match(app, /shop\/p\/:id/, 'Telegram /shop/p/:slug alias is routed');
assert.match(app, /shop\/:id/, 'bare /shop/:slug alias is routed');
assert.match(app, /ShopProductAliasRedirect/, 'alias route uses PDP redirect');
assert.doesNotMatch(chrome, /key=\{ready/, 'catalog hydrate must not remount PDP (kills lightbox)');
assert.match(gallery, /createPortal/, 'lightbox portals to document.body');
assert.match(gallery, /data-testid="shop-product-lightbox"/, 'lightbox test id');
assert.match(gallery, /data-testid="shop-product-gallery-main"/, 'main image test id');
assert.match(gallery, /onClick=\{onMainClick\}/, 'click on main image opens lightbox');
assert.match(gallery, /type="button"/, 'main well is a real button');
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
// Left (--prev) must show ChevronLeft; right (--next) must show ChevronRight.
// Icons were previously swapped (RTL overcorrection) so arrows pointed inward.
assert.match(
  gallery,
  /pd-dk-gallery-arrow--prev[\s\S]*?<ChevronLeft[\s\S]*?pd-dk-gallery-arrow--next[\s\S]*?<ChevronRight/,
  'PDP gallery: left=ChevronLeft, right=ChevronRight'
);
assert.match(
  gallery,
  /pd-dk-lightbox-arrow--prev[\s\S]*?<ChevronLeft[\s\S]*?pd-dk-lightbox-arrow--next[\s\S]*?<ChevronRight/,
  'lightbox: left=ChevronLeft, right=ChevronRight'
);
assert.doesNotMatch(
  gallery,
  /pd-dk-gallery-arrow--prev[\s\S]*?<ChevronRight[\s\S]*?pd-dk-gallery-arrow--next[\s\S]*?<ChevronLeft/,
  'PDP gallery arrows must not be swapped inward'
);
assert.doesNotMatch(
  gallery,
  /pd-dk-lightbox-arrow--prev[\s\S]*?<ChevronRight[\s\S]*?pd-dk-lightbox-arrow--next[\s\S]*?<ChevronLeft/,
  'lightbox arrows must not be swapped inward'
);

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
