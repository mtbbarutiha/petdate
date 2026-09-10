/**
 * Admin pets owner spend / VIP / last-event / filters selftest.
 * Run: cd packages/api && npx tsx src/admin-pets-owner-spend.selftest.ts
 * Or: npm run test:self:admin-pets
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-admin-pets-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.ADMIN_SEED_PASSWORD = 'petdate-seed';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { getDb, dbService } = await import('./db');
  const { adminPlatform } = await import('./admin-platform');
  const {
    ADMIN_PETS_VIP_THRESHOLD_TOMAN,
    orderAmountToToman,
    consultFeeToToman,
    listAdminPets,
    batchOwnerSpendToman6m,
    parseAdminPetsFilterDate,
  } = await import('./admin-pets');
  const { COIN_PRICE_TOMAN } = await import('@petdate/shared');

  getDb();

  // --- unit: currency conversion ---
  assert(orderAmountToToman(1_000_000, 'toman') === 1_000_000, 'toman as-is');
  assert(orderAmountToToman(1_000_000, 'IRT') === 1_000_000, 'IRT as-is');
  assert(orderAmountToToman(10_000_000, 'rial') === 1_000_000, 'rial /10');
  assert(orderAmountToToman(10_000_000, 'IRR') === 1_000_000, 'IRR /10');
  assert(consultFeeToToman(5) === 5 * COIN_PRICE_TOMAN, 'consult coins → toman');
  assert(COIN_PRICE_TOMAN === 2000, 'COIN_PRICE_TOMAN is 2000');

  // --- date parse (Gregorian + Jalali) ---
  const g = parseAdminPetsFilterDate('2026-03-01', 'start');
  assert(g?.startsWith('2026-03-01'), 'gregorian start');
  const j = parseAdminPetsFilterDate('1404/12/10', 'start');
  assert(j, 'jalali slash parsed');

  const owner = dbService.findOrCreateWebUser({
    phone: '09121112233',
    name: 'مالک تست ویژه',
  });
  const vet = dbService.findOrCreateUser({
    telegramId: `vet_pets_${process.pid}`,
    name: 'Vet Selftest',
  }).user;

  const pet = dbService.createPet({
    ownerId: owner.id,
    name: 'ریکس تست',
    species: 'dog',
    breed: 'شیتزو',
    city: 'تهران',
  });

  // Shop: 40M toman + 200M rial (=20M toman) = 60M toman → VIP
  adminPlatform.createShopOrder({
    userId: owner.id,
    status: 'paid',
    totalToman: 40_000_000,
    paymentCurrency: 'toman',
    items: [{ id: 'p1', qty: 1 }],
  });
  adminPlatform.createShopOrder({
    userId: owner.id,
    status: 'completed',
    totalToman: 200_000_000,
    paymentCurrency: 'rial',
    items: [{ id: 'p2', qty: 1 }],
  });
  // pending should not count
  adminPlatform.createShopOrder({
    userId: owner.id,
    status: 'pending',
    totalToman: 99_000_000,
    paymentCurrency: 'toman',
    items: [],
  });

  // Consult: 10 coins * 2000 = 20_000 toman
  dbService.createVetConsultation({
    vetUserId: vet.id,
    patientUserId: owner.id,
    petId: pet.id,
    status: 'completed',
    feeCoins: 10,
    notes: 'ویزیت تست',
  });

  const spendMap = batchOwnerSpendToman6m([owner.id]);
  const spend = spendMap.get(owner.id) || 0;
  assert(spend === 40_000_000 + 20_000_000 + 20_000, `spend expected 60_020_000 got ${spend}`);
  assert(spend > ADMIN_PETS_VIP_THRESHOLD_TOMAN, 'vip threshold');

  const listed = listAdminPets({ ownerName: 'ویژه' });
  assert(listed.pets.length >= 1, 'ownerName filter');
  const row = listed.pets.find((p) => p.id === pet.id);
  assert(row, 'pet in list');
  assert(row!.vipOwner === true, 'vipOwner true');
  assert(row!.spendToman6m === spend, 'list spend matches');
  assert(row!.ownerPhone?.includes('0912') || row!.ownerPhone?.includes('912'), 'owner phone');
  assert(row!.ownerPublicId, 'owner public id');
  assert(row!.lastEvent, 'lastEvent present');
  assert(
    row!.lastEvent!.kind === 'purchase' || row!.lastEvent!.kind === 'service',
    'lastEvent kind'
  );

  const byPhone = listAdminPets({ ownerPhone: '09121112233' });
  assert(byPhone.pets.some((p) => p.id === pet.id), 'ownerPhone filter');

  const today = new Date().toISOString().slice(0, 10);
  const byDate = listAdminPets({ lastEventFrom: today, lastEventTo: today });
  assert(byDate.pets.some((p) => p.id === pet.id), 'lastEvent date filter');

  const noMatch = listAdminPets({ ownerName: 'ناموجودzzzz' });
  assert(!noMatch.pets.some((p) => p.id === pet.id), 'ownerName miss');

  console.log('admin-pets-owner-spend.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
