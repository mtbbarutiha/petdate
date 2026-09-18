/**
 * Admin sidebar IA: groups, unique routes, distinct ticket labels, RBAC perms.
 * Run: npx tsx packages/web/src/admin/adminNavOrder.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findLongestNavMatch, matchAdminNavPath } from './adminNavMatch.ts';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'adminNav.ts'), 'utf8');

const groupKeys = [...src.matchAll(/titleKey: '(admin\.[^']+)'/g)].map((m) => m[1]);
assert.deepEqual(
  groupKeys,
  [
    'admin.overview',
    'admin.platform',
    'admin.store',
    'admin.sales',
    'admin.finance',
    'admin.support',
    'admin.club',
    'admin.hr',
    'admin.content',
    'admin.system',
  ],
  'sidebar groups: overview → users → shop → sales → finance → support → CRM → HR → content → system'
);

for (const retired of ['admin.ats', 'admin.assistant', 'admin.config', 'admin.contentSystem']) {
  assert.ok(!groupKeys.includes(retired), `${retired} merged into a parent group`);
}

function block(titleKey: string, nextTitleKey?: string): string {
  const start = src.split(`titleKey: '${titleKey}'`)[1];
  assert.ok(start, `missing group ${titleKey}`);
  if (!nextTitleKey) return start!;
  return start!.split(`titleKey: '${nextTitleKey}'`)[0] ?? '';
}

function hrefsIn(chunk: string): string[] {
  return [...chunk.matchAll(/to:\s*'(\/admin\/[^']+)'/g)].map((m) => m[1]!);
}

const overview = block('admin.overview', 'admin.platform');
const platform = block('admin.platform', 'admin.store');
const store = block('admin.store', 'admin.sales');
const sales = block('admin.sales', 'admin.finance');
const finance = block('admin.finance', 'admin.support');
const support = block('admin.support', 'admin.club');
const club = block('admin.club', 'admin.hr');
const hr = block('admin.hr', 'admin.content');
const content = block('admin.content', 'admin.system');
const system = block('admin.system');

assert.deepEqual(hrefsIn(overview), ['/admin/dashboard', '/admin/analytics']);
assert.equal(hrefsIn(store)[0], '/admin/shop/orders', 'store queue (orders) before catalog');
assert.deepEqual(
  hrefsIn(sales).slice(0, 4),
  ['/admin/sales', '/admin/sales/leads', '/admin/sales/pet-purchase-requests', '/admin/sales/upgrades']
);
assert.ok(hrefsIn(sales).indexOf('/admin/sales/settings') > hrefsIn(sales).indexOf('/admin/sales/reports'));

assert.deepEqual(hrefsIn(support), ['/admin/support', '/admin/crm/ticketing']);
assert.ok(!hrefsIn(club).includes('/admin/crm/ticketing'), 'club tickets live under Support, not Club');
assert.ok(!hrefsIn(content).includes('/admin/support'), 'support inbox is not buried under Content');
assert.ok(!hrefsIn(system).includes('/admin/support'), 'support inbox is not under System');

const allHrefs = hrefsIn(src);
assert.equal(new Set(allHrefs).size, allHrefs.length, 'each sidebar href appears once');

const ticketHrefs = allHrefs.filter((h) => /ticket/i.test(h));
assert.deepEqual(
  ticketHrefs.sort(),
  ['/admin/crm/ticketing', '/admin/sales/tickets'].sort(),
  'only two ticket *routes* in the sidebar (sales queue vs club module)'
);

assert.match(sales, /labelKey: 'admin\.salesTickets'/);
assert.match(sales, /perm: 'sales\.read'/);
assert.match(support, /labelKey: 'admin\.ticketing'/);
assert.match(support, /perm: 'crm\.read'/);
assert.match(support, /crmBadgeKey:\s*'tickets'/);
assert.match(support, /perm: 'support\.inbox'/);
assert.match(hr, /to: '\/admin\/hr\/requests'/);
assert.match(hr, /labelKey: 'admin\.hrTickets'/);
assert.match(hr, /to: '\/admin\/hr\/recruitment'/);
assert.match(hr, /to: '\/admin\/hr\/armita'/);
assert.match(hr, /perm: 'admin\.full'/);

assert.deepEqual(
  hrefsIn(finance).slice(0, 4),
  ['/admin/finance', '/admin/payments', '/admin/coin-sells', '/admin/finance/transactions']
);
assert.match(finance, /tone:\s*'finance'/, 'money queues use finance accent');
assert.ok(
  hrefsIn(platform).indexOf('/admin/verification') < hrefsIn(platform).indexOf('/admin/events'),
  'verify before events browse'
);
assert.match(platform, /tone:\s*'sensitive'/, 'verification/docs use sensitive tone');

assert.match(system, /\/admin\/tag-manager/);
assert.match(content, /\/admin\/magazine/);
assert.match(sales, /labelKey: 'admin\.salesCustomers'/);
assert.match(sales, /labelKey: 'admin\.salesReports'/);
assert.match(sales, /labelKey: 'admin\.salesSettings'/);
assert.match(platform, /labelKey: 'admin\.docsPhotos'/);

assert.ok(matchAdminNavPath('/admin/crm', '/admin/crm/ticketing'));
const prefixItems = [
  { to: '/admin/crm', titleKey: 'admin.club' },
  { to: '/admin/crm/ticketing', titleKey: 'admin.support' },
  { to: '/admin/hr', titleKey: 'admin.hr' },
  { to: '/admin/hr/recruitment', titleKey: 'admin.hr' },
];
assert.equal(
  findLongestNavMatch('/admin/crm/ticketing', prefixItems)?.titleKey,
  'admin.support',
  'longest prefix wins: club tickets highlight Support, not Club desk'
);
assert.equal(findLongestNavMatch('/admin/hr/recruitment', prefixItems)?.to, '/admin/hr/recruitment');

const layout = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'AdminLayout.tsx'), 'utf8');
assert.match(layout, /ADMIN_NAV_GROUPS/, 'layout renders extracted nav groups');
assert.match(layout, /findActiveGroupTitle/, 'layout uses longest-prefix active group');

const fa = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../i18n/locales/fa.ts'), 'utf8');
const en = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../i18n/locales/en.ts'), 'utf8');
assert.match(fa, /ticketing: 'تیکت باشگاه مشتریان'/);
assert.match(en, /ticketing: 'Club tickets'/);
assert.match(fa, /salesTickets: 'تیکت فروش'/);
assert.match(fa, /support: 'پشتیبانی'/);
assert.match(fa, /content: 'محتوا'/);
assert.match(fa, /system: 'سیستم و تنظیمات'/);
assert.match(fa, /docsPhotos: 'تأیید مدارک و عکس'/);
assert.match(fa, /noticesContent: 'اعلان‌ها و بنرها'/);

console.log('adminNavOrder.selftest: ok');
