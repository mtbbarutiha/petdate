/**
 * Replacing a custom profile photo costs 100 coins and clears face verification.
 * First upload stays free. Run: npx tsx packages/api/src/profile-photo-change.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-photo-change-${process.pid}.db`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { dbService, getDb } = await import('./db');
  const {
    FACE_VERIFY_REWARD,
    PROFILE_PHOTO_CHANGE_COST,
    PROFILE_PHOTO_CHANGE_FEE_REASON,
  } = await import('@petdate/shared');
  getDb();

  assert(PROFILE_PHOTO_CHANGE_COST === 100, 'change cost is 100');
  assert(PROFILE_PHOTO_CHANGE_COST === FACE_VERIFY_REWARD, 'fee matches verify reward');

  const tg = `selftest_photo_${process.pid}_${Date.now()}`;
  const { user } = dbService.findOrCreateUser({
    telegramId: tg,
    name: 'Photo User',
    username: 'photouser',
  });
  assert(user, 'user created');

  dbService.creditCoins(user.id, 200, undefined, {
    reason: 'selftest_photo_fund',
    skipLedger: true,
  });
  const funded = dbService.getUserById(user.id)!;
  const startCoins = Number(funded.coins) || 0;
  assert(startCoins >= 200, 'funded');

  const first = dbService.commitUserProfileChange(user.id, {
    avatarUrl: '/api/auth/avatar/1/first.jpg',
    avatarCustom: true,
  });
  assert(first.ok, 'first photo ok');
  assert(first.charged === 0, 'first photo is free');
  assert(first.verificationReset === false, 'first photo does not reset verify');
  assert(first.user.avatarUrl === '/api/auth/avatar/1/first.jpg', 'first url stored');
  assert(Number(first.user.coins) >= startCoins, 'first photo does not debit');

  const submitted = dbService.submitVerification(user.id, 'selfie_file_id');
  assert(submitted.ok, 'submit verify');
  const approved = dbService.approveVerification(user.id, FACE_VERIFY_REWARD);
  assert(approved?.verificationStatus === 'verified', 'verified');
  const afterVerify = Number(approved?.coins) || 0;

  const rematerialize = dbService.updateUserProfile(user.id, {
    avatarUrl: '/api/auth/avatar/1/first-materialized.jpg',
    avatarCustom: true,
    avatarModerationStatus: 'approved',
  });
  assert(rematerialize?.avatarUrl === '/api/auth/avatar/1/first-materialized.jpg', 'rematerialize url');
  assert(rematerialize?.verificationStatus === 'verified', 'rematerialize keeps verify');
  assert(Number(rematerialize?.coins) === afterVerify, 'rematerialize does not debit');

  const changed = dbService.commitUserProfileChange(user.id, {
    avatarUrl: '/api/auth/avatar/1/second.jpg',
    avatarCustom: true,
  });
  assert(changed.ok, 'replacement ok');
  assert(changed.charged === PROFILE_PHOTO_CHANGE_COST, 'replacement charges 100');
  assert(changed.verificationReset === true, 'replacement resets verify');
  assert(changed.user.verificationStatus === 'none', 'left face-verify state');
  assert(!changed.user.verificationPhotoFileId, 'verify selfie cleared');
  assert(!changed.user.verifiedAt, 'verifiedAt cleared');
  assert(changed.user.avatarUrl === '/api/auth/avatar/1/second.jpg', 'new photo stored');
  assert(
    Number(changed.user.coins) === afterVerify - PROFILE_PHOTO_CHANGE_COST,
    '100 coins deducted'
  );

  const txs = dbService.listUserWalletTransactions(user.id, { limit: 20 });
  assert(
    txs.some((t) => t.direction === 'debit' && t.reason.includes('تعویض عکس')),
    'ledger records photo change fee'
  );
  void PROFILE_PHOTO_CHANGE_FEE_REASON;

  dbService.debitCoins(user.id, Number(changed.user.coins), {
    reason: 'selftest_drain',
    skipLedger: true,
  });
  const broke = dbService.getUserById(user.id)!;
  assert((Number(broke.coins) || 0) < PROFILE_PHOTO_CHANGE_COST, 'drained');

  const fail = dbService.commitUserProfileChange(user.id, {
    avatarUrl: '/api/auth/avatar/1/third.jpg',
    avatarCustom: true,
  });
  assert(!fail.ok && fail.reason === 'insufficient_coins', 'poor user cannot replace');
  const afterFail = dbService.getUserById(user.id)!;
  assert(afterFail.avatarUrl === '/api/auth/avatar/1/second.jpg', 'photo unchanged on fail');
  assert(afterFail.verificationStatus === 'none', 'verify stays none after fail');

  dbService.deleteUserByTelegramId(tg);
  console.log('profile-photo-change.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
