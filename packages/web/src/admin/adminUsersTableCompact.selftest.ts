/**
 * Guard: /admin/users table stays compact and shows real pet names.
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
assert.match(page, /colSpan=\{8\}/, 'users table has 8 columns (id/user/pets/contact/role/wallet/status/actions)');
assert.match(page, /admin\.colPets/, 'dedicated pet-name column');
assert.match(page, /<AdminPetsCell pets=\{u\.pets\}/, 'renders API pet names');
assert.doesNotMatch(
  page,
  /<th>تلگرام<\/th>/,
  'telegram is folded into contact — not a separate column'
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
assert.match(page, /username=\{u\.username\}/, 'contact cell gets telegram handle');

assert.match(css, /\.admin-table--users\s*\{[^}]*min-width:\s*0/s, 'users table drops global 960px min-width');
assert.match(css, /admin-wallet-grid--compact/, 'compact wallet grid CSS present');
assert.match(
  css,
  /\.admin-wallet-grid--compact\s*\{[^}]*flex-direction:\s*column/s,
  'compact wallet stacks chips to avoid overflow'
);
assert.match(css, /table-layout:\s*fixed/, 'fixed layout packs columns into viewport');
assert.match(css, /admin-pets-cell/, 'pet chips CSS present');
assert.match(css, /admin-pet-chip/, 'pet chip style present');

assert.match(cells, /compact\s*=\s*false/, 'AdminWalletCell accepts compact prop');
assert.match(cells, /onOpenCredit/, 'AdminWalletCell accepts onOpenCredit');
assert.match(cells, /export function AdminPetsCell/, 'AdminPetsCell exported');
assert.match(cells, /admin-muted">—/, 'empty pets/contact use em-dash');
assert.doesNotMatch(cells, /پت نمونه|fakePet|dummyPet/i, 'no invented pet copy');

console.log('adminUsersTableCompact.selftest: ok');
