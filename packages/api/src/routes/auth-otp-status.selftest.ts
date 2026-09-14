/**
 * Web OTP provider failures must stay HTTP 400 (nginx passes origin JSON) while
 * still writing an explicit sms/infra error log for admin /logs.
 * Run: npx tsx src/routes/auth-otp-status.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'auth.ts'), 'utf8');

assert.match(src, /authRouter\.post\('\/otp\/request'/, 'otp request route exists');
assert.match(src, /result\.reason === 'send_failed'/, 'send_failed is classified');
assert.match(src, /result\.reason === 'not_configured'/, 'not_configured is classified');
assert.match(src, /source: 'sms'/, 'provider failures log under source=sms');
assert.match(src, /logAppEvent/, 'explicit admin error log on provider failure');
assert.match(
  src,
  /statusCode: result\.reason === 'not_configured' \? 503 : 502/,
  'meta statusCode records infra codes for ops'
);
assert.match(src, /cooldown' \? 429 : 400/, 'cooldown → 429; other failures → 400 for clients');
assert.doesNotMatch(
  src,
  /send_failed[\s\S]{0,40}\? 502[\s\S]{0,40}res\.status/,
  'must not return HTTP 502 to clients (nginx rewrites the body)'
);

console.log('auth-otp-status.selftest: ok');
