/**
 * Admin KYC queue must play verification *videos* (not force <img>),
 * and load bytes via authenticated endpoint (blob URL like receipts).
 * Run: npx tsx packages/web/src/admin/pages/adminVerificationMedia.selftest.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = fs.readFileSync(path.join(here, 'AdminVerificationPage.tsx'), 'utf8');
const usersRoutes = fs.readFileSync(
  path.resolve(here, '../../../../api/src/routes/users.ts'),
  'utf8'
);
const mediaRoutes = fs.readFileSync(
  path.resolve(here, '../../../../api/src/routes/media.ts'),
  'utf8'
);
const telegramMedia = fs.readFileSync(
  path.resolve(here, '../../../../api/src/services/telegram-media.ts'),
  'utf8'
);
const botVerification = fs.readFileSync(
  path.resolve(here, '../../../../bot/src/handlers/verification.ts'),
  'utf8'
);

assert.match(page, /AdminVerificationMedia/, 'media component present');
assert.match(page, /<video[\s\S]*controls/, 'renders video player with controls');
assert.match(
  page,
  /\/api\/users\/\$\{user\.id\}\/verification\/media/,
  'loads KYC media via authenticated admin endpoint'
);
assert.match(page, /createObjectURL/, 'uses blob URL like receipts');
assert.match(page, /isVerificationVideoRef/, 'detects video vs photo');
assert.match(page, /mp4\|webm\|mov\|m4v/, 'supports common mobile video extensions');
assert.doesNotMatch(
  page,
  /verificationPhotoFileId \|\| user\.avatarUrl[\s\S]{0,200}<img/,
  'must not always render verification media as bare <img>'
);

assert.match(
  usersRoutes,
  /\/:id\/verification\/media/,
  'API serves admin verification media'
);
assert.match(usersRoutes, /fetchTelegramFileBytes/, 'proxies Telegram KYC bytes');
assert.doesNotMatch(
  usersRoutes,
  /verification\/media[\s\S]{0,800}res\.redirect\(302/,
  'verification media must not 302-redirect (breaks auth blob fetch)'
);

assert.match(mediaRoutes, /sniffTelegramMediaContentType/, 'telegram proxy sniffs mime');
assert.match(
  telegramMedia,
  /video\/mp4/,
  'sniffer recognizes mp4'
);
assert.match(
  telegramMedia,
  /Do not force non-image payloads to image\/jpeg/,
  'documents video Content-Type fix'
);
assert.doesNotMatch(
  mediaRoutes,
  /else contentType = 'image\/jpeg'/,
  'media proxy must not force non-images to jpeg'
);

assert.match(botVerification, /replyWithVideoNote/, 'bot admin can show video_note KYC');
assert.match(botVerification, /replyWithVideo/, 'bot admin can show video KYC');

console.log('adminVerificationMedia.selftest: ok');
