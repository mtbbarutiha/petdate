/**
 * Marketplace fee split + credential gates — SQLite selftest.
 * Run: cd packages/api && npx tsx src/services/marketplace-roles.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-marketplace-${process.pid}.db`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { consultFeeSplit, dbService, getDb } = await import('../db');
  getDb();

  const trainerSplit = consultFeeSplit('trainer');
  assert(trainerSplit.cost === 50, 'trainer cost 50');
  assert(trainerSplit.providerShare === 25, 'trainer share 25');
  assert(trainerSplit.systemFee === 25, 'trainer system 25');

  const sitterSplit = consultFeeSplit('sitter');
  assert(sitterSplit.cost === 20 && sitterSplit.providerShare === 10, 'sitter 20/10');

  const seekerSplit = consultFeeSplit('seeker_advice');
  assert(seekerSplit.cost === 10 && seekerSplit.providerShare === 5, 'seeker 10/5');

  const tgPatient = `selftest_mkt_patient_${Date.now()}`;
  const tgTrainer = `selftest_mkt_trainer_${Date.now()}`;

  const { user: patient } = dbService.findOrCreateUser({
    telegramId: tgPatient,
    name: 'Patient',
    username: 'patient',
  });
  const { user: trainer } = dbService.findOrCreateUser({
    telegramId: tgTrainer,
    name: 'Trainer',
    username: 'trainer',
  });
  assert(patient && trainer, 'users');

  dbService.setUserRoles(patient.id, ['pet_owner']);
  dbService.setUserRoles(trainer.id, ['trainer']);
  dbService.creditCoins(patient.id, 100, undefined, { reason: 'selftest_topup' });

  // Trainer cannot go online without verified credential
  assert(dbService.setProviderOnline(trainer.id, 'trainer', true) === null, 'blocked without cred');

  dbService.submitProviderCredential(trainer.id, 'trainer', 'file_x');
  assert(dbService.setProviderOnline(trainer.id, 'trainer', true) === null, 'blocked pending');

  dbService.approveProviderCredential(trainer.id, 'trainer');
  const online = dbService.setProviderOnline(trainer.id, 'trainer', true);
  assert(online?.trainerOnline === true, 'online after verify');

  const archiveTrainer = dbService.listVerifiedProviderCredentials('trainer');
  assert(
    archiveTrainer.some((u) => u.id === trainer.id && u.trainerCredentialFileId === 'file_x'),
    'trainer credential archived after approve'
  );

  const listed = dbService.listOnlineProvidersForQuickConnect('trainer');
  assert(listed.some((u) => u.id === trainer.id), 'listed online');

  const tgVet = `selftest_mkt_vet_${Date.now()}`;
  const { user: vet } = dbService.findOrCreateUser({
    telegramId: tgVet,
    name: 'VetDoc',
    username: 'vetdoc',
  });
  dbService.setUserRoles(vet.id, ['vet']);
  dbService.submitVetCredential(vet.id, 'vet_file_y');
  dbService.approveVetCredential(vet.id);
  const archiveVet = dbService.listVerifiedVetCredentials();
  assert(
    archiveVet.some((u) => u.id === vet.id && u.vetCredentialFileId === 'vet_file_y'),
    'vet credential archived after approve'
  );
  dbService.deleteUserByTelegramId(tgVet);

  // Create consult + pay split
  const consult = dbService.createVetConsultation({
    vetUserId: trainer.id,
    patientUserId: patient.id,
    feeCoins: 50,
    serviceKind: 'trainer',
    providerShareCoins: 25,
  });
  dbService.updateVetConsultationStatus(consult.id, 'active');
  const beforeTrainer = dbService.getUserById(trainer.id)!.coins ?? 0;
  const payout = dbService.payVetForAcceptedConsult(consult.id);
  assert(payout.paid === true, 'paid');
  assert(payout.amount === 25, 'provider gets 25');
  const afterTrainer = dbService.getUserById(trainer.id)!.coins ?? 0;
  assert(afterTrainer === beforeTrainer + 25, 'trainer credited 25 only');

  // Idempotent
  const again = dbService.payVetForAcceptedConsult(consult.id);
  assert(again.alreadyPaid === true, 'idempotent');

  // Photo moderation default pending on new pet with photo
  const pet = dbService.createPet({
    ownerId: patient.id,
    name: 'Rex',
    species: 'dog',
    imageUrl: 'https://example.com/dog.jpg',
  });
  assert(pet.photoModerationStatus === 'pending', 'new photo pending');
  const publicList = dbService.listPets({ publicOnly: true });
  assert(!publicList.some((p) => p.id === pet.id), 'pending hidden from public');
  dbService.setPetPhotoModerationStatus(pet.id, 'approved');
  const public2 = dbService.listPets({ publicOnly: true });
  assert(public2.some((p) => p.id === pet.id), 'approved visible');

  // User avatar moderation
  const tgOwner = `selftest_mkt_owner_${Date.now()}`;
  const { user: owner } = dbService.findOrCreateUser({
    telegramId: tgOwner,
    name: 'Owner',
    username: 'owner',
  });
  dbService.updateUserProfile(owner.id, {
    avatarUrl: '/api/auth/avatar/1/new.jpg',
    avatarCustom: true,
  });
  const pendingOwner = dbService.getUserById(owner.id)!;
  assert(pendingOwner.avatarModerationStatus === 'pending', 'avatar pending after upload');
  assert(
    dbService.listPendingUserAvatars().some((u) => u.id === owner.id),
    'avatar in admin queue'
  );
  dbService.setAvatarModerationStatus(owner.id, 'approved');
  assert(dbService.getUserById(owner.id)!.avatarModerationStatus === 'approved', 'avatar approved');
  dbService.deleteUserByTelegramId(tgOwner);

  dbService.deleteUserByTelegramId(tgPatient);
  dbService.deleteUserByTelegramId(tgTrainer);
  console.log('marketplace-roles.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
