/**
 * Face-verify approve/reject user copy + API wiring.
 * Run: npx tsx packages/api/src/services/telegram-face-verify-notify.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FACE_VERIFY_REWARD,
  faceVerifyApprovedNotifyText,
  faceVerifyRejectedNotifyText,
} from '@petdate/shared';
import { usableTelegramId } from './telegram-id';

const here = dirname(fileURLToPath(import.meta.url));
const apiSrc = join(here, '..');
const botVerifyPath = join(here, '..', '..', '..', 'bot', 'src', 'handlers', 'verification.ts');

assert.equal(FACE_VERIFY_REWARD, 100, 'product reward is 100 coins');

const fa = faceVerifyApprovedNotifyText(FACE_VERIFY_REWARD);
assert.match(fa, /تبریک/, 'FA success');
assert.match(fa, /احراز چهره‌ات تأیید شد/, 'FA approved');
assert.match(fa, /۱۰۰/, 'FA 100 coins (Persian digits)');
assert.match(fa, /سکه به موجودی‌ات اضافه شد/, 'FA coins credited');

const en = faceVerifyApprovedNotifyText(FACE_VERIFY_REWARD, 'en');
assert.match(en, /Congratulations/i, 'EN success');
assert.match(en, /face verification was approved/i, 'EN approved');
assert.match(en, /100 coins were added/i, 'EN 100 coins');

const rejectFa = faceVerifyRejectedNotifyText('سلفی تار است');
assert.match(rejectFa, /رد شد/, 'FA reject');
assert.match(rejectFa, /سلفی تار است/, 'FA reject reason');

const rejectEn = faceVerifyRejectedNotifyText('blurry selfie', 'en');
assert.match(rejectEn, /declined/i, 'EN reject');
assert.match(rejectEn, /blurry selfie/, 'EN reject reason');

assert.equal(usableTelegramId('fake_owner_01'), false, 'synthetic ids never notified');
assert.equal(usableTelegramId('not-a-chat'), false, 'non-numeric ids skipped');
assert.equal(usableTelegramId('123456789'), true, 'real numeric telegram id usable');

const usersSrc = readFileSync(join(apiSrc, 'routes/users.ts'), 'utf8');
assert.match(usersSrc, /notifyFaceVerifyApprovedTelegram/, 'approve route notifies user');
assert.match(usersSrc, /notifyFaceVerifyRejectedTelegram/, 'reject route notifies user');
assert.match(
  usersSrc,
  /verification\/approve'[\s\S]{0,900}notifyFaceVerifyApprovedTelegram/,
  'approve handler calls Telegram notify'
);

const adminSrc = readFileSync(join(apiSrc, 'routes/admin.ts'), 'utf8');
assert.match(adminSrc, /notifyFaceVerifyApprovedTelegram/, 'admin status override can notify');

const botVerify = readFileSync(botVerifyPath, 'utf8');
assert.doesNotMatch(
  botVerify,
  /notify approved user failed/,
  'bot must not also DM the user — API owns the notify (no double message)'
);

console.log('telegram-face-verify-notify.selftest: ok');
