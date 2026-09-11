/**
 * Card-to-card coin purchase → same wallet ledger as bot.
 * Run: npx tsx src/services/card2card-wallet.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-card2card-${process.pid}.db`;
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'selftest-admin-bootstrap';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { COIN_PACKAGES, findCoinPackage } = await import('@petdate/shared');
  const { dbService, getDb } = await import('../db');
  getDb();

  const pkg = findCoinPackage('p50');
  assert(pkg, 'p50 package exists');
  assert(pkg.coins === 50, 'p50 coins');
  assert(COIN_PACKAGES.length >= 6, 'coin packages present');

  const { user } = dbService.findOrCreateUser({
    telegramId: `c2c-test-${Date.now()}`,
    name: 'Card2Card Test',
    username: 'c2c_test',
  });
  assert(user?.id, 'user created');

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
  assert(attached.ok === true, 'receipt attached');
  assert(attached.ok && attached.order.status === 'pending', 'status pending');
  assert(attached.ok && attached.order.transferRef === 'TEST-REF-1', 'transfer ref saved');

  const { adminPlatform } = await import('../admin-platform');
  const queue = adminPlatform.listPaymentOrdersAdmin({ status: 'review_queue', limit: 20 });
  assert(
    queue.some((o) => o.id === order.id && o.status === 'pending'),
    'order visible in finance review_queue'
  );

  // Stuck row with receipt still on awaiting_receipt must be re-queued on list.
  getDb()
    .prepare(
      `UPDATE payment_orders SET status = 'awaiting_receipt', receipt_file_id = ? WHERE id = ?`
    )
    .run('/api/payments/receipts/1/demo.jpg', order.id);
  const repaired = adminPlatform.listPaymentOrdersAdmin({ status: 'review_queue', limit: 20 });
  assert(
    repaired.some((o) => o.id === order.id && o.status === 'pending'),
    'stuck awaiting_receipt+receipt re-queued'
  );

  const approved = dbService.approveCardPayment(order.id);
  assert(approved.ok === true, 'approved');
  const after = dbService.getWallet(user.id)!;
  assert(after.coins === before.coins + pkg.coins, 'wallet credited');

  const txs = dbService.listUserWalletTransactions(user.id, { limit: 10 });
  assert(
    txs.some((t) => t.refType === 'payment_order' && String(t.refId) === String(order.id)),
    'wallet ledger has payment_order credit'
  );

  console.log('card2card-wallet.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
