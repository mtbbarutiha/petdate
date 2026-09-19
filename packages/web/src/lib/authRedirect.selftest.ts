/**
 * Login from /vet-consult must return there (not drop next=).
 * Phone gate after Telegram/Google must run before role/profile.
 * Run: npx tsx packages/web/src/lib/authRedirect.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPhoneGateExempt } from './authRedirect.ts';

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
assert.match(src, /phoneVerified === false/, 'postAuthPath gates unverified phone');
assert.match(src, /\/auth\/phone/, 'phone verify path exists');
assert.match(src, /export function isPhoneGateExempt/, 'product routes use the shared phone gate');

assert.equal(isPhoneGateExempt('/auth/phone'), true, 'verification page is not locked');
assert.equal(isPhoneGateExempt('/auth/login'), true, 'login stays usable');
assert.equal(isPhoneGateExempt('/'), true, 'marketing home stays public');
assert.equal(isPhoneGateExempt('/faq'), true, 'help stays public');
assert.equal(isPhoneGateExempt('/adoption/pets'), true, 'adoption stays public');
assert.equal(isPhoneGateExempt('/magazine/story'), true, 'magazine stays public');
assert.equal(isPhoneGateExempt('/support'), true, 'support stays reachable');
assert.equal(isPhoneGateExempt('/shop'), false, 'shop requires a verified phone');
assert.equal(isPhoneGateExempt('/shop/cart'), false, 'checkout requires a verified phone');
assert.equal(isPhoneGateExempt('/wallet'), false, 'wallet requires a verified phone');
assert.equal(isPhoneGateExempt('/wallet/earn'), false, 'withdrawal requires a verified phone');
assert.equal(isPhoneGateExempt('/chats'), false, 'playmate/chat requires a verified phone');
assert.equal(isPhoneGateExempt('/events'), false, 'events require a verified phone');
assert.equal(isPhoneGateExempt('/profile'), false, 'profile edits require a verified phone');
assert.equal(isPhoneGateExempt('/vet-consult'), false, 'consults require a verified phone');

const guard = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../components/AuthGuard.tsx'), 'utf8');
assert.match(guard, /isPhoneGateExempt/, 'AuthGuard redirects unverified users with the shared gate');
assert.match(guard, /phoneVerifyPath\(here\)/, 'redirect keeps the current path as next');

console.log('authRedirect.selftest: ok');
