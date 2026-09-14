/**
 * Guard: Google OAuth helpers + email/Google profile import.
 * Run: npx tsx packages/api/src/services/google-web-auth.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nameFromEmailLocalPart, pickIranPhoneFromProvider } from './provider-profile-hints.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const googleSrc = readFileSync(join(dir, 'google-web-auth.ts'), 'utf8');
const authSrc = readFileSync(join(dir, '../routes/auth.ts'), 'utf8');
const otpSrc = readFileSync(join(dir, 'web-otp.ts'), 'utf8');

assert.match(googleSrc, /GOOGLE_CLIENT_ID/, 'reads GOOGLE_CLIENT_ID');
assert.match(googleSrc, /GOOGLE_CLIENT_SECRET/, 'reads GOOGLE_CLIENT_SECRET');
assert.match(googleSrc, /openid/, 'openid scope');
assert.match(googleSrc, /accounts\.google\.com\/o\/oauth2\/v2\/auth/, 'authorize URL');
assert.doesNotMatch(
  googleSrc,
  /user\.phonenumbers\.read/,
  'must not require sensitive People phone scope'
);
assert.match(authSrc, /authRouter\.get\('\/google'/, 'google start route');
assert.match(authSrc, /authRouter\.get\('\/google\/callback'/, 'google callback route');
assert.match(otpSrc, /applyLoginProfileHints/, 'email/phone OTP fills profile hints');

assert.equal(nameFromEmailLocalPart('sara.rezaei@gmail.com'), 'Sara Rezaei');
assert.equal(nameFromEmailLocalPart('123456@gmail.com'), null);
assert.equal(pickIranPhoneFromProvider('+98 912 123 4567'), '989121234567');
assert.equal(pickIranPhoneFromProvider('+1 415 555 0100'), null);

console.log('google-web-auth.selftest: ok');
