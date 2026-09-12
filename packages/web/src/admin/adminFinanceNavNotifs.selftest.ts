/**
 * Guard: payments live under مالی with badge; shop has no payments link;
 * CRM/finance/shop badge hooks wired to real nav-count endpoints.
 * Run: npx tsx packages/web/src/admin/adminFinanceNavNotifs.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const layout = readFileSync(join(webRoot, 'admin/AdminLayout.tsx'), 'utf8');
const sharedNav = readFileSync(
  join(webRoot, '../../shared/src/admin-nav.ts'),
  'utf8'
);

assert.match(layout, /financeBadgeKey:\s*['"]payments['"]/, 'deposit queue has finance payments badge');
assert.match(layout, /financeBadgeKey:\s*['"]transactions['"]/, 'transactions badge wired');
assert.match(layout, /financeBadgeKey:\s*['"]pendingAllocation['"]/, 'allocation badge wired');
assert.match(layout, /crmBadgeKey:\s*['"]tickets['"]/, 'CRM ticketing badge wired');
assert.match(layout, /platformBadgeKey:\s*['"]shopOrders['"]/, 'shop orders badge wired');
assert.match(layout, /\/api\/admin\/finance-os\/nav-counts/, 'polls finance-os nav-counts');
assert.match(layout, /\/api\/admin\/crm\/nav-counts/, 'polls crm nav-counts');

const storeBlock = layout.split("titleKey: 'admin.store'")[1]?.split(/titleKey: 'admin\.[^']+'/)[0] || '';
assert.ok(storeBlock, 'store nav group present');
assert.doesNotMatch(storeBlock, /\/admin\/payments/, 'payments removed from فروشگاه nav');

const financeBlock = layout.split("titleKey: 'admin.finance'")[1]?.split(/titleKey: 'admin\.[^']+'/)[0] || '';
assert.match(financeBlock, /\/admin\/payments/, 'payments under مالی');
assert.match(financeBlock, /admin\.depositQueue/, 'deposit queue label under مالی');
assert.match(financeBlock, /\/admin\/coin-sells/, 'coin-sell queue under مالی');
assert.match(financeBlock, /financeBadgeKey:\s*['"]coinSells['"]/, 'coin-sell badge under مالی');

const header = readFileSync(join(webRoot, 'admin/AdminHeaderNotifications.tsx'), 'utf8');
assert.match(header, /\/admin\/coin-sells/, 'اعلانات footer includes coin-sell queue');

assert.match(sharedNav, /shopOrders:\s*number/, 'PlatformNavCounts.shopOrders');
assert.match(sharedNav, /export interface FinanceNavCounts/, 'FinanceNavCounts exported');
assert.match(sharedNav, /export interface CrmNavCounts/, 'CrmNavCounts exported');

console.log('adminFinanceNavNotifs.selftest: ok');
