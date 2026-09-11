/**
 * Guard: admin users page exposes soft-delete («حذف کاربر») with confirm modal,
 * and API registers DELETE /api/admin/users/:id.
 * Run: npx tsx packages/web/src/admin/adminDeleteUser.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const apiRoot = join(webRoot, '../api');

const page = readFileSync(join(webRoot, 'src/admin/pages/AdminUsersPage.tsx'), 'utf8');
const adminRoutes = readFileSync(join(apiRoot, 'src/routes/admin.ts'), 'utf8');
const webOtp = readFileSync(join(apiRoot, 'src/services/web-otp.ts'), 'utf8');

assert.match(page, /حذف کاربر/, 'users page has حذف کاربر action');
assert.match(page, /تأیید حذف/, 'confirm modal has تأیید حذف');
assert.match(
  page,
  /adminFetch\(`\/api\/admin\/users\/\$\{deleting\.id\}`,\s*\{\s*method:\s*'DELETE'/,
  'UI calls DELETE /api/admin/users/:id'
);
assert.match(page, /adminCan\('platform\.write'\)/, 'delete gated on platform.write');
assert.match(page, /isDeletedUserShell/, 'detects anonymized deleted shells');
assert.match(page, /تاریخچه مالی/, 'Persian warning mentions finance history');

assert.match(
  adminRoutes,
  /adminRouter\.delete\('\/users\/:id'/,
  'admin API registers DELETE /users/:id'
);
assert.match(adminRoutes, /deleteUserById/, 'admin delete uses soft-delete cascade');
assert.match(
  adminRoutes,
  /platform\.write|admin\.full/,
  'admin write guard covers delete'
);

assert.match(
  webOtp,
  /user\.isActive === false/,
  'bearer auth rejects inactive/deleted sessions'
);

console.log('adminDeleteUser.selftest: ok');
