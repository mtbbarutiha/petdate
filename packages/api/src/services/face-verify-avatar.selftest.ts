/**
 * Face-verify submit must not overwrite the profile avatar with the verify clip.
 * Run: npx tsx src/services/face-verify-avatar.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-face-verify-avatar-${process.pid}.db`;

async function main() {
  const assert = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { profileAvatarUrl, publicFacingAvatarUrl } = await import('@petdate/shared');
  const { dbService, getDb } = await import('../db');
  getDb();

  const photo = '/api/auth/avatar/9/profile.jpg';
  const videoId = 'BAACAgQAAxkBAAITestVerifyVideoToken1234567890';

  const { user } = dbService.findOrCreateUser({
    telegramId: `selftest_verify_avatar_${Date.now()}`,
    name: 'Faranak',
    username: 'faranak_test',
  });
  dbService.updateUserProfile(user.id, {
    avatarUrl: photo,
    avatarCustom: true,
    avatarModerationStatus: 'approved',
  });
  dbService.setAvatarModerationStatus(user.id, 'approved');

  const before = dbService.getUserById(user.id)!;
  assert.equal(before.avatarUrl, photo, 'approved profile photo stored');

  const submitted = dbService.submitVerification(user.id, videoId);
  assert.ok(submitted.ok, 'verification submitted');
  if (!submitted.ok) return;
  assert.equal(submitted.user.verificationStatus, 'pending', 'pending after submit');
  assert.equal(submitted.user.verificationPhotoFileId, videoId, 'verify clip stored for admin');
  const rawRow = getDb()
    .prepare('SELECT avatar_url, verification_photo_file_id FROM users WHERE id = ?')
    .get(user.id) as { avatar_url: string; verification_photo_file_id: string };
  assert.equal(rawRow.avatar_url, photo, 'db avatar_url unchanged after verify submit');
  assert.equal(rawRow.verification_photo_file_id, videoId, 'db stores verify clip separately');
  assert.equal(
    submitted.user.avatarUrl,
    photo,
    'profile avatar stays the approved photo after verify submit'
  );
  assert.notEqual(
    submitted.user.avatarUrl,
    videoId,
    'verify video file_id must not become avatar_url'
  );

  const peer = publicFacingAvatarUrl(
    submitted.user.avatarUrl,
    submitted.user.avatarModerationStatus,
    submitted.user.verificationPhotoFileId
  );
  assert.equal(peer, photo, 'peer/chat avatar is the profile photo');
  assert.equal(
    profileAvatarUrl(videoId, { verificationPhotoFileId: videoId }),
    undefined,
    'resolver rejects verify video even if a stale row copied it'
  );

  // User who reused the current avatar for verify — photo stays.
  const { user: reuse } = dbService.findOrCreateUser({
    telegramId: `selftest_verify_reuse_${Date.now()}`,
    name: 'Reuse',
    username: 'reuse_avatar',
  });
  dbService.updateUserProfile(reuse.id, {
    avatarUrl: photo,
    avatarCustom: true,
    avatarModerationStatus: 'approved',
  });
  dbService.setAvatarModerationStatus(reuse.id, 'approved');
  const reused = dbService.submitVerification(reuse.id, photo);
  assert.ok(reused.ok, 'reuse submit ok');
  if (reused.ok) {
    assert.equal(reused.user.avatarUrl, photo, 'reuse existing avatar keeps photo');
    assert.equal(reused.user.verificationPhotoFileId, photo, 'verify ref may equal avatar');
  }

  // Stale row: avatar_url already overwritten with a verify video — mapUser hides it.
  const { user: stale } = dbService.findOrCreateUser({
    telegramId: `selftest_verify_stale_${Date.now()}`,
    name: 'Stale',
    username: 'stale_video',
  });
  getDb()
    .prepare(
      `UPDATE users SET avatar_url = ?, verification_photo_file_id = ?,
         avatar_moderation_status = 'approved', verification_status = 'verified'
       WHERE id = ?`
    )
    .run(videoId, videoId, stale.id);
  const mapped = dbService.getUserById(stale.id)!;
  assert.notEqual(mapped.avatarUrl, videoId, 'mapUser must not expose verify video as avatar');
  assert.ok(
    !mapped.avatarUrl || !mapped.avatarUrl.includes('BAAC'),
    'stale video avatar stripped for chat/profile'
  );
  assert.equal(mapped.verificationPhotoFileId, videoId, 'admin still has verify clip');

  const dbSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'db.ts'),
    'utf8'
  );
  assert.match(
    dbSrc,
    /Face-verify media stays on verification_photo_file_id/,
    'submitVerification documents that avatar_url is not overwritten'
  );
  assert.doesNotMatch(
    dbSrc,
    /Keep avatar in sync when submitting profile photo for review/,
    'old copy-to-avatar comment must be gone'
  );

  dbService.deleteUserByTelegramId(user.telegramId!);
  dbService.deleteUserByTelegramId(reuse.telegramId!);
  dbService.deleteUserByTelegramId(stale.telegramId!);
  console.log('face-verify-avatar.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
