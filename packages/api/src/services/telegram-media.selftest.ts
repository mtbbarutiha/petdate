/**
 * Run: npx tsx packages/api/src/services/telegram-media.selftest.ts
 */
import {
  looksLikeTelegramFileId,
  petPhotoStorageKeyFromUrl,
  publicImageUrlForStored,
  sniffTelegramMediaContentType,
} from './telegram-media';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(looksLikeTelegramFileId('AgACAgQAAxkBAAITestFileIdToken1234567890'), 'AgAC file_id');
assert(!looksLikeTelegramFileId('/api/pets/photos/1/a.jpg'), 'relative path not file_id');
assert(!looksLikeTelegramFileId('https://petdate.ir/x.jpg'), 'https not file_id');
assert(!looksLikeTelegramFileId(''), 'empty not file_id');

assert(
  publicImageUrlForStored('/api/pets/photos/38/a.jpg') === '/api/pets/photos/38/a.jpg',
  'keep local path'
);
assert(
  publicImageUrlForStored('AgACAgQAAxkBAAITestFileIdToken1234567890', { petId: 37 }) ===
    '/api/pets/37/image',
  'rewrite file_id to pet image proxy'
);
assert(
  publicImageUrlForStored('AgACAgQAAxkBAAITestFileIdToken1234567890') ===
    '/api/media/telegram/AgACAgQAAxkBAAITestFileIdToken1234567890',
  'rewrite file_id to media proxy without petId'
);

assert(
  petPhotoStorageKeyFromUrl('/api/pets/photos/38/1b686ee8-1327-4e30-b8e1-287ea5f16d29.jpg') ===
    '38/1b686ee8-1327-4e30-b8e1-287ea5f16d29.jpg',
  'storage key parse'
);
assert(petPhotoStorageKeyFromUrl('/api/pets/37/image') === null, 'proxy path not storage key');

// JPEG magic
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
assert(sniffTelegramMediaContentType(jpeg, 'application/octet-stream') === 'image/jpeg', 'jpeg sniff');

// PNG magic
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
assert(sniffTelegramMediaContentType(png) === 'image/png', 'png sniff');

// MP4 ftyp — must NOT become image/jpeg (admin KYC video bug)
const mp4 = Buffer.alloc(12);
mp4.writeUInt32BE(0x18, 0);
mp4.write('ftyp', 4, 'ascii');
mp4.write('isom', 8, 'ascii');
assert(sniffTelegramMediaContentType(mp4, 'application/octet-stream', 'clip.mp4') === 'video/mp4', 'mp4 sniff');
assert(sniffTelegramMediaContentType(mp4, 'video/mp4') === 'video/mp4', 'mp4 declared');

// QuickTime / mov brand
const mov = Buffer.alloc(12);
mov.writeUInt32BE(0x18, 0);
mov.write('ftyp', 4, 'ascii');
mov.write('qt  ', 8, 'ascii');
assert(sniffTelegramMediaContentType(mov, 'application/octet-stream', 'clip.mov') === 'video/quicktime', 'mov sniff');

// WebM EBML
const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]);
assert(sniffTelegramMediaContentType(webm) === 'video/webm', 'webm sniff');

console.log('telegram-media.selftest: ok');
