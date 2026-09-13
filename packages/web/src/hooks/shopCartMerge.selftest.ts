/**
 * Client cart merge must not let an empty/stale GET /cart wipe in-flight adds.
 * Run: npx tsx src/hooks/shopCartMerge.selftest.ts
 */
import assert from 'node:assert/strict';
import { localCartIsAhead, mergeCartLinesKeepLocal, normalizeClientCartLines } from './shopCartMerge.ts';

assert.deepEqual(normalizeClientCartLines([{ productId: 'p221', qty: 1 }, { productId: 'p221', qty: 2 }]), [
  { productId: 'p221', qty: 3 },
]);
assert.deepEqual(normalizeClientCartLines([{ productId: '', qty: 2 }, { productId: 'p221', qty: 0 }]), []);

assert.deepEqual(
  mergeCartLinesKeepLocal([], [{ productId: 'p221', qty: 2 }]),
  [{ productId: 'p221', qty: 2 }],
  'empty server snapshot must keep local adds'
);
assert.deepEqual(
  mergeCartLinesKeepLocal([{ productId: 'p221', qty: 1 }], [{ productId: 'p222', qty: 1 }]),
  [
    { productId: 'p221', qty: 1 },
    { productId: 'p222', qty: 1 },
  ],
  'boot GET must union in-flight second SKU'
);
assert.deepEqual(
  mergeCartLinesKeepLocal([{ productId: 'p221', qty: 1 }], [{ productId: 'p221', qty: 3 }]),
  [{ productId: 'p221', qty: 3 }],
  'keep the higher local qty while POST is in flight'
);
assert.deepEqual(
  mergeCartLinesKeepLocal([{ productId: 'p221', qty: 2 }], [{ productId: 'p221', qty: 1 }]),
  [{ productId: 'p221', qty: 2 }],
  'server qty wins when it is higher (bot add)'
);

assert.equal(localCartIsAhead([], [{ productId: 'p221', qty: 1 }]), true);
assert.equal(localCartIsAhead([{ productId: 'p221', qty: 1 }], [{ productId: 'p221', qty: 1 }]), false);
assert.equal(localCartIsAhead([{ productId: 'p221', qty: 1 }], [{ productId: 'p221', qty: 2 }]), true);

console.log('shopCartMerge.selftest: ok');
