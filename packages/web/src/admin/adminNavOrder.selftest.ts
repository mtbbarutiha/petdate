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

const content = layout.split("titleKey: 'admin.contentSystem'")[1] ?? '';
assert.doesNotMatch(content, /\/admin\/analytics/, 'analytics is not buried under content/system');
assert.doesNotMatch(content, /\/admin\/tag-manager/, 'tag manager is not buried under content/system');
assert.match(content, /\/admin\/settings/, 'platform settings stay in content/system');

console.log('adminNavOrder.selftest: ok');
