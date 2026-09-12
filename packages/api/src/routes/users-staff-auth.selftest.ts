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
assert.match(src, /delete\('\/:id',\s*requireTrustedStaff/, 'user delete is staff-only');

console.log('users-staff-auth.selftest: ok');
