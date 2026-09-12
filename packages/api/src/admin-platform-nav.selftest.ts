/**
 * Platform nav-counts selftest — SQLite temp DB.
 * Run: cd packages/api && npx tsx src/admin-platform-nav.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-platform-nav-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { getDb, dbService } = await import('./db');
  const { adminPlatform } = await import('./admin-platform');
  getDb();

  const before = adminPlatform.getPlatformNavCounts();
  assert(typeof before.users === 'number', 'users count');
  assert(typeof before.pets === 'number', 'pets count');
  assert(typeof before.playdates === 'number', 'playdates count');
  assert(typeof before.consults === 'number', 'consults count');
  assert(typeof before.verification === 'number', 'verification count');
  assert(typeof before.docs === 'number', 'docs count');
  assert(typeof before.payments === 'number', 'payments count');
  assert(typeof before.shopOrders === 'number', 'shopOrders count');

  const { user: owner } = dbService.findOrCreateUser({
    telegramId: `nav-badge-${process.pid}-${Date.now()}`,
    name: 'Nav Badge Owner',
    username: 'nav_badge_owner',
  });
  assert(owner?.id, 'owner created');

  getDb()
    .prepare(
      `UPDATE users SET avatar_moderation_status = 'pending', verification_status = 'pending',
        vet_credential_status = 'pending' WHERE id = ?`
    )
    .run(owner.id);

  const pet = dbService.createPet({
    ownerId: owner.id,
    name: 'NavPet',
    species: 'dog',
    imageUrl: '/x.jpg',
  });
  assert(pet?.id, 'pet created');
  getDb()
    .prepare(`UPDATE pets SET photo_moderation_status = 'pending' WHERE id = ?`)
    .run(pet.id);

  const pkgOrder = dbService.createPaymentOrder({
    userId: owner.id,
    packageId: 'p50',
    coins: 50,
    amountToman: 100_000,
    method: 'card',
    status: 'awaiting_receipt',
  });
  // Simulate stuck receipt (status not flipped) — listPaymentOrdersAdmin must re-queue.
  getDb()
    .prepare(
      `UPDATE payment_orders SET receipt_file_id = ?, status = 'awaiting_receipt' WHERE id = ?`
    )
    .run('/api/payments/receipts/1/stuck.jpg', pkgOrder.id);

  const queued = adminPlatform.listPaymentOrdersAdmin({ status: 'review_queue', limit: 50 });
  assert(
    queued.some((o) => o.id === pkgOrder.id && o.status === 'pending'),
    'stuck receipt re-queued into review_queue as pending'
  );

  const after = adminPlatform.getPlatformNavCounts();
  assert(after.users >= before.users + 1, 'users pending avatar');
  assert(after.pets >= before.pets + 1, 'pets pending photo');
  assert(after.verification >= before.verification + 1, 'verification pending');
  assert(after.docs >= before.docs + 2, 'docs includes credential + photo/avatar');
  assert(after.payments >= before.payments + 1, 'payments queue badge');

  console.log('admin-platform-nav.selftest: ok', after);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
