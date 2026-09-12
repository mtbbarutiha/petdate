/**
 * مشورت با صاحبین — early refund under 1s + fee split 6/3.
 * Run: cd packages/api && npx tsx src/services/seeker-advice-early-refund.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-seeker-advice-${process.pid}.db`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const {
    SEEKER_ADVICE_COST,
    SEEKER_OWNER_SHARE,
    SEEKER_ADVICE_EARLY_REFUND_MS,
  } = await import('@petdate/shared');
  assert(SEEKER_ADVICE_COST === 6, 'cost 6');
  assert(SEEKER_OWNER_SHARE === 3, 'owner share 3');
  assert(SEEKER_ADVICE_EARLY_REFUND_MS === 1000, 'early refund 1s');

  const { consultFeeSplit, dbService, getDb } = await import('../db');
  getDb();

  const split = consultFeeSplit('seeker_advice');
  assert(split.cost === 6 && split.providerShare === 3, 'split 6/3');
  assert(split.debitReason.includes('مشورت با صاحبین'), 'debit reason label');

  const stamp = Date.now();
  const { user: patient } = dbService.findOrCreateUser({
    telegramId: `selftest_seeker_p_${stamp}`,
    name: 'Seeker',
    username: 'seeker',
  });
  const { user: owner } = dbService.findOrCreateUser({
    telegramId: `selftest_seeker_o_${stamp}`,
    name: 'Owner',
    username: 'owner',
  });
  assert(patient && owner, 'users');

  dbService.setUserRoles(patient.id, ['no_pet']);
  dbService.setUserRoles(owner.id, ['pet_owner']);
  dbService.setAcceptSeekerAdvice(owner.id, true);
  assert(dbService.getUserById(owner.id)?.acceptSeekerAdvice === true, 'opt-in');

  const accepting = dbService.listOwnersAcceptingSeekerAdvice();
  assert(
    accepting.some((u) => u.id === owner.id),
    'owner listed for seeker advice'
  );

  dbService.creditCoins(patient.id, 20, undefined, { reason: 'selftest_topup' });
  const before = dbService.getUserById(patient.id)!.coins ?? 0;

  dbService.debitCoins(patient.id, SEEKER_ADVICE_COST, {
    reason: split.debitReason,
    refType: 'seeker_advice_consult',
  });

  const consult = dbService.createVetConsultation({
    vetUserId: owner.id,
    patientUserId: patient.id,
    notes: 'selftest seeker advice',
    feeCoins: SEEKER_ADVICE_COST,
    serviceKind: 'seeker_advice',
    providerShareCoins: SEEKER_OWNER_SHARE,
    status: 'active',
  });
  assert(consult, 'consult created');

  const paid = dbService.payVetForAcceptedConsult(consult.id);
  assert(paid.paid === true, 'provider paid');
  assert(paid.amount === SEEKER_OWNER_SHARE, 'provider got 3');

  const early = dbService.refundEarlySeekerAdviceIfEligible(consult.id);
  assert(early.refunded === true, 'early refund');
  assert(early.amount === SEEKER_ADVICE_COST, 'refund 6');

  const afterPatient = dbService.getUserById(patient.id)!.coins ?? 0;
  assert(afterPatient === before, 'patient restored');

  const again = dbService.refundEarlySeekerAdviceIfEligible(consult.id);
  assert(again.refunded === false && again.reason === 'already_refunded', 'idempotent');

  const consult2 = dbService.createVetConsultation({
    vetUserId: owner.id,
    patientUserId: patient.id,
    notes: 'selftest late',
    feeCoins: SEEKER_ADVICE_COST,
    serviceKind: 'seeker_advice',
    providerShareCoins: SEEKER_OWNER_SHARE,
    status: 'active',
  });
  dbService.debitCoins(patient.id, SEEKER_ADVICE_COST, {
    reason: split.debitReason,
    refType: 'seeker_advice_consult',
  });
  dbService.payVetForAcceptedConsult(consult2.id);
  const { getDb: gdb } = await import('../db');
  const raw = gdb();
  raw
    .prepare(
      `UPDATE vet_consultations SET vet_paid_at = datetime('now', '-5 seconds') WHERE id = ?`
    )
    .run(consult2.id);
  const late = dbService.refundEarlySeekerAdviceIfEligible(consult2.id);
  assert(late.refunded === false && late.reason === 'too_late', 'too late');

  console.log('seeker-advice-early-refund.selftest: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
