/**
 * Web OTP request must map provider failures to 5xx (like Telegram phone OTP),
 * so admin error logs / monitors treat Candoo outages as infra, not client 400s.
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
assert.match(
  src,
  /send_failed[\s\S]{0,80}\? 502/,
  'provider send_failed → HTTP 502'
);
assert.match(
  src,
  /not_configured[\s\S]{0,80}\? 503/,
  'missing SMS/email config → HTTP 503'
);
assert.match(src, /cooldown[\s\S]{0,40}\? 429/, 'cooldown → HTTP 429');
assert.doesNotMatch(
  src,
  /res\.status\(result\.reason === 'cooldown' \? 429 : 400\)/,
  'must not collapse all non-cooldown OTP failures to 400'
);

console.log('auth-otp-status.selftest: ok');
