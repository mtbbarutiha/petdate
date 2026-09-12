/**
 * Selftest: peer public DTO never leaks Telegram id / @username / phone.
 * Run: npx tsx packages/shared/src/peer-profile.selftest.ts
 */
import { DEFAULT_AVATAR_FEMALE_PATH } from './profile-avatar';
import {
  buildPeerOwnerSummaryLines,
  formatPeerOwnerProfileHtml,
  peerDtoHasSensitiveLeak,
  toPeerPublicUser,
} from './peer-profile';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const raw = {
  id: 42,
  name: 'سارا',
  telegramId: '123456789',
  username: 'sara_secret',
  phone: '09121234567',
  phoneVerified: true,
  email: 'sara@example.com',
  age: 28,
  gender: 'female' as const,
  city: 'تهران',
  province: 'تهران',
  country: 'ایران',
  bio: 'عاشق پیاده‌روی با پت',
  interests: ['🐾 همبازی پت', '🚶 پیاده‌روی'],
  verificationStatus: 'verified' as const,
  avatarUrl: '/api/auth/avatar/42/x.jpg',
  role: 'pet_owner' as const,
  roles: ['pet_owner' as const],
  lat: 35.7,
  lng: 51.4,
  coins: 999,
  walletStars: 50,
};

const peer = toPeerPublicUser(raw);
assert(peer.name === 'سارا', 'keeps display name');
assert(peer.publicId === 'PD-U00042', 'public id derived');
assert(peer.age === 28, 'keeps age');
assert(peer.city === 'تهران', 'keeps city');
assert(peer.interests?.length === 2, 'keeps interests');
assert(peer.verificationStatus === 'verified', 'keeps verification');
assert(peer.avatarUrl === '/api/auth/avatar/42/x.jpg', 'keeps approved still photo');

const videoPeer = toPeerPublicUser({
  ...raw,
  avatarUrl: 'BAACAgQAAxkBAAITestVideoFileIdToken1234567890',
  verificationPhotoFileId: 'BAACAgQAAxkBAAITestVideoFileIdToken1234567890',
  avatarModerationStatus: 'approved',
});
assert(
  videoPeer.avatarUrl === DEFAULT_AVATAR_FEMALE_PATH,
  'peer DTO replaces face-verify video with gender default'
);

const pendingPeer = toPeerPublicUser({
  ...raw,
  avatarUrl: '/api/auth/avatar/42/new.jpg',
  avatarModerationStatus: 'pending',
});
assert(
  pendingPeer.avatarUrl === DEFAULT_AVATAR_FEMALE_PATH,
  'pending profile photo hidden; female default shown to peers'
);

const noGenderPeer = toPeerPublicUser({
  ...raw,
  gender: undefined,
  avatarUrl: undefined,
});
assert(!noGenderPeer.avatarUrl, 'unknown gender keeps existing empty/initials fallback');
assert(!('telegramId' in peer), 'no telegramId key');
assert(!('username' in peer), 'no username key');
assert(!('phone' in peer), 'no phone key');
assert(!('email' in peer), 'no email key');
assert(!('lat' in peer), 'no lat key');
assert(!('coins' in peer), 'no coins key');
assert(!peerDtoHasSensitiveLeak(peer), 'peer DTO clean');
assert(peerDtoHasSensitiveLeak(raw), 'raw still sensitive');

const html = formatPeerOwnerProfileHtml(raw, { heading: '👤 <b>پروفایل صاحب پت</b>' });
assert(html.includes('سارا'), 'html has name');
assert(html.includes('شناسه کاربر/صاحب پت'), 'html labels owner id');
assert(html.includes('PD-U00042'), 'html has public id');
assert(!html.includes('/u00042'), 'html does not show command id as آیدی');
assert(html.includes('تهران'), 'html has city');
assert(!html.includes('123456789'), 'html hides telegram id');
assert(!html.includes('sara_secret'), 'html hides username');
assert(!html.includes('09121234567'), 'html hides phone');
assert(!html.includes('@'), 'html has no @username');

const lines = buildPeerOwnerSummaryLines(raw);
assert(lines.name === 'سارا', 'summary name');
assert(lines.publicId === 'PD-U00042', 'summary public id');
assert(lines.commandId === '/u00042', 'summary keeps command id for deep-link');
assert(!lines.bio || lines.bio.includes('عاشق'), 'summary bio');

console.log('peer-profile.selftest: ok');
