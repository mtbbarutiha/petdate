/**
 * Vet online/offline admission toggle — DB write + idempotent no-op.
 * Run: cd packages/api && npx tsx src/services/vet-online.selftest.ts
 */
// Force local SQLite before importing db (ESM imports hoist otherwise).
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-vet-online-${process.pid}.db`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { dbService, getDb } = await import('../db');
  getDb();
  const tg = `selftest_vet_online_${Date.now()}`;

  const { user } = dbService.findOrCreateUser({
    telegramId: tg,
    name: 'Selftest Vet Online',
    username: 'selftest_vet_online',
  });
  assert(user?.id, 'user must exist');

  // Ensure vet role so product paths accept the toggle.
  const withRole = dbService.setUserRoles(user.id, ['vet']) ?? user;
  assert(withRole, 'set vet role');

  const online = dbService.setVetOnline(user.id, true);
  assert(online, 'go online must succeed');
  assert(online.vetOnline === true, 'vetOnline must be true after go online');

  // Idempotent re-apply must still succeed (no false changes===0 failure).
  const again = dbService.setVetOnline(user.id, true);
  assert(again, 'idempotent online must succeed');
  assert(again.vetOnline === true, 'still online');

  const offline = dbService.setVetOnline(user.id, false);
  assert(offline, 'go offline must succeed');
  assert(offline.vetOnline === false, 'vetOnline must be false after go offline');

  const offlineAgain = dbService.setVetOnline(user.id, false);
  assert(offlineAgain, 'idempotent offline must succeed');
  assert(offlineAgain.vetOnline === false, 'still offline');

  // Cleanup — detach telegram so re-runs stay isolated.
  dbService.deleteUserByTelegramId(tg);
  console.log('vet-online.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
