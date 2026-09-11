/**
 * Playmate find/request fee — 2 coins from requester (bot + web parity).
 * Run: cd packages/api && npx tsx src/services/playdate-fee.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-playdate-fee-${process.pid}.db`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const {
    PLAYDATE_FEE_REASON,
    PLAYDATE_REQUEST_COST,
    walletLedgerLabelFa,
  } = await import('@petdate/shared');
  const { dbService, getDb } = await import('../db');
  const {
    chargePlaydateFee,
    insufficientPlaydateFeePayload,
    playdateFeeCost,
    refundPlaydateFee,
  } = await import('./playdate-fee');

  assert(PLAYDATE_REQUEST_COST === 2, 'PLAYDATE_REQUEST_COST is 2');
  assert(playdateFeeCost() === 2, 'playdateFeeCost() is 2');
  assert(walletLedgerLabelFa('هزینه همبازی') === PLAYDATE_FEE_REASON, 'ledger label fa');
  assert(walletLedgerLabelFa('playdate_find') === PLAYDATE_FEE_REASON, 'ledger label find');

  getDb();

  const { user: poor } = dbService.findOrCreateUser({
    telegramId: `playdate_fee_poor_${Date.now()}`,
    name: 'Poor Owner',
  });
  dbService.setUserRoles(poor.id, ['pet_owner']);
  const poorBal = dbService.getUserById(poor.id)?.coins ?? 0;
  if (poorBal > 0) {
    dbService.debitCoins(poor.id, poorBal, { reason: 'selftest_zero', skipLedger: true });
  }
  assert((dbService.getUserById(poor.id)?.coins ?? 0) === 0, 'poor has 0');

  const fail = chargePlaydateFee(poor.id);
  assert(!fail.ok && fail.reason === 'insufficient_coins', 'insufficient fails');
  assert(fail.cost === 2, 'fail cost 2');
  assert(/سکه لازم/.test(fail.error), `persian error: ${fail.error}`);
  assert((dbService.getUserById(poor.id)?.coins ?? 0) === 0, 'no debit on fail');

  const payload = insufficientPlaydateFeePayload(0);
  assert(payload.reason === 'insufficient_coins', 'payload reason');
  assert(payload.cost === 2, 'payload cost');

  const { user: rich } = dbService.findOrCreateUser({
    telegramId: `playdate_fee_rich_${Date.now()}`,
    name: 'Rich Owner',
  });
  dbService.setUserRoles(rich.id, ['pet_owner']);
  dbService.creditCoins(rich.id, 10, undefined, { reason: 'selftest_topup' });
  const before = dbService.getUserById(rich.id)?.coins ?? 0;
  assert(before >= 10, 'rich topped up');

  const ok = chargePlaydateFee(rich.id, { refType: 'playdate_find', refId: 1 });
  assert(ok.ok, 'charge ok');
  assert(ok.cost === 2, 'charged 2');
  const after = dbService.getUserById(rich.id)?.coins ?? 0;
  assert(after === before - 2, `balance ${before} → ${after}`);

  const txs = dbService.listUserWalletTransactions(rich.id, { limit: 20 });
  const debit = txs.find(
    (t) =>
      t.direction === 'debit' &&
      t.currency === 'coins' &&
      (t.labelFa === PLAYDATE_FEE_REASON || t.reason.includes('همبازی'))
  );
  assert(debit, 'ledger has هزینه همبازی debit');
  assert(debit.amount === 2, 'ledger amount 2');

  refundPlaydateFee(rich.id, { refType: 'playdate_find_refund', refId: 1 });
  const refunded = dbService.getUserById(rich.id)?.coins ?? 0;
  assert(refunded === before, 'refund restores balance');

  const petA = dbService.createPet({
    ownerId: rich.id,
    name: 'آلفا',
    species: 'dog',
    lookingForPlaymate: true,
  });
  const { user: peer } = dbService.findOrCreateUser({
    telegramId: `playdate_fee_peer_${Date.now()}`,
    name: 'Peer',
  });
  dbService.setUserRoles(peer.id, ['pet_owner']);
  const petB = dbService.createPet({
    ownerId: peer.id,
    name: 'بتا',
    species: 'dog',
    lookingForPlaymate: true,
  });

  const cur = dbService.getUserById(rich.id)?.coins ?? 0;
  if (cur > 1) {
    dbService.debitCoins(rich.id, cur - 1, { reason: 'selftest_drain', skipLedger: true });
  }
  assert((dbService.getUserById(rich.id)?.coins ?? 0) === 1, 'has 1 coin');

  const blocked = chargePlaydateFee(rich.id);
  assert(!blocked.ok, 'blocked with 1 coin');
  const beforeCreate = dbService.listPlaydateRequests({ userId: rich.id }).length;
  assert(blocked.ok === false, 'no create when fee fails');
  const afterCreate = dbService.listPlaydateRequests({ userId: rich.id }).length;
  assert(afterCreate === beforeCreate, 'no playdate row created');

  dbService.creditCoins(rich.id, 5, undefined, { reason: 'selftest_topup2' });
  const charged = chargePlaydateFee(rich.id, {
    refType: 'playdate_request',
    refId: `${petA.id}->${petB.id}`,
  });
  assert(charged.ok, 'charge for single request');
  const created = dbService.createPlaydateRequest({
    fromPetId: petA.id,
    toPetId: petB.id,
    fromUserId: rich.id,
    toUserId: peer.id,
  });
  assert(created.id > 0, 'playdate created after fee');

  console.log('playdate-fee.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
