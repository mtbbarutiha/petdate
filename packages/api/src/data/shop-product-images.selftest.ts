/**
 * Shop product images[] / params.__images helpers.
 * Run: npx tsx src/data/shop-product-images.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  parseShopProductImages,
  placeholderGalleryAngles,
  publicShopParams,
  SHOP_IMAGES_PARAM,
  withShopImagesParam,
} from './shop-product-images.ts';

const cover = '/pepito/uploads/royal-canin-mini-adult-2kg.jpg?v=white-v1';
const angles = placeholderGalleryAngles(cover);
assert.equal(angles.length, 3, 'three placeholder angles');
assert.equal(angles[0], cover, 'first angle is the cover URL');
assert.ok(angles[1]!.includes('angle=2'), 'second angle query');
assert.ok(angles[2]!.includes('angle=3'), 'third angle query');
assert.equal(new Set(angles).size, 3, 'placeholder srcs are unique');

const parsed = parseShopProductImages({
  images: angles,
  image: cover,
  params: { وزن: '۲ کیلوگرم', [SHOP_IMAGES_PARAM]: angles.join('|') },
});
assert.deepEqual(parsed, angles, 'dedupes cover + params.__images');

const fromParamOnly = parseShopProductImages({
  params: { [SHOP_IMAGES_PARAM]: `${cover}|${cover}&angle=2` },
  image: cover,
});
assert.equal(fromParamOnly.length, 2, 'param + cover without duplicate cover');

const encoded = withShopImagesParam({ وزن: '۲ کیلوگرم' }, angles);
assert.equal(encoded[SHOP_IMAGES_PARAM], angles.join('|'));
assert.deepEqual(publicShopParams(encoded), { وزن: '۲ کیلوگرم' }, 'strips __images from public params');

console.log('shop-product-images.selftest: ok');
