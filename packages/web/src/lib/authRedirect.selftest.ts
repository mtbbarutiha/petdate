/**
 * Login from /vet-consult must return there (not drop next=).
 * Run: npx tsx packages/web/src/lib/authRedirect.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'authRedirect.ts'), 'utf8');

assert.match(
  src,
  /target === '\/home'\s*\n\s*\? '\/auth\/login'/,
  'loginPath omits next only for default /home'
);
assert.doesNotMatch(
  src,
  /target === '\/home' \|\| target === '\/vet-consult'/,
  'loginPath keeps next=/vet-consult'
);
assert.match(src, /sanitized === '\/home'/, 'postAuthPath uses roleHome only for /home');
assert.doesNotMatch(
  src,
  /sanitized === '\/home' \|\| sanitized === '\/vet-consult'/,
  'postAuthPath honors next=/vet-consult'
);

console.log('authRedirect.selftest: ok');
