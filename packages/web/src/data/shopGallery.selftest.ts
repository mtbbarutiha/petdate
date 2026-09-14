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

const product = getProduct('dog-food-royal-canin-mini-adult-2kg') ?? getProduct('p221');
assert.ok(product, 'sample live product exists');
assert.equal(getProduct('p1'), undefined, 'demo p1 is gone from catalog');
assert.equal(getProduct('dog-food-1-p1'), undefined, 'demo slug is gone from catalog');
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

const pilots = [
  ['p221', 'dog-food-royal-canin-mini-adult-2kg', 'royal-canin-mini-adult-2kg', 8_881_000],
  ['p222', 'dog-food-royal-canin-xsmall-puppy-1-5kg', 'royal-canin-xsmall-puppy-1.5kg', 8_294_000],
  ['p223', 'cat-food-royal-canin-persian-adult-400g', 'royal-canin-persian-adult-400g', 2_742_000],
] as const;
for (const [id, slug, stem, price] of pilots) {
  const pilot = getProduct(slug) ?? getProduct(id);
  assert.ok(pilot, `${id} exists`);
  assert.equal(pilot.priceToman, price, `${id} price unchanged`);
  const shots = productGallery(pilot);
  assert.equal(shots.length, 3, `${id} gallery has 3 unique angles`);
  assert.equal(new Set(shots).size, 3, `${id} gallery srcs are unique`);
  assert.ok(shots[0].includes(`${stem}.jpg?v=gallery-v1`), `${id} front is gallery-v1`);
  assert.ok(shots[1].includes(`${stem}-2.jpg?v=gallery-v1`), `${id} angle 2 is gallery-v1`);
  assert.ok(shots[2].includes(`${stem}-3.jpg?v=gallery-v1`), `${id} angle 3 is gallery-v1`);
  assert.doesNotMatch(shots.join(' '), /purple|5c4d91|بنفش/i, `${id} gallery has no purple asset`);
}

const batch2 = [
  ['p224', 'dog-food-royal-canin-mini-indoor-puppy-1-5kg', 8_294_000],
  ['p229', 'cat-food-josera-culinesse-2kg', 4_004_000],
  ['p233', 'cat-food-royal-canin-fit-2kg', 10_217_000],
  ['p235', 'cat-food-josera-kitten-2kg', 4_004_000],
] as const;
for (const [id, slug, price] of batch2) {
  const item = getProduct(slug) ?? getProduct(id);
  assert.ok(item, `${id} exists`);
  assert.equal(item.priceToman, price, `${id} MANIFEST price`);
  const shots = productGallery(item);
  assert.equal(shots.length, 3, `${id} gallery has 3 unique angles`);
  assert.ok(shots[0].includes(`${slug}.jpg?v=batch2-v1`), `${id} front is batch2-v1`);
  assert.ok(shots[1].includes(`${slug}-2.jpg?v=batch2-v1`), `${id} angle 2 is batch2-v1`);
  assert.ok(shots[2].includes(`${slug}-3.jpg?v=batch2-v1`), `${id} angle 3 is batch2-v1`);
  assert.doesNotMatch(shots.join(' '), /purple|5c4d91|بنفش/i, `${id} gallery has no purple asset`);
}
assert.ok(getProduct('cat-food-josera-kitten-2kg'), 'Josera Kitten is in catalog');

const batch3 = [
  ['p236', 'cat-food-royal-canin-sensible-2kg', 10_217_000],
  ['p237', 'cat-food-josera-marinesse-2kg', 4_004_000],
  ['p244', 'cat-food-royal-canin-urinary-so-1-5kg', 9_623_000],
  ['p249', 'dog-food-royal-canin-hypoallergenic-2kg', 11_702_000],
] as const;
for (const [id, slug, price] of batch3) {
  const item = getProduct(slug) ?? getProduct(id);
  assert.ok(item, `${id} exists`);
  assert.equal(item.priceToman, price, `${id} MANIFEST price`);
  const shots = productGallery(item);
  assert.equal(shots.length, 3, `${id} gallery has 3 unique angles`);
  assert.ok(shots[0].includes(`${slug}.jpg?v=batch3-v2`), `${id} front is batch3-v2`);
  assert.ok(shots[1].includes(`${slug}-2.jpg?v=batch3-v2`), `${id} angle 2 is batch3-v2`);
  assert.ok(shots[2].includes(`${slug}-3.jpg?v=batch3-v2`), `${id} angle 3 is batch3-v2`);
  assert.doesNotMatch(shots.join(' '), /purple|5c4d91|بنفش/i, `${id} gallery has no purple asset`);
}
assert.ok(getProduct('cat-food-josera-marinesse-2kg'), 'Josera Marinesse is in catalog');

const batchMulti = [
  ['p250', 'cat-litter-mr-cat-cat-litter-10-l-carbon', 502_000],
  ['p259', 'dog-treats-wanpy-toothbrush-chews-100g', 660_000],
] as const;
for (const [id, slug, price] of batchMulti) {
  const item = getProduct(slug) ?? getProduct(id);
  assert.ok(item, `${id} exists`);
  assert.equal(item.priceToman, price, `${id} MANIFEST price`);
  const shots = productGallery(item);
  assert.equal(shots.length, 3, `${id} gallery has 3 unique angles`);
  assert.ok(shots[0].includes(`${slug}.jpg?v=batch-multi-w1-v5`), `${id} front is batch-multi-w1-v5`);
  assert.ok(shots[1].includes(`${slug}-2.jpg?v=batch-multi-w1-v5`), `${id} angle 2 is batch-multi-w1-v5`);
  assert.ok(shots[2].includes(`${slug}-3.jpg?v=batch-multi-w1-v5`), `${id} angle 3 is batch-multi-w1-v5`);
  assert.doesNotMatch(shots.join(' '), /purple|5c4d91|بنفش/i, `${id} gallery has no purple asset`);
}
assert.ok(getProduct('cat-litter-mr-cat-cat-litter-10-l-carbon'), 'MR.CAT carbon litter is in catalog');

const batchMultiW2 = [
  ['p260', 'dog-treats-wanpy-chicken-jerky-chips-100g', 655_000],
  ['p266', 'dog-toys-enjoy-the-meal-puzzle-toy', 5_480_000],
  ['p269', 'dog-toys-luna-squeaky-smile-watermelon-plush-dog-toy', 362_000],
] as const;
for (const [id, slug, price] of batchMultiW2) {
  const item = getProduct(slug) ?? getProduct(id);
  assert.ok(item, `${id} exists`);
  assert.equal(item.priceToman, price, `${id} MANIFEST price`);
  const shots = productGallery(item);
  assert.equal(shots.length, 3, `${id} gallery has 3 unique angles`);
  assert.ok(shots[0].includes(`${slug}.jpg?v=batch-multi-w2-v4`), `${id} front is batch-multi-w2-v4`);
  assert.ok(shots[1].includes(`${slug}-2.jpg?v=batch-multi-w2-v4`), `${id} angle 2 is batch-multi-w2-v4`);
  assert.ok(shots[2].includes(`${slug}-3.jpg?v=batch-multi-w2-v4`), `${id} angle 3 is batch-multi-w2-v4`);
  assert.doesNotMatch(shots.join(' '), /purple|5c4d91|بنفش/i, `${id} gallery has no purple asset`);
}
assert.ok(getProduct('dog-treats-wanpy-chicken-jerky-chips-100g'), 'Wanpy jerky chips is in catalog');

const batchMultiW3 = [
  ['p270', 'dog-toys-luna-pomegranate-felt-squeaky-dog-toy', 322_000],
  ['p272', 'cat-toys-petopoli-4-way-foldable-cat-play-tunnel', 2_310_000],
  ['p279', 'dog-accessories-hannapet-silicone-dog-leash-size-l', 3_332_000],
] as const;
for (const [id, slug, price] of batchMultiW3) {
  const item = getProduct(slug) ?? getProduct(id);
  assert.ok(item, `${id} exists`);
  assert.equal(item.priceToman, price, `${id} MANIFEST price`);
  const shots = productGallery(item);
  assert.equal(shots.length, 3, `${id} gallery has 3 unique angles`);
  assert.ok(shots[0].includes(`${slug}.jpg?v=batch-multi-w3-v4`), `${id} front is batch-multi-w3-v4`);
  assert.ok(shots[1].includes(`${slug}-2.jpg?v=batch-multi-w3-v4`), `${id} angle 2 is batch-multi-w3-v4`);
  assert.ok(shots[2].includes(`${slug}-3.jpg?v=batch-multi-w3-v4`), `${id} angle 3 is batch-multi-w3-v4`);
  assert.doesNotMatch(shots.join(' '), /purple|5c4d91|بنفش/i, `${id} gallery has no purple asset`);
}
assert.ok(getProduct('cat-toys-petopoli-4-way-foldable-cat-play-tunnel'), 'Petopoli tunnel is in catalog');

const batchMultiW4 = [
  ['p280', 'dog-accessories-hannapet-silicone-h-harness-sizr-m', 3_248_000],
  ['p283', 'cat-accessories-hannapet-double-wooden-bowl-stand', 2_130_000],
  ['p289', 'grooming-dog-shedding-brush-hair-release-button', 770_000],
] as const;
for (const [id, slug, price] of batchMultiW4) {
  const item = getProduct(slug) ?? getProduct(id);
  assert.ok(item, `${id} exists`);
  assert.equal(item.priceToman, price, `${id} MANIFEST price`);
  const shots = productGallery(item);
  assert.equal(shots.length, 3, `${id} gallery has 3 unique angles`);
  assert.ok(shots[0].includes(`${slug}.jpg?v=batch-multi-w4-v3`), `${id} front is batch-multi-w4-v3`);
  assert.ok(shots[1].includes(`${slug}-2.jpg?v=batch-multi-w4-v3`), `${id} angle 2 is batch-multi-w4-v3`);
  assert.ok(shots[2].includes(`${slug}-3.jpg?v=batch-multi-w4-v3`), `${id} angle 3 is batch-multi-w4-v3`);
  assert.doesNotMatch(shots.join(' '), /purple|5c4d91|بنفش/i, `${id} gallery has no purple asset`);
}
assert.ok(getProduct('cat-accessories-hannapet-double-wooden-bowl-stand'), 'Hannapet wooden bowl stand is in catalog');

const batchMultiW5 = [
  ['p290', 'grooming-bonnest-calming-shampoo-for-pet-200-l', 680_000],
  ['p293', 'dog-carriers-luxury-leather-space-pet-carier-backpack', 2_795_000],
  ['p299', 'bird-food-oshkaia-mynah-bird-food-kg', 495_000],
] as const;
for (const [id, slug, price] of batchMultiW5) {
  const item = getProduct(slug) ?? getProduct(id);
  assert.ok(item, `${id} exists`);
  assert.equal(item.priceToman, price, `${id} MANIFEST price`);
  const shots = productGallery(item);
  assert.equal(shots.length, 3, `${id} gallery has 3 unique angles`);
  assert.ok(shots[0].includes(`${slug}.jpg?v=batch-multi-w5-v1`), `${id} front is batch-multi-w5-v1`);
  assert.ok(shots[1].includes(`${slug}-2.jpg?v=batch-multi-w5-v1`), `${id} angle 2 is batch-multi-w5-v1`);
  assert.ok(shots[2].includes(`${slug}-3.jpg?v=batch-multi-w5-v1`), `${id} angle 3 is batch-multi-w5-v1`);
  assert.doesNotMatch(shots.join(' '), /purple|5c4d91|بنفش/i, `${id} gallery has no purple asset`);
}
assert.ok(getProduct('grooming-bonnest-calming-shampoo-for-pet-200-l'), 'Bonnest calming shampoo is in catalog');

const digikalaB1P1 = [
  ['p300', 'cat-food-dkp-21263751', 1_549_000],
  ['p302', 'dog-food-dkp-15589693', 186_000],
  ['p309', 'cat-toys-dkp-17412089', 380_000],
] as const;
for (const [id, slug, price] of digikalaB1P1) {
  const item = getProduct(slug) ?? getProduct(id);
  assert.ok(item, `${id} exists`);
  assert.equal(item.priceToman, price, `${id} MANIFEST price`);
  const shots = productGallery(item);
  assert.equal(shots.length, 3, `${id} gallery has 3 unique angles`);
  assert.ok(shots[0].includes(`${slug}.jpg?v=digikala-b1-p1-v1`), `${id} front is digikala-b1-p1-v1`);
  assert.ok(shots[1].includes(`${slug}-2.jpg?v=digikala-b1-p1-v1`), `${id} angle 2 is digikala-b1-p1-v1`);
  assert.ok(shots[2].includes(`${slug}-3.jpg?v=digikala-b1-p1-v1`), `${id} angle 3 is digikala-b1-p1-v1`);
  assert.doesNotMatch(shots.join(' '), /purple|5c4d91|بنفش/i, `${id} gallery has no purple asset`);
}
assert.ok(getProduct('cat-food-dkp-21263751'), 'Digikala Gourmet 6-pack is in catalog');

const digikalaB1P2 = [
  ['p310', 'cat-toys-dkp-5758150', 293_000],
  ['p313', 'grooming-dkp-18631110', 490_000],
  ['p319', 'bird-food-dkp-10253439', 106_000],
] as const;
for (const [id, slug, price] of digikalaB1P2) {
  const item = getProduct(slug) ?? getProduct(id);
  assert.ok(item, `${id} exists`);
  assert.equal(item.priceToman, price, `${id} MANIFEST price`);
  const shots = productGallery(item);
  assert.equal(shots.length, 3, `${id} gallery has 3 unique angles`);
  assert.ok(shots[0].includes(`${slug}.jpg?v=digikala-b1-p2-v1`), `${id} front is digikala-b1-p2-v1`);
  assert.ok(shots[1].includes(`${slug}-2.jpg?v=digikala-b1-p2-v1`), `${id} angle 2 is digikala-b1-p2-v1`);
  assert.ok(shots[2].includes(`${slug}-3.jpg?v=digikala-b1-p2-v1`), `${id} angle 3 is digikala-b1-p2-v1`);
  assert.doesNotMatch(shots.join(' '), /purple|5c4d91|بنفش/i, `${id} gallery has no purple asset`);
}
assert.ok(getProduct('cat-toys-dkp-5758150'), 'Digikala Part2 cat toy SH100 is in catalog');

const digikalaB1P3 = [
  ['p320', 'cat-food-dkp-21258454', 828_000],
  ['p326', 'dog-food-dkp-6236417', 366_700],
  ['p329', 'dog-food-dkp-20949492', 195_000],
] as const;
for (const [id, slug, price] of digikalaB1P3) {
  const item = getProduct(slug) ?? getProduct(id);
  assert.ok(item, `${id} exists`);
  assert.equal(item.priceToman, price, `${id} MANIFEST price`);
  const shots = productGallery(item);
  assert.equal(shots.length, 1, `${id} gallery is front-only (1 real angle)`);
  assert.ok(shots[0].includes(`${slug}.jpg?v=digikala-b1-p3-v1`), `${id} front is digikala-b1-p3-v1`);
  assert.ok(!shots[0].includes('-2.jpg') && !shots[0].includes('-3.jpg'), `${id} no fake angles`);
  assert.doesNotMatch(shots.join(' '), /purple|5c4d91|بنفش/i, `${id} gallery has no purple asset`);
}
assert.ok(getProduct('cat-food-dkp-21258454'), 'Digikala Part3 Yamix kitten pouch is in catalog');

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
      images: [p221.image],
      inStock: true,
      params: { وزن: '۲ کیلوگرم' },
    },
  ],
});
const thinApi = getProduct(p221.slug);
assert.ok(thinApi, 'thin-api p221');
assert.equal(productGallery(thinApi!).length, 3, 'catalog images[] used when list API sends only cover');

console.log('shopGallery.selftest: ok');
