/**
 * Guard: login keeps phone OTP + Telegram CTA; Google only when providers.google is true.
 * Email OTP tab must stay removed from the login UI.
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

assert.match(login, /auth-google-cta/, 'Google CTA exists when providers.google');
assert.match(login, /googleOAuthStartPath/, 'Google starts API OAuth');
assert.match(login, /googleReady === true/, 'Google CTA gated on providers');
assert.match(login, /fetchAuthProviders/, 'loads /api/auth/providers');
assert.match(login, /requestOtp\('phone'/, 'phone OTP only');
assert.doesNotMatch(login, /setChannel\('email'\)/, 'no email tab setter');
assert.doesNotMatch(login, /channel === 'email'/, 'no email channel UI');
assert.doesNotMatch(login, /<Mail/, 'Mail icon unused');
assert.doesNotMatch(login, /یا ایمیل/, 'welcome copy must not mention email login');
assert.match(login, /pepito-btn button-2 auth-telegram-cta/, 'Telegram is a visible button CTA');
assert.doesNotMatch(
  login,
  /auth-telegram-secondary/,
  'Telegram must not be demoted to tiny text-only link'
);
assert.match(login, /ورود با اکانت تلگرام/, 'Telegram CTA copy is clear');
assert.match(login, /pepito-auth-login/, 'compact login wrapper');
assert.match(otp, /pepito-btn button-2 auth-telegram-cta/, 'OTP page keeps Telegram button');
assert.doesNotMatch(otp, /auth-telegram-secondary/, 'OTP has no demoted Telegram text link');
assert.doesNotMatch(otp, /تغییر شماره \/ ایمیل/, 'OTP back link is phone-only');
assert.match(googleCb, /method: 'google'/, 'Google callback tracks auth method');
assert.match(googleCb, /fetchMe\(token\)/, 'Google callback hydrates /me');

console.log('loginPage.selftest: ok');
