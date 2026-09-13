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

const pilots = [
  ['p221', 'dog-food-royal-canin-mini-adult-2kg', 'royal-canin-mini-adult-2kg', 8_881_000],
  ['p222', 'dog-food-royal-canin-xsmall-puppy-1-5kg', 'royal-canin-xsmall-puppy-1.5kg', 8_894_000],
  ['p223', 'cat-food-royal-canin-persian-adult-400g', 'royal-canin-persian-adult-400g', 2_741_600],
] as const;
for (const [id, slug, stem, price] of pilots) {
  const product = getProduct(slug) ?? getProduct(id);
  assert.ok(product, `${id} exists`);
  assert.equal(product.priceToman, price, `${id} price unchanged`);
  const g = productGallery(product);
  assert.equal(g.length, 3, `${id} gallery has 3 unique angles`);
  assert.ok(g[0].includes(`${stem}.jpg?v=gallery-v1`), `${id} front is gallery-v1`);
  assert.ok(g[1].includes(`${stem}-2.jpg?v=gallery-v1`), `${id} angle 2 is gallery-v1`);
  assert.ok(g[2].includes(`${stem}-3.jpg?v=gallery-v1`), `${id} angle 3 is gallery-v1`);
  assert.doesNotMatch(g.join(' '), /purple|5c4d91/i, `${id} gallery has no purple asset`);
}

console.log('shopGallery.selftest: ok');
