/**
 * Selftest: avatars never resolve to face-verify video / non-image clips.
 * Run: npx tsx packages/shared/src/profile-avatar.selftest.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_AVATAR_FEMALE_PATH,
  DEFAULT_AVATAR_MALE_PATH,
  defaultAvatarUrlForGender,
  isGenderDefaultAvatarPath,
  isNonImageAvatarRef,
  profileAvatarUrl,
  publicFacingAvatarUrl,
  resolveProfileDisplayAvatarUrl,
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

assert(
  defaultAvatarUrlForGender('female') === DEFAULT_AVATAR_FEMALE_PATH,
  'female default path'
);
assert(defaultAvatarUrlForGender('male') === DEFAULT_AVATAR_MALE_PATH, 'male default path');
assert(defaultAvatarUrlForGender(undefined) === undefined, 'unknown gender has no custom photo');
assert(defaultAvatarUrlForGender('other') === undefined, 'unrecognized gender stays initials');
assert(isGenderDefaultAvatarPath(DEFAULT_AVATAR_FEMALE_PATH), 'female path is a default');
assert(
  isGenderDefaultAvatarPath(`https://petdate.ir${DEFAULT_AVATAR_MALE_PATH}`),
  'absolute male default still detected'
);
assert(!isGenderDefaultAvatarPath(PHOTO), 'uploaded photo is not a default');

assert(
  resolveProfileDisplayAvatarUrl(PHOTO, { gender: 'female' }) === PHOTO,
  'own uploaded photo beats gender default'
);
assert(
  resolveProfileDisplayAvatarUrl(undefined, { gender: 'female' }) === DEFAULT_AVATAR_FEMALE_PATH,
  'missing photo + female → woman+dog default'
);
assert(
  resolveProfileDisplayAvatarUrl('', { gender: 'male' }) === DEFAULT_AVATAR_MALE_PATH,
  'empty photo + male → man+dog default'
);
assert(
  resolveProfileDisplayAvatarUrl(undefined, { gender: undefined }) === undefined,
  'missing photo + unknown gender keeps initials fallback'
);
assert(
  resolveProfileDisplayAvatarUrl(PHOTO, {
    gender: 'female',
    moderationStatus: 'pending',
    publicFacing: true,
  }) === DEFAULT_AVATAR_FEMALE_PATH,
  'peer view of pending upload uses gender default'
);
assert(
  resolveProfileDisplayAvatarUrl(VIDEO_FILE, {
    gender: 'male',
    verificationPhotoFileId: VIDEO_FILE,
    publicFacing: true,
  }) === DEFAULT_AVATAR_MALE_PATH,
  'verify video is not shown; male default is'
);
assert(
  resolveProfileDisplayAvatarUrl(DEFAULT_AVATAR_FEMALE_PATH) === DEFAULT_AVATAR_FEMALE_PATH,
  'already-resolved female default is kept when gender is omitted'
);

const defaultsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../web/public/images/defaults'
);
for (const file of ['avatar-female.jpg', 'avatar-male.jpg'] as const) {
  const abs = join(defaultsDir, file);
  assert(existsSync(abs), `${file} committed under web/public/images/defaults`);
  const buf = readFileSync(abs);
  assert(buf.length > 20_000, `${file} has real image bytes`);
  assert(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff, `${file} is a JPEG`);
  assert(!/made with ai/i.test(buf.toString('latin1')), `${file} has no Made with AI watermark`);
}

console.log('profile-avatar.selftest: ok');
