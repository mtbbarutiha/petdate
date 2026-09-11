/**
 * Card-to-card coin purchase → same wallet ledger as bot.
 * Run: npx tsx src/services/card2card-wallet.selftest.ts
 */
import assert from 'node:assert/strict';
import { COIN_PACKAGES, findCoinPackage } from '@petdate/shared';
import { dbService } from '../db';

const pkg = findCoinPackage('p50');
assert.ok(pkg, 'p50 package exists');
assert.equal(pkg.coins, 50);
assert.equal(COIN_PACKAGES.length >= 6, true);

const user = dbService.createUser({
  telegramId: `c2c-test-${Date.now()}`,
  name: 'Card2Card Test',
  role: 'pet_owner',
});
assert.ok(user?.id);

const before = dbService.getWallet(user.id)!;
const order = dbService.createPaymentOrder({
  userId: user.id,
  packageId: pkg.id,
  coins: pkg.coins,
  amountToman: pkg.toman,
  amountStars: pkg.stars,
  method: 'card',
  status: 'awaiting_receipt',
});
const attached = dbService.attachPaymentReceipt(order.id, '/api/payments/receipts/1/demo.jpg', {
  transferRef: 'TEST-REF-1',
});
assert.equal(attached.ok, true);
assert.equal(attached.ok && attached.order.status, 'pending');
assert.equal(attached.ok && attached.order.transferRef, 'TEST-REF-1');

const approved = dbService.approveCardPayment(order.id);
assert.equal(approved.ok, true);
const after = dbService.getWallet(user.id)!;
assert.equal(after.coins, before.coins + pkg.coins);

const txs = dbService.listUserWalletTransactions(user.id, { limit: 10 });
assert.ok(
  txs.some((t) => t.refType === 'payment_order' && String(t.refId) === String(order.id)),
  'wallet ledger has payment_order credit'
);

console.log('card2card-wallet.selftest: ok');
