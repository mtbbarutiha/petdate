/**
 * Prove account delete purges pets and clears mergeable identity
 * so re-register (/start → findOrCreateUser) starts with zero pets.
 * Also: payment ledger rows survive; web sessions are purged.
 *
 * Run: cd packages/api && npx tsx src/services/user-delete-cascade.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-user-delete-${process.pid}.db`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { dbService, getDb, getResolvedDatabasePath } = await import('../db');
  getDb();
  const tg = `selftest_del_${Date.now()}`;
  const d = getDb();

  const { user, created } = dbService.findOrCreateUser({
    telegramId: tg,
    name: 'Selftest Delete',
    username: 'selftest_delete',
  });
  assert(created || user.telegramId === tg, 'user must exist');

  const pet = dbService.createPet({
    ownerId: user.id,
    name: 'CascadePup',
    species: 'dog',
    breed: 'mix',
  });
  assert(pet?.id, 'pet must be created');

  // Leave mergeable identity fields that previously survived soft-delete
  d.prepare(
    `UPDATE users SET email = ?, email_verified = 1, phone = ?, phone_verified = 1 WHERE id = ?`
  ).run(`del_${tg}@petdate.test`, '989120000001', user.id);

  const beforePets = dbService.listPets({ ownerId: user.id });
  assert(beforePets.length >= 1, 'precondition: at least one pet');

  const payment = dbService.createPaymentOrder({
    userId: user.id,
    packageId: 'selftest_pack',
    coins: 10,
    amountToman: 1000,
    method: 'card',
    status: 'paid',
    adminNote: 'selftest_ledger',
  });
  assert(payment?.id, 'payment order stub created');

  dbService.createWebSession(
    user.id,
    `selftest_tok_${tg}`,
    new Date(Date.now() + 3600_000).toISOString()
  );

  const ok = dbService.deleteUserByTelegramId(tg);
  assert(ok, 'deleteUserByTelegramId must succeed');

  const gone = dbService.getUserByTelegramId(tg);
  assert(!gone, 'telegram id must be detached');

  const shell = dbService.getUserById(user.id);
  assert(shell, 'anonymized shell row kept for FK history');
  assert(shell.name.startsWith('[حذف‌شده'), 'name anonymized');
  assert(!shell.telegramId, 'telegram cleared');
  assert(!shell.phone, 'phone cleared');
  assert(!shell.email, 'email cleared (prevents merge resurrection)');
  assert(shell.isActive === false, 'inactive');
  assert((shell.coins ?? 0) === 0, 'coins zeroed');

  const sessionCount = (
    d.prepare('SELECT COUNT(*) as c FROM web_sessions WHERE user_id = ?').get(user.id) as {
      c: number;
    }
  ).c;
  assert(sessionCount === 0, 'web sessions purged on delete');

  const paymentAlive = dbService.getPaymentOrder(payment.id);
  assert(paymentAlive, 'payment ledger row kept after soft-delete');
  assert(paymentAlive.userId === user.id, 'payment still points at anonymized shell');

  const afterPets = dbService.listPets({ ownerId: user.id });
  assert(afterPets.length === 0, `pets must be purged, got ${afterPets.length}`);

  // Re-register same telegram → fresh user, zero pets
  const again = dbService.findOrCreateUser({
    telegramId: tg,
    name: 'Selftest Fresh',
  });
  assert(again.created, 're-register must create a new user row');
  assert(again.user.id !== user.id, 'new user id differs from deleted shell');
  const freshPets = dbService.listPets({ ownerId: again.user.id });
  assert(freshPets.length === 0, 'fresh account must have zero pets');

  dbService.deleteUserById(again.user.id);

  console.log(
    `user-delete-cascade.selftest: OK (sqlite=${getResolvedDatabasePath()})`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
