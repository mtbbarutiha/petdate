/**
 * Mandatory phone OTP gate for Telegram bot registration.
 * Run: npx tsx packages/bot/src/handlers/phone-verify-mandatory.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const phoneSrc = readFileSync(join(dir, 'phone-verify.ts'), 'utf8');
const indexSrc = readFileSync(join(dir, 'index.ts'), 'utf8');
const startSrc = readFileSync(join(dir, 'start.ts'), 'utf8');

assert.match(phoneSrc, /export const mandatoryPhoneMiddleware/, 'middleware exported');
assert.match(phoneSrc, /needsPhoneVerify/, 'needsPhoneVerify covers all roles');
assert.match(phoneSrc, /return !user\.phoneVerified/, 'gate is phoneVerified for every role');
assert.doesNotMatch(
  phoneSrc,
  /userHasRole\(user, 'vet'\) && !user\.phoneVerified/,
  'must not limit the gate to vets only'
);

assert.match(indexSrc, /mandatoryPhoneMiddleware/, 'middleware registered on bot');
assert.match(
  indexSrc,
  /bot\.use\(forceJoinMiddleware\);\s*\n\s*\/\/[^\n]*\n\s*bot\.use\(mandatoryPhoneMiddleware\)/,
  'phone gate runs after force-join'
);
assert.match(
  indexSrc,
  /handlePhoneVerifyStart\(ctx, \{ required: true \}\)/,
  'menu/callback phone verify is required'
);

assert.match(
  startSrc,
  /ثبت‌نام: اول احراز موبایل اجباری[\s\S]*handlePhoneVerifyStart[\s\S]*startProfileWizard/,
  'role confirm requires phone before profile wizard'
);
assert.match(
  startSrc,
  /اول شماره موبایلت رو با پیامک تأیید کن/,
  'role confirm copy says phone is mandatory'
);

console.log('phone-verify-mandatory.selftest: ok');
