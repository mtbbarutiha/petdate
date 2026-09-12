/**
 * Pending pet/owner photos stay in discovery with a placeholder, not a lockout.
 * Run: npx tsx src/services/pending-photo-placeholder.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-pending-photo-${process.pid}.db`;

async function main() {
  const assert = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { sanitizePetPhotosForViewer } = await import('@petdate/shared');
  const { dbService, getDb } = await import('../db');
  getDb();

  const { user: owner } = dbService.findOrCreateUser({
    telegramId: `selftest_pending_photo_${Date.now()}`,
    name: 'صاحب تست',
    username: 'pending_owner',
  });
  dbService.setUserRoles(owner.id, ['pet_owner']);

  const pet = dbService.createPet({
    ownerId: owner.id,
    name: 'رِکس',
    species: 'dog',
    lookingForPlaymate: true,
    imageUrl: 'https://example.com/pending-rex.jpg',
  });
  assert.equal(pet.photoModerationStatus, 'pending', 'new upload is pending');

  const listed = dbService.listPets({ lookingForPlaymate: true, publicOnly: true });
  const found = listed.find((p) => p.id === pet.id);
  assert.ok(found, 'pending-photo pet remains in public discovery');
  assert.equal(found!.imageUrl, pet.imageUrl, 'db row still has the uploaded url');

  const forPeer = sanitizePetPhotosForViewer(found!, owner.id + 99);
  assert.equal(forPeer.imageUrl, undefined, 'peer DTO drops unapproved photo');
  const forOwner = sanitizePetPhotosForViewer(found!, owner.id);
  assert.equal(forOwner.imageUrl, pet.imageUrl, 'owner still sees own upload');

  const nearbySrc = readFileSync(join(process.cwd(), 'src/db.ts'), 'utf8');
  assert.doesNotMatch(
    nearbySrc,
    /listNearbyPets[\s\S]{0,800}photo_moderation_status[\s\S]{0,80}= 'approved'/,
    'nearby listing must not hide pending-photo pets'
  );

  const petsRoute = readFileSync(join(process.cwd(), 'src/routes/pets.ts'), 'utf8');
  assert.match(petsRoute, /sendPhotoPlaceholder/, 'image route serves placeholder');
  assert.match(petsRoute, /petsRouter\.get\('\/placeholder'/, 'placeholder asset route');
  assert.doesNotMatch(
    petsRoute,
    /عکس هنوز تأیید نشده است/,
    'pending photo no longer 403s the image route'
  );

  dbService.setPetPhotoModerationStatus(pet.id, 'approved');
  const approved = dbService.getPet(pet.id)!;
  assert.equal(
    sanitizePetPhotosForViewer(approved, owner.id + 1).imageUrl,
    approved.imageUrl,
    'after approve, peers see the real photo'
  );

  dbService.deleteUserByTelegramId(owner.telegramId!);
  console.log('pending-photo-placeholder.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
