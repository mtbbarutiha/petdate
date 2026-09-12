/**
 * Card-to-card coin purchase → same wallet ledger as bot + admin finance queue.
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

  // Approve must also requeue stuck rows (not only list).
  getDb()
    .prepare(
      `UPDATE payment_orders SET status = 'awaiting_receipt', receipt_file_id = ? WHERE id = ?`
    )
    .run('/api/payments/receipts/1/demo.jpg', order.id);
  const approved = dbService.approveCardPayment(order.id);
  assert(approved.ok === true, 'approved after stuck requeue');
  const after = dbService.getWallet(user.id)!;
  assert(after.coins === before.coins + pkg.coins, 'wallet credited');

  const txs = dbService.listUserWalletTransactions(user.id, { limit: 10 });
  assert(
    txs.some((t) => t.refType === 'payment_order' && String(t.refId) === String(order.id)),
    'wallet ledger has payment_order credit'
  );

  // --- Bot-originated path: Telegram file_id receipt → same queue + ledger ---
  const { user: botUser } = dbService.findOrCreateUser({
    telegramId: `c2c-bot-${Date.now()}`,
    name: 'Bot Card User',
    username: 'c2c_bot',
  });
  const botBefore = dbService.getWallet(botUser.id)!;
  const botOrder = dbService.createPaymentOrder({
    userId: botUser.id,
    packageId: pkg.id,
    coins: pkg.coins,
    amountToman: pkg.toman,
    amountStars: pkg.stars,
    method: 'card',
    status: 'awaiting_receipt',
  });
  // Synthetic Telegram-like file_id (not a /api/payments/receipts path)
  const tgFileId = 'AgACAgQAAxkBAAIBotReceiptSelftestXYZ0123456789abcdef';
  const botAttached = dbService.attachPaymentReceipt(botOrder.id, tgFileId);
  assert(botAttached.ok === true, 'bot receipt attached');
  assert(botAttached.ok && botAttached.order.status === 'pending', 'bot receipt → pending');
  const botQueue = adminPlatform.listPaymentOrdersAdmin({ status: 'review_queue', limit: 50 });
  assert(
    botQueue.some((o) => o.id === botOrder.id && o.status === 'pending'),
    'bot-originated order in finance review_queue'
  );
  const botApproved = dbService.approveCardPayment(botOrder.id);
  assert(botApproved.ok === true, 'bot order approved');
  const botAfter = dbService.getWallet(botUser.id)!;
  assert(botAfter.coins === botBefore.coins + pkg.coins, 'bot path credits same wallet');
  const botTxs = dbService.listUserWalletTransactions(botUser.id, { limit: 10 });
  assert(
    botTxs.some((t) => t.refType === 'payment_order' && String(t.refId) === String(botOrder.id)),
    'bot path writes same wallet_ledger'
  );

  // --- Cancel parity: awaiting_receipt without receipt can be cancelled ---
  const cancelOrder = dbService.createPaymentOrder({
    userId: botUser.id,
    packageId: pkg.id,
    coins: pkg.coins,
    amountToman: pkg.toman,
    method: 'card',
    status: 'awaiting_receipt',
  });
  assert(dbService.findOpenCoinCardOrder(botUser.id)?.id === cancelOrder.id, 'open order found');
  const cancelled = dbService.cancelAwaitingCardPayment(cancelOrder.id, { userId: botUser.id });
  assert(cancelled.ok === true, 'cancel awaiting_receipt');
  assert(cancelled.ok && cancelled.order.status === 'cancelled', 'status cancelled');
  assert(dbService.findOpenCoinCardOrder(botUser.id) == null, 'no open order after cancel');

  // Pending-with-receipt cannot be user-cancelled
  const pendingOrder = dbService.createPaymentOrder({
    userId: botUser.id,
    packageId: pkg.id,
    coins: pkg.coins,
    amountToman: pkg.toman,
    method: 'card',
    status: 'awaiting_receipt',
  });
  assert(dbService.attachPaymentReceipt(pendingOrder.id, tgFileId + '2').ok, 'attach for cancel-deny');
  const denyCancel = dbService.cancelAwaitingCardPayment(pendingOrder.id, { userId: botUser.id });
  assert(denyCancel.ok === false && denyCancel.reason === 'bad_status', 'cannot cancel pending review');

  console.log('card2card-wallet.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
