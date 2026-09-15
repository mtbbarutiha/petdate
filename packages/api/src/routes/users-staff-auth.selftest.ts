/**
 * Staff-only user routes must require bot token or admin password.
 * Run: npx tsx src/routes/users-staff-auth.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src/routes/users.ts'), 'utf8');

assert.match(src, /requireTrustedStaff/, 'users router imports staff gate');
assert.match(
  src,
  /payments\/:id\/approve',\s*requireTrustedStaff/,
  'card payment approve is staff-only'
);
assert.match(
  src,
  /payments\/:id\/reject',\s*requireTrustedStaff/,
  'card payment reject is staff-only'
);
assert.match(
  src,
  /payments\/:id\/stars\/complete',\s*requireTrustedStaff/,
  'stars complete is staff/bot-only'
);
assert.match(src, /requireBotOrMatchingTelegram/, 'telegram money routes require bot or session');
assert.match(src, /catalogPaymentAmounts/, 'telegram payments use server catalog');
assert.match(src, /claimDailyCoins\(user\.id\)/, 'daily claim does not take client amount');
assert.match(
  src,
  /payments\/pending\/card',\s*requireTrustedStaff/,
  'pending card payments list is staff-only'
);
assert.match(
  src,
  /verification\/pending',\s*requireTrustedStaff/,
  'verification queue is staff-only'
);
assert.match(
  src,
  /coins\/credit',\s*requireTrustedStaff/,
  'coin credit is staff-only'
);
assert.match(
  src,
  /coins\/debit',\s*requireTrustedStaff/,
  'coin debit is staff-only'
);
assert.match(src, /delete\('\/:id',\s*requireTrustedStaff/, 'user delete is staff-only');
assert.match(src, /parsePositiveIntId\(req\.params\.id\)/, 'user id routes reject NaN');
assert.match(src, /شناسه کاربر نامعتبر است/, 'bad user id returns 400 copy');
assert.match(src, /usersRouter\.get\('\/:id'/, 'GET /:id alias exists (bot 404)');
const aliasIdx = src.lastIndexOf("usersRouter.get('/:id'");
const vetsIdx = src.indexOf("usersRouter.get('/vets'");
assert.ok(vetsIdx >= 0 && aliasIdx > vetsIdx, 'GET /:id is after /vets so it cannot steal that path');

console.log('users-staff-auth.selftest: ok');
