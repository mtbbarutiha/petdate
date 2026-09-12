/**
 * Face-verify submit must not overwrite the profile avatar with the verify clip.
 * Run: npx tsx src/services/face-verify-avatar.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-face-verify-avatar-${process.pid}.db`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
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
  assert(before.avatarUrl === photo, 'approved profile photo stored');

  const submitted = dbService.submitVerification(user.id, videoId);
  assert(submitted.ok, 'verification submitted');
  if (!submitted.ok) return;
  assert(submitted.user.verificationStatus === 'pending', 'pending after submit');
  assert(submitted.user.verificationPhotoFileId === videoId, 'verify clip stored for admin');
  const rawRow = getDb()
    .prepare('SELECT avatar_url, verification_photo_file_id FROM users WHERE id = ?')
    .get(user.id) as { avatar_url: string; verification_photo_file_id: string };
  assert(rawRow.avatar_url === photo, 'db avatar_url unchanged after verify submit');
  assert(rawRow.verification_photo_file_id === videoId, 'db stores verify clip separately');
  assert(
    submitted.user.avatarUrl === photo,
    'profile avatar stays the approved photo after verify submit'
  );
  assert(
    submitted.user.avatarUrl !== videoId,
    'verify video file_id must not become avatar_url'
  );

  const peer = publicFacingAvatarUrl(
    submitted.user.avatarUrl,
    submitted.user.avatarModerationStatus,
    submitted.user.verificationPhotoFileId
  );
  assert(peer === photo, 'peer/chat avatar is the profile photo');
  assert(
    profileAvatarUrl(videoId, { verificationPhotoFileId: videoId }) === undefined,
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
  assert(reused.ok, 'reuse submit ok');
  if (reused.ok) {
    assert(reused.user.avatarUrl === photo, 'reuse existing avatar keeps photo');
    assert(reused.user.verificationPhotoFileId === photo, 'verify ref may equal avatar');
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
  assert(
    mapped.avatarUrl !== videoId,
    'mapUser must not expose verify video as avatar'
  );
  assert(
    !mapped.avatarUrl || !mapped.avatarUrl.includes('BAAC'),
    'stale video avatar stripped for chat/profile'
  );
  assert(mapped.verificationPhotoFileId === videoId, 'admin still has verify clip');

  const dbSrc = readFileSync(join(process.cwd(), 'src/db.ts'), 'utf8');
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
