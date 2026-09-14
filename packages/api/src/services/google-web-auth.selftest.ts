/**
 * Guard: Google OAuth helpers + email/Google profile import.
 * Run: npx tsx packages/api/src/services/google-web-auth.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nameFromEmailLocalPart, pickIranPhoneFromProvider } from './provider-profile-hints.ts';
import {
  buildGoogleAuthorizeUrl,
  googleLoginErrorRedirect,
  googleLoginSuccessRedirect,
  googleRedirectUri,
  isGoogleOAuthConfigured,
  publicWebOrigin,
  readGoogleOAuthState,
  signGoogleOAuthState,
} from './google-oauth-core.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const googleSrc = readFileSync(join(dir, 'google-web-auth.ts'), 'utf8');
const coreSrc = readFileSync(join(dir, 'google-oauth-core.ts'), 'utf8');
const authSrc = readFileSync(join(dir, '../routes/auth.ts'), 'utf8');
const otpSrc = readFileSync(join(dir, 'web-otp.ts'), 'utf8');

assert.match(coreSrc, /GOOGLE_CLIENT_ID/, 'reads GOOGLE_CLIENT_ID');
assert.match(coreSrc, /GOOGLE_CLIENT_SECRET/, 'reads GOOGLE_CLIENT_SECRET');
assert.match(coreSrc, /openid/, 'openid scope');
assert.match(coreSrc, /accounts\.google\.com\/o\/oauth2\/v2\/auth/, 'authorize URL');
assert.match(coreSrc, /publicWebOrigin/, 'public origin for redirects');
assert.match(googleSrc, /email_verified/, 'requires Google email_verified');
assert.match(googleSrc, /createWebSession/, 'issues the same web session token as OTP/Telegram');
assert.match(googleSrc, /setUserGoogleSub/, 'links google_sub on the unified users row');
assert.doesNotMatch(
  coreSrc,
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

const prev = {
  id: process.env.GOOGLE_CLIENT_ID,
  secret: process.env.GOOGLE_CLIENT_SECRET,
  publicWeb: process.env.PUBLIC_WEB_URL,
  web: process.env.WEB_URL,
  redirect: process.env.GOOGLE_REDIRECT_URI,
  state: process.env.GOOGLE_OAUTH_STATE_SECRET,
  nodeEnv: process.env.NODE_ENV,
};

process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret-not-real';
process.env.PUBLIC_WEB_URL = 'https://petdate.ir';
process.env.GOOGLE_OAUTH_STATE_SECRET = 'test-state-secret';
delete process.env.GOOGLE_REDIRECT_URI;

assert.equal(isGoogleOAuthConfigured(), true, 'configured when id+secret set');
assert.equal(publicWebOrigin(), 'https://petdate.ir');
assert.equal(googleRedirectUri(), 'https://petdate.ir/api/auth/google/callback');

const signed = signGoogleOAuthState('/shop');
const read = readGoogleOAuthState(signed);
assert.equal(read.ok, true, 'signed state verifies');
if (read.ok) assert.equal(read.next, '/shop');
assert.equal(readGoogleOAuthState('tampered').ok, false, 'rejects junk state');

const url = buildGoogleAuthorizeUrl('/shop');
assert.ok(url, 'authorize URL built');
assert.match(url!, /accounts\.google\.com\/o\/oauth2\/v2\/auth/);
assert.match(url!, /redirect_uri=https%3A%2F%2Fpetdate\.ir%2Fapi%2Fauth%2Fgoogle%2Fcallback/);
assert.match(googleLoginErrorRedirect('missing'), /\/auth\/login\?google=missing/);
assert.match(googleLoginSuccessRedirect('tok'), /\/auth\/google\?token=tok/);

process.env.NODE_ENV = 'production';
process.env.PUBLIC_WEB_URL = 'http://127.0.0.1:3001';
assert.equal(publicWebOrigin(), 'https://petdate.ir', 'prod ignores local bind URL');

if (prev.id === undefined) delete process.env.GOOGLE_CLIENT_ID;
else process.env.GOOGLE_CLIENT_ID = prev.id;
if (prev.secret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
else process.env.GOOGLE_CLIENT_SECRET = prev.secret;
if (prev.publicWeb === undefined) delete process.env.PUBLIC_WEB_URL;
else process.env.PUBLIC_WEB_URL = prev.publicWeb;
if (prev.web === undefined) delete process.env.WEB_URL;
else process.env.WEB_URL = prev.web;
if (prev.redirect === undefined) delete process.env.GOOGLE_REDIRECT_URI;
else process.env.GOOGLE_REDIRECT_URI = prev.redirect;
if (prev.state === undefined) delete process.env.GOOGLE_OAUTH_STATE_SECRET;
else process.env.GOOGLE_OAUTH_STATE_SECRET = prev.state;
if (prev.nodeEnv === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = prev.nodeEnv;

console.log('google-web-auth.selftest: ok');
