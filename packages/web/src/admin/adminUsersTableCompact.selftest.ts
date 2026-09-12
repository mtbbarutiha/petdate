/**
 * Guard: /admin/users table stays compact (fewer columns, less horizontal scroll).
 * Run: npx tsx packages/web/src/admin/adminUsersTableCompact.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const page = readFileSync(join(webRoot, 'src/admin/pages/AdminUsersPage.tsx'), 'utf8');
const css = readFileSync(join(webRoot, 'src/styles/admin.css'), 'utf8');
const cells = readFileSync(join(webRoot, 'src/admin/AdminListCells.tsx'), 'utf8');

assert.match(page, /admin-table--users/, 'users table uses compact modifier class');
assert.match(page, /colSpan=\{7\}/, 'users table has 7 columns (was 11)');
assert.doesNotMatch(
  page,
  /<th>تلگرام<\/th>/,
  'telegram is folded into user meta — not a separate column'
);
assert.doesNotMatch(
  page,
  /<th>نقش‌ها<\/th>/,
  'roles badges column merged into single نقش column'
);
assert.doesNotMatch(
  page,
  /<th>احراز<\/th>/,
  'verification merged into وضعیت column'
);
assert.match(page, /admin-row-actions--icon/, 'row actions are icon-only');
assert.match(page, /title=\{tr\(["']حذف کاربر["']\)\}/, 'delete keeps accessible title for soft-delete guard');
assert.match(page, /compact/, 'wallet cell requested in compact mode');
assert.match(page, /onOpenCredit/, 'credit opens from wallet click (no separate اعتبار column/btn)');

assert.match(css, /\.admin-table--users\s*\{[^}]*min-width:\s*0/s, 'users table drops global 960px min-width');
assert.match(css, /admin-wallet-grid--compact/, 'compact wallet grid CSS present');
assert.match(css, /table-layout:\s*fixed/, 'fixed layout packs columns into viewport');

assert.match(cells, /compact\s*=\s*false/, 'AdminWalletCell accepts compact prop');
assert.match(cells, /onOpenCredit/, 'AdminWalletCell accepts onOpenCredit');

console.log('adminUsersTableCompact.selftest: ok');
