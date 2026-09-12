/**
 * Face-verify approve credits 100 coins once; re-approve does not double-grant.
 * Run: npx tsx packages/api/src/face-verify-approve.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-face-verify-${process.pid}.db`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { dbService, getDb } = await import('./db');
  const { COIN_REASON, FACE_VERIFY_REWARD } = await import('@petdate/shared');
  getDb();

  assert(FACE_VERIFY_REWARD === 100, 'FACE_VERIFY_REWARD is 100');

  const tg = `selftest_face_${process.pid}_${Date.now()}`;
  const { user } = dbService.findOrCreateUser({
    telegramId: tg,
    name: 'Face User',
    username: 'faceuser',
  });
  assert(user, 'user created');
  const startCoins = Number(user.coins) || 0;

  const submitted = dbService.submitVerification(user.id, 'selfie_file_id');
  assert(submitted.ok, 'submit verification');
  assert(submitted.user?.verificationStatus === 'pending', 'pending after submit');

  const approved = dbService.approveVerification(user.id, FACE_VERIFY_REWARD);
  assert(approved, 'approve returns user');
  assert(approved.verificationStatus === 'verified', 'verified');
  assert(Number(approved.coins) === startCoins + FACE_VERIFY_REWARD, 'credited 100');
  assert(
    approved.awardedRewards?.some((a) => a.reason === COIN_REASON.faceVerify && a.amount === 100),
    'awardedRewards face_verify 100'
  );

  const again = dbService.approveVerification(user.id, FACE_VERIFY_REWARD);
  assert(again === null, 're-approve while verified is rejected');
  const after = dbService.getUserById(user.id);
  assert(Number(after?.coins) === startCoins + FACE_VERIFY_REWARD, 'no double credit');

  const once = dbService.creditCoinsOnce(user.id, FACE_VERIFY_REWARD, COIN_REASON.faceVerify);
  assert(once.awarded === false, 'creditCoinsOnce face_verify is idempotent');
  assert(Number(once.user?.coins) === startCoins + FACE_VERIFY_REWARD, 'balance unchanged');

  const other = dbService.findOrCreateUser({
    telegramId: `${tg}_admin`,
    name: 'Admin Flip',
    username: 'adminflip',
  }).user;
  assert(other, 'second user');
  const otherStart = Number(other.coins) || 0;
  dbService.submitVerification(other.id, 'selfie_b');
  const viaAdmin = dbService.setVerificationStatusAdmin(other.id, 'verified');
  assert(viaAdmin?.verificationStatus === 'verified', 'admin override verifies');
  assert(Number(viaAdmin?.coins) === otherStart + FACE_VERIFY_REWARD, 'admin override credits once');
  const viaAdminAgain = dbService.setVerificationStatusAdmin(other.id, 'verified');
  assert(Number(viaAdminAgain?.coins) === otherStart + FACE_VERIFY_REWARD, 'admin re-set no extra coins');

  dbService.deleteUserByTelegramId(tg);
  dbService.deleteUserByTelegramId(`${tg}_admin`);
  console.log('face-verify-approve.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
