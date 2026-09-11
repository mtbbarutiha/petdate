/**
 * Shop PDP gallery must not reference the known-missing 01-3.png thumb.
 * Run: npx tsx packages/web/src/data/shopGallery.selftest.ts
 */
import assert from 'node:assert/strict';
import { getProduct, productGallery } from './shopCatalog.ts';

const product = getProduct('dog-food-1-p1') ?? getProduct('p1');
assert.ok(product, 'sample product exists');
const gallery = productGallery(product);
assert.ok(gallery.length >= 1, 'gallery has at least the main image');
assert.ok(
  !gallery.some((src) => src.includes('01-3.png')),
  'gallery must not include missing 01-3.png'
);
assert.equal(new Set(gallery).size, gallery.length, 'gallery has no duplicate srcs');
assert.ok(gallery.every((src) => src.startsWith('/')), 'gallery srcs are root-relative');

console.log('shopGallery.selftest: ok');
