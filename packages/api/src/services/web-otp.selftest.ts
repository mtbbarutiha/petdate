/**
 * Production must never echo OTP in JSON. Avoid importing web-otp.ts (pulls DB).
 * Run: npx tsx src/services/web-otp.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'web-otp.ts'), 'utf8');
assert.match(src, /export function shouldEchoWebOtpCode/, 'echo helper is exported');
assert.match(
  src,
  /function isProduction\(\)[\s\S]*NODE_ENV === 'production'/,
  'production gate exists'
);
assert.match(
  src,
  /if \(isProduction\(\)\) return false/,
  'production never echoes OTP even if WEB_OTP_DEV_ECHO=1'
);
assert.match(src, /\.\.\.\(echoDevCode\(\) \? \{ devCode: code \} : \{\}\)/, 'devCode only when echo helper is true');
assert.doesNotMatch(src, /res\.json\(\{[\s\S]*devCode: code/, 'route-level always-echo is absent');
assert.match(src, /gravatar\.com\/avatar/, 'email verify imports Gravatar when empty');
assert.match(src, /importRemoteAvatarIfEmpty/, 'uses shared remote avatar import');
assert.match(src, /createHash\('md5'\)/, 'Gravatar hash uses md5');

console.log('web-otp.selftest: ok');
