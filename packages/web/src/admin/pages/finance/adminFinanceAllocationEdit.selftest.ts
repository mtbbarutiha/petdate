/**
 * Guard: تخصیص هزینه «حالت ویرایش» actually unlocks office/people/equipment fields.
 * Run: npx tsx packages/web/src/admin/pages/finance/adminFinanceAllocationEdit.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOfficeCreateBody } from './financeAllocationPayload';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, 'AdminFinanceAllocationPage.tsx'), 'utf8');
const ui = readFileSync(join(here, 'FinanceOsUi.tsx'), 'utf8');
const routes = readFileSync(
  join(here, '../../../../../api/src/routes/admin-finance-os.ts'),
  'utf8'
);
const service = readFileSync(join(here, '../../../../../api/src/finance-os-service.ts'), 'utf8');

assert.match(ui, /aria-pressed=\{editMode\}/, 'edit toggle exposes pressed state');
assert.match(ui, /disabled=\{disabled\}/, 'edit toggle can disable without write');
assert.match(ui, /خروج از حالت ویرایش/, 'on-state label is exit, not a dead current-state chip');
assert.match(ui, /\{editMode \? tr\('خروج از حالت ویرایش'\) : tr\('حالت ویرایش'\)\}/, 'off-state CTA is حالت ویرایش');

assert.match(page, /requestEditMode/, 'allocation page owns edit-mode enter/exit');
assert.match(page, /saveSections/, 'section save exists');
assert.match(page, /tr\('ذخیره تغییرات'\)/, 'save button visible in edit mode');
assert.match(page, /tr\('انصراف'\)/, 'cancel button visible in edit mode');
assert.match(page, /allocation\/offices\/\$\{office\.id\}/, 'saves office cards');
assert.match(page, /allocation\/people\/\$\{person\.id\}/, 'saves people rows');
assert.match(page, /allocation\/equipment\/\$\{eq\.id\}/, 'saves equipment rows');
assert.match(page, /aria-label=\{tr\('اجاره ماهانه'\)\}/, 'office rent becomes an input');
assert.match(page, /aria-label=\{tr\('متراژ'\)\}/, 'office area becomes an input');
assert.match(page, /aria-label=\{tr\('بیزنس'\)\}/, 'office business becomes a control');
assert.match(page, /tr\('افزودن فضا'\)/, 'empty offices can add areas');
assert.match(page, /deleteAreaNow/, 'area delete persists immediately');
assert.match(page, /saveOfficeNow/, 'office row can save immediately');
assert.match(page, /savePersonNow/, 'people row can save immediately');
assert.match(page, /saveEquipmentNow/, 'equipment row can save immediately');
assert.match(page, /appConfirm\(tr\('حذف این فضا؟'\)/, 'delete confirms before PATCH');
assert.match(page, /حذف دفتر/, 'office delete button');
assert.match(page, /allocation\/offices\/\$\{officeId\}/, 'office delete hits API');
assert.match(page, /tr\('ذخیره'\)/, 'inline save label present');
assert.match(page, /editMode \? \(/, 'fields stay read-only until edit mode is on');

assert.doesNotMatch(
  page,
  /tab === 'offices'[\s\S]*<td>\{a\.name\}<\/td>[\s\S]*<td>\{formatNumFa\(a\.sqm\)\}<\/td>/,
  'office area cells are not permanently static text'
);

assert.match(routes, /patch\('\/allocation\/offices\/:id'/, 'office PATCH route');
assert.match(routes, /delete\('\/allocation\/offices\/:id'/, 'office DELETE route');
assert.match(routes, /patch\('\/allocation\/people\/:id'/, 'people PATCH route');
assert.match(routes, /patch\('\/allocation\/equipment\/:id'/, 'equipment PATCH route');
assert.match(service, /export function updateFinanceOsOffice/, 'office update service');
assert.match(service, /export function updateFinanceOsSbgPerson/, 'people update service');
assert.match(service, /export function updateFinanceOsEquipment/, 'equipment update service');

assert.deepEqual(
  buildOfficeCreateBody({
    name: '  دفتر شمال  ',
    address: ' تهران، تجریش ',
    totalSqm: '55',
    monthlyRent: '12000000',
    areas: [
      { id: 'a1', name: ' اتاق جلسه ', sqm: '18', monthlyRent: '4000000', assignedBusiness: 'پت‌دیت' },
      { id: 'a2', name: '   ', sqm: '1', monthlyRent: '2', assignedBusiness: '' },
    ],
  }),
  {
    name: 'دفتر شمال',
    address: 'تهران، تجریش',
    totalSqm: 55,
    monthlyRent: 12000000,
    areas: [{ id: 'a1', name: 'اتاق جلسه', sqm: 18, monthlyRent: 4000000, assignedBusiness: 'پت‌دیت' }],
  },
  'office create payload'
);
assert.match(page, /data-testid="admin-office-create"/, 'office create button');
assert.match(page, /tr\('ایجاد دفتر'\)/, 'create office label');
assert.match(page, /tr\('دفتری ثبت نشده'\)/, 'empty offices show create');
assert.match(page, /\/api\/admin\/finance-os\/allocation\/offices'/, 'office create posts collection');
assert.match(page, /tr\('افزودن فرد'\)/, 'people create');
assert.match(page, /tr\('افزودن تجهیز'\)/, 'equipment create');
assert.match(page, /tr\('ایجاد تخصیص'\)/, 'allocation create');
assert.match(page, /tr\('ایجاد فاکتور'\)/, 'invoice create');
assert.match(page, /tr\('ایجاد تعهد'\)/, 'commitment create');
assert.match(routes, /post\('\/allocation\/offices'/, 'office POST route');
assert.match(service, /export function createFinanceOsOffice/, 'office create service');

console.log('adminFinanceAllocationEdit.selftest: ok');
