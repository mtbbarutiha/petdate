/**
 * Selftest: no_pet → pet_owner on first pet + breed catalog seed counts.
 * Run: npx tsx packages/api/src/services/pet-owner-breed-photo.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-owner-breed-${process.pid}.db`;
process.env.SEED_DEMO_DATA = '0';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { dbService, getDb } = await import('../db');
  const { PET_BREEDS_SEED } = await import('@petdate/shared');
  getDb();

  const breedCount = (
    getDb().prepare('SELECT COUNT(*) AS c FROM pet_breeds').get() as { c: number }
  ).c;
  assert(
    breedCount >= PET_BREEDS_SEED.length,
    `expected >= ${PET_BREEDS_SEED.length} breeds, got ${breedCount}`
  );

  const bySpecies = getDb()
    .prepare('SELECT species_code, COUNT(*) AS c FROM pet_breeds GROUP BY species_code')
    .all() as Array<{ species_code: string; c: number }>;
  const map = Object.fromEntries(bySpecies.map((r) => [r.species_code, r.c]));
  assert((map.dog ?? 0) >= 40, `dog breeds ${map.dog}`);
  assert((map.cat ?? 0) >= 20, `cat breeds ${map.cat}`);
  assert((map.bird ?? 0) >= 12, `bird breeds ${map.bird}`);
  assert((map.rabbit ?? 0) >= 8, `rabbit breeds ${map.rabbit}`);
  assert((map.hamster ?? 0) >= 5, `hamster breeds ${map.hamster}`);
  assert((map.other ?? 0) >= 8, `other breeds ${map.other}`);

  const searched = dbService.listBreeds('dog', 'هاسکی');
  assert(searched.length >= 1, 'breed search should find husky');

  const { user } = dbService.findOrCreateUser({
    telegramId: `selftest_no_pet_${Date.now()}`,
    name: 'تست بدون پت',
    username: 'nopet',
  });
  dbService.setUserRoles(user.id, ['no_pet']);
  let u = dbService.getUserById(user.id)!;
  assert(u.roles?.includes('no_pet'), 'should start as no_pet');
  assert(u.role === 'no_pet', 'primary no_pet');

  const breed = dbService.findBreedByName('dog', 'میکس / دورگه');
  assert(!!breed, 'mixed breed exists');

  const pet = dbService.createPet({
    ownerId: u.id,
    name: 'رکس',
    species: 'dog',
    breed: breed!.nameFa,
    imageUrl: `/api/pets/photos/${u.id}/test-uuid.jpg`,
  });
  assert(pet.breed === breed!.nameFa, 'breed stored');
  assert(pet.imageUrl === `/api/pets/photos/${u.id}/test-uuid.jpg`, 'uploaded photo kept');
  assert(pet.photoModerationStatus === 'pending', 'new photo pending');

  u = dbService.getUserById(u.id)!;
  assert(u.roles?.includes('pet_owner'), `roles=${JSON.stringify(u.roles)}`);
  assert(!u.roles?.includes('no_pet'), 'no_pet removed');
  assert(u.role === 'pet_owner', 'primary pet_owner');

  console.log(
    JSON.stringify({
      ok: true,
      breedSeedTotal: PET_BREEDS_SEED.length,
      breedDbTotal: breedCount,
      bySpecies: map,
      roleAfterFirstPet: u.role,
      roles: u.roles,
    })
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
