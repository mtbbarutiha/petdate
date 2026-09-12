/**
 * Admin sidebar group order is ops priority (most important first).
 * Run: npx tsx packages/web/src/admin/adminNavOrder.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const layout = readFileSync(join(webRoot, 'admin/AdminLayout.tsx'), 'utf8');

const groupKeys = [...layout.matchAll(/titleKey: '(admin\.[^']+)'/g)].map((m) => m[1]);
assert.deepEqual(
  groupKeys,
  [
    'admin.overview',
    'admin.sales',
    'admin.store',
    'admin.club',
    'admin.platform',
    'admin.finance',
    'admin.ats',
    'admin.hr',
    'admin.assistant',
    'admin.config',
    'admin.contentSystem',
  ],
  'sidebar groups follow dashboard → sales/shop → CRM/users → finance → HR → system'
);

const overview = layout.split("titleKey: 'admin.overview'")[1]?.split("titleKey: 'admin.sales'")[0] ?? '';
assert.match(overview, /\/admin\/dashboard/, 'overview starts with platform dashboard');
assert.match(overview, /\/admin\/analytics/, 'analytics sits under overview');
assert.match(overview, /\/admin\/tag-manager/, 'tag manager sits under overview');

function hrefsIn(block: string): string[] {
  return [...block.matchAll(/to:\s*'(\/admin\/[^']+)'/g)].map((m) => m[1]!);
}

const sales = layout.split("titleKey: 'admin.sales'")[1]?.split("titleKey: 'admin.store'")[0] ?? '';
assert.deepEqual(
  hrefsIn(sales).slice(0, 4),
  ['/admin/sales', '/admin/sales/leads', '/admin/sales/pet-purchase-requests', '/admin/sales/upgrades'],
  'sales: inbox/leads first, settings last'
);
assert.ok(hrefsIn(sales).indexOf('/admin/sales/settings') > hrefsIn(sales).indexOf('/admin/sales/reports'));

const store = layout.split("titleKey: 'admin.store'")[1]?.split("titleKey: 'admin.club'")[0] ?? '';
assert.equal(hrefsIn(store)[0], '/admin/shop/orders', 'store queue (orders) before catalog browse');

const club = layout.split("titleKey: 'admin.club'")[1]?.split("titleKey: 'admin.platform'")[0] ?? '';
assert.deepEqual(
  hrefsIn(club).slice(0, 3),
  ['/admin/crm', '/admin/crm/inbox', '/admin/crm/ticketing'],
  'CRM: desk → inbox → tickets'
);

const platform = layout.split("titleKey: 'admin.platform'")[1]?.split("titleKey: 'admin.finance'")[0] ?? '';
assert.ok(hrefsIn(platform).indexOf('/admin/verification') < hrefsIn(platform).indexOf('/admin/games'), 'verify before games browse');
assert.match(platform, /tone:\s*'sensitive'/, 'verification/docs use sensitive tone');

const finance = layout.split("titleKey: 'admin.finance'")[1]?.split("titleKey: 'admin.ats'")[0] ?? '';
assert.deepEqual(
  hrefsIn(finance).slice(0, 4),
  ['/admin/finance', '/admin/payments', '/admin/coin-sells', '/admin/finance/transactions'],
  'finance: dashboard then money queues'
);
assert.match(finance, /tone:\s*'finance'/, 'money queues use finance accent');

const content = layout.split("titleKey: 'admin.contentSystem'")[1] ?? '';
assert.doesNotMatch(content, /\/admin\/analytics/, 'analytics is not buried under content/system');
assert.doesNotMatch(content, /\/admin\/tag-manager/, 'tag manager is not buried under content/system');
assert.equal(hrefsIn(content)[0], '/admin/support', 'support inbox leads content/system');
assert.match(content, /\/admin\/settings/, 'platform settings stay in content/system');

console.log('adminNavOrder.selftest: ok');
