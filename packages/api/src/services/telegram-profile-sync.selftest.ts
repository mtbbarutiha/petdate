/**
 * Lightweight self-test for Telegram profile sync helpers (no bot token required).
 * Run: npx tsx packages/api/src/services/telegram-profile-sync.selftest.ts
 */
import {
  combineTelegramNames,
  extractTelegramFileIdFromAvatar,
  isPlaceholderUserName,
  pickLargestProfilePhotoFileId,
} from './telegram-profile-sync';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

assert(combineTelegramNames('Ali', 'Rezaei') === 'Ali Rezaei', 'combine both');
assert(combineTelegramNames('Sara', '') === 'Sara', 'combine first only');
assert(combineTelegramNames(null, 'Only') === 'Only', 'combine last only');
assert(combineTelegramNames('  ', '  ') === '', 'combine empty');

assert(isPlaceholderUserName(''), 'empty name');
assert(isPlaceholderUserName('کاربر تلگرام'), 'tg placeholder');
assert(isPlaceholderUserName('کاربر petdate'), 'otp placeholder');
assert(isPlaceholderUserName('کاربر Pet Date'), 'brand placeholder');
assert(!isPlaceholderUserName('علی رضایی'), 'real name');
assert(!isPlaceholderUserName('Sara'), 'latin real name');

const fileId = pickLargestProfilePhotoFileId({
  total_count: 1,
  photos: [
    [
      { file_id: 'small', file_unique_id: 'a', width: 160, height: 160 },
      { file_id: 'big', file_unique_id: 'b', width: 640, height: 640 },
    ],
  ],
});
assert(fileId === 'big', 'pick largest photo');
assert(pickLargestProfilePhotoFileId(null) === null, 'null photos');
assert(pickLargestProfilePhotoFileId({ total_count: 0, photos: [] }) === null, 'empty photos');

assert(
  extractTelegramFileIdFromAvatar('AgACAgQAAxkBAAIE1Wqb8sKs09rKsqr92mkenIXVrHc6AAInEGsbPFfgUBLqBMwgVelaAQADAgADeQADPQQ') ===
    'AgACAgQAAxkBAAIE1Wqb8sKs09rKsqr92mkenIXVrHc6AAInEGsbPFfgUBLqBMwgVelaAQADAgADeQADPQQ',
  'raw file_id'
);
assert(
  extractTelegramFileIdFromAvatar(
    '/api/media/telegram/AgACAgQAAxkBAAIE1Wqb8sKs09rKsqr92mkenIXVrHc6AAInEGsbPFfgUBLqBMwgVelaAQADAgADeQADPQQ'
  ) === 'AgACAgQAAxkBAAIE1Wqb8sKs09rKsqr92mkenIXVrHc6AAInEGsbPFfgUBLqBMwgVelaAQADAgADeQADPQQ',
  'mapped media url'
);
assert(extractTelegramFileIdFromAvatar('/api/auth/avatar/38/x.jpg') === null, 'local avatar');

console.log('telegram-profile-sync.selftest: ok');
