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
  // Relative import so local worktrees don't resolve a stale /agent @petdate/shared.
  const { COIN_PACKAGES, findCoinPackage } = await import('../../../shared/src/economy');
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
