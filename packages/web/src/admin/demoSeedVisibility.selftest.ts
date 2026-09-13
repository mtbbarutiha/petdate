/**
 * Admin demo-seed toggle: default OFF in production, badge + filter wired.
 * Run: npx tsx packages/web/src/admin/demoSeedVisibility.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterDemoSeedRows, isDemoSeedRecord } from '../../../shared/src/demo-seed-markers.ts';

const admin = join(dirname(fileURLToPath(import.meta.url)));
const vis = readFileSync(join(admin, 'DemoSeedVisibility.tsx'), 'utf8');
const employees = readFileSync(join(admin, 'pages/hr/AdminHrEmployeesPage.tsx'), 'utf8');
const ats = readFileSync(join(admin, 'pages/hr/AdminHrAtsPage.tsx'), 'utf8');
const crm = readFileSync(join(admin, 'pages/crm/AdminCrmPages.tsx'), 'utf8');
const service = readFileSync(join(admin, 'pages/hr/AdminHrServicePage.tsx'), 'utf8');
const sales = readFileSync(join(admin, 'pages/sales/AdminSalesPages.tsx'), 'utf8');
const rbac = readFileSync(join(admin, 'pages/hr/AdminHrRbacPage.tsx'), 'utf8');

assert.match(vis, /نمایش داده تست/, 'toggle copy');
assert.match(vis, /import\.meta\.env\.PROD/, 'production default OFF');
assert.match(vis, /داده تست/, 'badge copy');

assert.match(employees, /DemoSeedToggle/, 'HR list uses toggle');
assert.match(ats, /DemoSeedToggle/, 'ATS uses toggle');
assert.match(crm, /DemoSeedToggle/, 'CRM customers use toggle');
assert.match(service, /DemoSeedToggle/, 'timesheet uses toggle');
assert.match(sales, /DemoSeedToggle/, 'sales list uses toggle');
assert.match(rbac, /DemoSeedToggle/, 'RBAC accounts use toggle');
assert.match(rbac, /<b>\{r\.nameFa\}<\/b>/, 'role name stays as text');
assert.doesNotMatch(
  rbac,
  /admin-pill--mint/,
  'role rows do not render a redundant green label badge'
);
assert.doesNotMatch(
  rbac,
  /r\.key === ['"]support['"]/,
  'no support-only label pill next to the role name'
);

assert.equal(isDemoSeedRecord({ personnelCode: 'SEED-HR-01' }), true);
assert.equal(filterDemoSeedRows([{ personnelCode: 'SEED-HR-01' }, { personnelCode: 'E-1' }], false).length, 1);

console.log('demoSeedVisibility.selftest: ok');
