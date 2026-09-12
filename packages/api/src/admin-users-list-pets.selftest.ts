/**
 * Admin users list joins real pet names from pets.owner_id (never invented).
 * Run: cd packages/api && npx tsx src/admin-users-list-pets.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-admin-users-pets-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { getDb, dbService } = await import('./db');
  const { adminPlatform, batchPetsByOwnerIds } = await import('./admin-platform');
  getDb();

  const stamp = `${process.pid}-${Date.now()}`;
  const { user: owner } = dbService.findOrCreateUser({
    telegramId: `pets-owner-${stamp}`,
    name: `Owner Pets ${stamp}`,
    username: `pets_owner_${stamp}`,
  });
  const { user: empty } = dbService.findOrCreateUser({
    telegramId: `pets-empty-${stamp}`,
    name: `Owner Empty ${stamp}`,
    username: `pets_empty_${stamp}`,
  });
  assert(owner?.id && empty?.id, 'users created');

  const rex = dbService.createPet({
    ownerId: owner.id,
    name: `رکس-${stamp}`,
    species: 'dog',
  });
  const milo = dbService.createPet({
    ownerId: owner.id,
    name: `Milo-${stamp}`,
    species: 'cat',
  });
  assert(rex?.id && milo?.id, 'pets created');

  const listed = adminPlatform.listUsersAdmin({
    q: `Owner Pets ${stamp}`,
    limit: 20,
  });
  const ownerRow = listed.users.find((u) => u.id === owner.id);
  const emptyMiss = listed.users.find((u) => u.id === empty.id);
  assert(ownerRow, 'owner in filtered list');
  assert(!emptyMiss, 'unrelated user not in name filter');
  assert(Array.isArray(ownerRow.pets), 'pets array present');
  assert(ownerRow.pets!.length === 2, `expected 2 real pets, got ${ownerRow.pets!.length}`);
  const names = ownerRow.pets!.map((p) => p.name).sort();
  assert(names.includes(`رکس-${stamp}`), 'dog name from pets table');
  assert(names.includes(`Milo-${stamp}`), 'cat name from pets table');
  assert(
    ownerRow.pets!.every((p) => Number.isFinite(p.id) && p.id > 0 && String(p.name).trim()),
    'pet rows have real ids + non-empty names'
  );

  const emptyList = adminPlatform.listUsersAdmin({
    q: `Owner Empty ${stamp}`,
    limit: 20,
  });
  const emptyRow = emptyList.users.find((u) => u.id === empty.id);
  assert(emptyRow, 'empty owner listed');
  assert(Array.isArray(emptyRow.pets) && emptyRow.pets.length === 0, 'no invented pets');

  const byPet = adminPlatform.listUsersAdmin({ q: `رکس-${stamp}`, limit: 20 });
  assert(
    byPet.users.some((u) => u.id === owner.id),
    'search by pet name finds owner'
  );

  const batch = batchPetsByOwnerIds([owner.id, empty.id, -1]);
  assert(batch.get(owner.id)?.length === 2, 'batch join owner');
  assert(batch.get(empty.id)?.length === 0, 'batch join empty');
  assert(!batch.has(-1), 'invalid owner ids skipped');

  console.log('admin-users-list-pets.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
