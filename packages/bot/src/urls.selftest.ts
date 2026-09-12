/**
 * Guard: relative pet photo paths must be absolutized before Telegram sendPhoto.
 * Production log: "invalid file HTTP URL specified: URL host is empty"
 *
 * Run: npx tsx packages/bot/src/urls.selftest.ts
 */
import assert from 'node:assert/strict';
import { resolveTelegramPhotoUrl } from './urls';

function main(): void {
  const prev = {
    PUBLIC_API_URL: process.env.PUBLIC_API_URL,
    API_PUBLIC_URL: process.env.API_PUBLIC_URL,
    PUBLIC_WEB_URL: process.env.PUBLIC_WEB_URL,
    WEB_URL: process.env.WEB_URL,
  };
  process.env.PUBLIC_API_URL = 'https://petdate.ir';
  delete process.env.API_PUBLIC_URL;

  const relative = resolveTelegramPhotoUrl('/api/pets/photos/38/teddy.jpg');
  assert.equal(relative, 'https://petdate.ir/api/pets/photos/38/teddy.jpg');

  const https = resolveTelegramPhotoUrl('https://cdn.example/pet.jpg');
  assert.equal(https, 'https://cdn.example/pet.jpg');

  const fileId = resolveTelegramPhotoUrl('AgACAgQAAxkBAAI');
  assert.equal(fileId, 'AgACAgQAAxkBAAI');

  assert.equal(
    resolveTelegramPhotoUrl('BAACAgQAAxkBAAITestVideoFileIdToken1234567890'),
    null,
    'face-verify video file_id is not a profile photo'
  );
  assert.equal(
    resolveTelegramPhotoUrl('/api/auth/avatar/1/verify.mp4'),
    null,
    'mp4 avatar path is not sent as a photo'
  );

  assert.equal(resolveTelegramPhotoUrl(null), null);
  assert.equal(resolveTelegramPhotoUrl(''), null);
  assert.equal(resolveTelegramPhotoUrl('   '), null);

  // Restore
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }

  console.log('urls.selftest: ok');
}

main();
