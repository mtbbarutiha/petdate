/**
 * Face verification requires a custom profile photo before accepting media.
 * Run: npx tsx packages/api/src/face-verify-profile-photo.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-face-verify-photo-${process.pid}.db`;

async function main() {
  const assert = await import('node:assert/strict');
  const { dbService, getDb } = await import('./db');
  getDb();

  const { user } = dbService.findOrCreateUser({
    telegramId: `selftest_verify_nophoto_${Date.now()}`,
    name: 'NoPhoto',
    username: 'nophoto',
  });
  const blocked = dbService.submitVerification(user.id, 'BAACAgQAAxkBAAITestVideo');
  assert.equal(blocked.ok, false, 'blocked without profile photo');
  if (!blocked.ok) {
    assert.equal(blocked.reason, 'no_profile_photo');
  }

  const photo = '/api/auth/avatar/7/face.jpg';
  dbService.updateUserProfile(user.id, {
    avatarUrl: photo,
    avatarCustom: true,
    avatarModerationStatus: 'approved',
  });
  dbService.setAvatarModerationStatus(user.id, 'approved');

  const ok = dbService.submitVerification(user.id, 'BAACAgQAAxkBAAITestVideo2');
  assert.ok(ok.ok, 'allowed when profile photo exists');
  if (ok.ok) {
    assert.equal(ok.user.verificationStatus, 'pending');
    assert.equal(ok.user.verificationPhotoFileId, 'BAACAgQAAxkBAAITestVideo2');
    assert.equal(ok.user.avatarUrl, photo, 'avatar unchanged');
  }

  console.log('face-verify-profile-photo.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
