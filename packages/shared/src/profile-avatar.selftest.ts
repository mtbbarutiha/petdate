/**
 * Selftest: avatars never resolve to face-verify video / non-image clips.
 * Run: npx tsx packages/shared/src/profile-avatar.selftest.ts
 */
import {
  isNonImageAvatarRef,
  profileAvatarUrl,
  publicFacingAvatarUrl,
} from './profile-avatar';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const PHOTO = '/api/auth/avatar/42/face.jpg';
const VIDEO_FILE = 'BAACAgQAAxkBAAITestVideoFileIdToken1234567890';
const VIDEO_NOTE = 'DQACAgQAAxkBAAITestVideoNoteToken1234567890';
const VIDEO_PATH = '/api/auth/avatar/42/verify.mp4';
const PROXY_VIDEO = `/api/media/telegram/${encodeURIComponent(VIDEO_FILE)}`;
const TG_PHOTO = 'AgACAgQAAxkBAAITestPhotoFileIdToken1234567890';

assert(!isNonImageAvatarRef(PHOTO), 'jpg path is an image');
assert(!isNonImageAvatarRef(TG_PHOTO), 'Telegram photo file_id is an image');
assert(isNonImageAvatarRef(VIDEO_FILE), 'BAAC is video');
assert(isNonImageAvatarRef(VIDEO_NOTE), 'DQAC is video note');
assert(isNonImageAvatarRef(VIDEO_PATH), 'mp4 path is video');
assert(isNonImageAvatarRef(PROXY_VIDEO), 'media proxy wrapping video file_id');
assert(!isNonImageAvatarRef(''), 'empty is not a non-image ref');

assert(profileAvatarUrl(PHOTO) === PHOTO, 'approved still photo kept');
assert(profileAvatarUrl(TG_PHOTO) === TG_PHOTO, 'telegram still photo kept');
assert(profileAvatarUrl(VIDEO_FILE) === undefined, 'video file_id dropped');
assert(profileAvatarUrl(VIDEO_PATH) === undefined, 'mp4 avatar dropped');
assert(
  profileAvatarUrl(PHOTO, { verificationPhotoFileId: PHOTO }) === PHOTO,
  'reusing current profile photo for verify still shows the photo'
);
assert(
  profileAvatarUrl(VIDEO_FILE, { verificationPhotoFileId: VIDEO_FILE }) === undefined,
  'verify video copied onto avatar_url is dropped'
);

assert(
  publicFacingAvatarUrl(PHOTO, 'approved') === PHOTO,
  'public approved photo passes'
);
assert(
  publicFacingAvatarUrl(PHOTO, 'pending') === undefined,
  'pending profile photo still uses placeholder (#328)'
);
assert(
  publicFacingAvatarUrl(VIDEO_FILE, 'approved') === undefined,
  'approved-status video still never public'
);
assert(
  publicFacingAvatarUrl(VIDEO_PATH, 'pending', VIDEO_PATH) === undefined,
  'pending verify clip is not a public avatar'
);

console.log('profile-avatar.selftest: ok');
