/**
 * Guard: premium login — phone OTP + Telegram + always-on Google CTA.
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
const googleBtn = readFileSync(join(dir, '../../components/GoogleLoginButton.tsx'), 'utf8');
const googleCb = readFileSync(join(dir, 'GoogleCallbackPage.tsx'), 'utf8');
const authShell = readFileSync(join(dir, '../../components/AuthShell.tsx'), 'utf8');
const globalCss = readFileSync(join(dir, '../../styles/global.css'), 'utf8');

assert.match(login, /GoogleLoginButton/, 'login uses shared Google CTA');
assert.match(login, /AuthShell/, 'login uses shared auth chrome');
assert.doesNotMatch(login, /backLabel/, 'login does not force a خانه header action');
assert.match(authShell, /showMobileEvents=\{false\}/, 'auth chrome hides ایونت‌ها pill');
assert.match(authShell, /showDesktopNav=\{false\}/, 'auth chrome hides desktop Events nav');
assert.doesNotMatch(authShell, /common\.home/, 'auth chrome does not default to خانه');
assert.match(otp, /backLabel=\"تغییر شماره\"/, 'OTP keeps explicit back action (not Home)');
assert.match(login, /با تلگرام، گوگل یا موبایل وارد شو/, 'welcome copy includes Google');
assert.doesNotMatch(login, /is-off/, 'Google CTA is not dimmed/hidden');
assert.doesNotMatch(login, /onGoogleClick/, 'Google always starts API OAuth');
assert.doesNotMatch(login, /googleReady/, 'Google CTA is not gated on /providers');
assert.doesNotMatch(login, /fetchAuthProviders/, 'login does not hide Google behind providers');
assert.match(login, /auth-otp-countdown/, 'SMS send countdown on login');
assert.match(login, /normalizeIranMobile/, 'validates phone before OTP request');
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
assert.match(
  globalCss,
  /\.auth-form textarea\s*\{[\s\S]{0,400}?font-size:\s*16px/,
  'auth inputs stay ≥16px so iOS does not focus-zoom'
);
assert.match(
  globalCss,
  /\.auth-login-phone-row input\s*\{[\s\S]{0,220}font-size:\s*16px/,
  'login phone field stays ≥16px on mobile'
);
assert.match(globalCss, /auth-google-cta/, 'Google CTA styles shipped');
assert.doesNotMatch(globalCss, /\.auth-google-cta\.is-off/, 'no dimmed Google CTA style');

assert.match(googleBtn, /googleOAuthStartPath/, 'Google starts API OAuth');
assert.match(googleBtn, /ورود با گوگل/, 'Google CTA copy is clear');
assert.match(googleBtn, /auth-google-cta/, 'Google CTA class present');

assert.match(otp, /GoogleLoginButton/, 'OTP page offers Google as alternate login');
assert.match(otp, /auth-otp-countdown/, 'OTP resend countdown visible');
assert.match(otp, /readRetryAfterSec/, 'OTP reads retryAfterSec from errors');
assert.match(otp, /pepito-btn button-2 auth-telegram-cta/, 'OTP page keeps Telegram button');
assert.doesNotMatch(otp, /auth-telegram-secondary/, 'OTP has no demoted Telegram text link');
assert.doesNotMatch(otp, /تغییر شماره \/ ایمیل/, 'OTP back link is phone-only');
assert.match(googleCb, /method: 'google'/, 'Google callback tracks auth method');
assert.match(googleCb, /fetchMe\(token\)/, 'Google callback hydrates /me');

console.log('loginPage.selftest: ok');
