/**
 * Run: npx tsx packages/api/src/services/telegram-media.selftest.ts
 */
import {
  looksLikeTelegramFileId,
  petPhotoStorageKeyFromUrl,
  publicImageUrlForStored,
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

console.log('telegram-media.selftest: ok');
