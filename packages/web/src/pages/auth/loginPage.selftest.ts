/**
 * Guard: compact login UI — Google/phone/email primary, Telegram secondary.
 * Run: npx tsx packages/web/src/pages/auth/loginPage.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const login = readFileSync(join(dir, 'LoginPage.tsx'), 'utf8');
const otp = readFileSync(join(dir, 'OtpPage.tsx'), 'utf8');
const googleCb = readFileSync(join(dir, 'GoogleCallbackPage.tsx'), 'utf8');

assert.match(login, /auth-google-cta/, 'Google is a primary login CTA');
assert.match(login, /googleOAuthStartPath/, 'Google starts API OAuth');
assert.match(login, /channel === 'phone'/, 'phone OTP remains');
assert.match(login, /channel === 'email'/, 'email OTP remains');
assert.match(login, /auth-telegram-secondary/, 'Telegram is demoted');
assert.doesNotMatch(
  login,
  /pepito-btn button-2 auth-telegram-cta/,
  'Telegram must not be the dominant purple CTA'
);
assert.match(login, /pepito-auth-login/, 'compact login wrapper');
assert.match(otp, /auth-telegram-secondary/, 'OTP page also demotes Telegram');
assert.doesNotMatch(otp, /auth-telegram-cta/, 'OTP has no big Telegram button');
assert.match(googleCb, /method: 'google'/, 'Google callback tracks auth method');
assert.match(googleCb, /fetchMe\(token\)/, 'Google callback hydrates /me');

console.log('loginPage.selftest: ok');
