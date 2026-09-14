/**
 * Guard: premium login — phone OTP + Telegram CTA; Google only when providers.google.
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
const globalCss = readFileSync(join(dir, '../../styles/global.css'), 'utf8');

assert.match(login, /auth-google-cta/, 'Google CTA always present');
assert.match(login, /googleOAuthStartPath/, 'Google starts API OAuth');
assert.match(login, /onGoogleClick/, 'Google click handler when not configured');
assert.match(login, /is-off/, 'Google CTA dimmed when off');
assert.match(login, /auth-otp-countdown/, 'SMS send countdown on login');
assert.match(login, /fetchAuthProviders/, 'loads /api/auth/providers');
assert.match(login, /requestOtp\('phone'/, 'phone OTP only');
assert.doesNotMatch(login, /setChannel\('email'\)/, 'no email tab setter');
assert.doesNotMatch(login, /channel === 'email'/, 'no email channel UI');
assert.doesNotMatch(login, /<Mail/, 'Mail icon unused');
assert.doesNotMatch(login, /یا ایمیل/, 'welcome copy must not mention email login');
assert.match(login, /auth-telegram-cta/, 'Telegram is a visible button CTA');
assert.match(login, /ورود با تلگرام/, 'Telegram CTA copy is clear');
assert.doesNotMatch(
  login,
  /auth-telegram-secondary/,
  'Telegram must not be demoted to tiny text-only link'
);
assert.match(login, /auth-login-premium/, 'premium login wrapper');
assert.doesNotMatch(login, /auth-login-brand/, 'no second Pet Date inside the card');
assert.doesNotMatch(login, /bannerTitle=\"Pet Date\"/, 'banner title is not a second brand line');
assert.match(login, /bannerTitle=\"ورود\"/, 'banner title is login intent, not brand');
assert.match(globalCss, /auth-login-premium/, 'premium login styles shipped');
assert.match(otp, /auth-otp-countdown/, 'OTP resend countdown visible');
assert.match(otp, /readRetryAfterSec/, 'OTP reads retryAfterSec from errors');
assert.match(otp, /pepito-btn button-2 auth-telegram-cta/, 'OTP page keeps Telegram button');
assert.doesNotMatch(otp, /auth-telegram-secondary/, 'OTP has no demoted Telegram text link');
assert.doesNotMatch(otp, /تغییر شماره \/ ایمیل/, 'OTP back link is phone-only');
assert.match(googleCb, /method: 'google'/, 'Google callback tracks auth method');
assert.match(googleCb, /fetchMe\(token\)/, 'Google callback hydrates /me');

console.log('loginPage.selftest: ok');
