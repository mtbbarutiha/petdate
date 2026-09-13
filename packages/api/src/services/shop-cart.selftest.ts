/**
 * Shop cart merge helpers — single source of truth for web ↔ bot.
 * Run: npx tsx src/services/shop-cart.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  cartItemCount,
  mergeCartLines,
  normalizeCartLines,
  requestHasShopCartUserRemoveIntent,
  SHOP_CART_USER_REMOVE_INTENT,
} from './shop-cart.ts';

assert.deepEqual(normalizeCartLines(null), []);
assert.deepEqual(normalizeCartLines([{ productId: 'p1', qty: 2 }, { productId: 'p1', qty: 3 }]), [
  { productId: 'p1', qty: 5 },
]);
assert.deepEqual(normalizeCartLines([{ productId: 'x', qty: 0 }, { productId: '', qty: 2 }]), []);

const merged = mergeCartLines(
  [
    { productId: 'a', qty: 1 },
    { productId: 'b', qty: 2 },
  ],
  [
    { productId: 'b', qty: 3 },
    { productId: 'c', qty: 1 },
  ]
);
assert.equal(cartItemCount(merged), 7);
assert.deepEqual(
  merged.sort((x, y) => x.productId.localeCompare(y.productId)),
  [
    { productId: 'a', qty: 1 },
    { productId: 'b', qty: 5 },
    { productId: 'c', qty: 1 },
  ]
);

/** Sync rule used by web login + API /cart/merge */
assert.equal(cartItemCount(mergeCartLines([], [{ productId: 'g', qty: 2 }])), 2);
assert.equal(cartItemCount(mergeCartLines([{ productId: 'g', qty: 1 }], [])), 1);

assert.equal(SHOP_CART_USER_REMOVE_INTENT, 'user-remove');
assert.equal(
  requestHasShopCartUserRemoveIntent({
    headers: { 'x-petdate-cart-intent': 'user-remove' },
  }),
  true
);
assert.equal(
  requestHasShopCartUserRemoveIntent({
    body: { intent: 'user-remove', productId: 'p243' },
  }),
  true
);
assert.equal(requestHasShopCartUserRemoveIntent({ headers: {}, body: {} }), false);
assert.equal(
  requestHasShopCartUserRemoveIntent({
    headers: { 'x-petdate-cart-intent': 'prune' },
  }),
  false
);

console.log('shop-cart.selftest: ok (merge-then-persist)');
