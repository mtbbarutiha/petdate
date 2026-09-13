/**
 * Shop PDP gallery must not reference the known-missing 01-3.png thumb.
 * Royal Canin pilots expose 3 unique gallery srcs (real -2/-3 angle files).
 * Run: npx tsx packages/web/src/data/shopGallery.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  applyLiveShopCatalog,
  getProduct,
  productGallery,
} from './shopCatalog.ts';

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

const fromParams = productGallery({
  ...product,
  images: undefined,
  params: { ...product.params, __images: `${product.image}|/pepito/uploads/extra.jpg` },
});
assert.ok(fromParams.includes('/pepito/uploads/extra.jpg'), 'gallery reads params.__images');
assert.ok(!fromParams.includes('__images'), 'gallery srcs are URLs, not the key');

for (const slug of [
  'dog-food-royal-canin-mini-adult-2kg',
  'dog-food-royal-canin-xsmall-puppy-1-5kg',
  'cat-food-royal-canin-persian-adult-400g',
]) {
  const pilot = getProduct(slug);
  assert.ok(pilot, `${slug} exists`);
  const shots = productGallery(pilot);
  assert.equal(shots.length, 3, `${slug} has 3 gallery srcs`);
  assert.equal(new Set(shots).size, 3, `${slug} gallery srcs are unique`);
  assert.ok(shots[1]?.includes('-2.jpg?v=gallery-v1'), `${slug} angle 2 file`);
  assert.ok(shots[2]?.includes('-3.jpg?v=gallery-v1'), `${slug} angle 3 file`);
  assert.doesNotMatch(shots.join(' '), /purple|5c4d91|بنفش/i, `${slug} no purple asset`);
}

const p221 = getProduct('dog-food-royal-canin-mini-adult-2kg')!;
applyLiveShopCatalog({
  products: [
    {
      id: p221.id,
      slug: p221.slug,
      title: p221.title,
      brandId: p221.brandId,
      categorySlug: p221.categorySlug,
      petTypes: p221.petTypes,
      priceToman: p221.priceToman,
      image: p221.image,
      images: p221.images,
      inStock: true,
      params: { وزن: '۲ کیلوگرم', __images: (p221.images ?? []).join('|') },
    },
  ],
});
const hydrated = getProduct(p221.slug);
assert.ok(hydrated, 'hydrated p221');
assert.equal(productGallery(hydrated!).length, 3, 'live catalog keeps 3 images');
assert.ok(!('__images' in hydrated!.params), 'live params strip __images');

console.log('shopGallery.selftest: ok');
