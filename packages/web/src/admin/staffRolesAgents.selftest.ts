/**
 * Staff role labels + cache-bust marker for Grok agent panel accounts.
 * Run: npx tsx packages/web/src/admin/staffRolesAgents.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = join(webRoot, '../..');
const layout = readFileSync(join(webRoot, 'src/admin/adminNav.ts'), 'utf8');
const hr = readFileSync(join(webRoot, '../shared/src/hr.ts'), 'utf8');
const staff = readFileSync(join(webRoot, '../shared/src/staff-agents.ts'), 'utf8');
const bust = readFileSync(join(repoRoot, 'tmp/cache-bust-staff-roles-agents-v1'), 'utf8');
const i18n = readFileSync(join(webRoot, 'src/i18n/locales/adminFaEn.ts'), 'utf8');

assert.match(bust, /staff-roles-agents-v1/, 'cache-bust marker present');
assert.match(bust, /petdate-web-v45-staff-roles/, 'SW cache id documented');

assert.match(hr, /veterinarian:\s*'دامپزشک'/);
assert.match(hr, /finance:\s*'مدیر مالی'/);
assert.match(hr, /designer:\s*'گرافیست'/);
assert.match(hr, /shop_procurement:\s*'مدیر تامین فروشگاه'/);
assert.match(hr, /content_editor:\s*'تولید محتوا'/);
assert.match(hr, /'content\.write'/);

assert.match(layout, /perm:\s*'content\.write'/, 'magazine/hero/content use content.write');
assert.match(layout, /perm:\s*'shop\.read'/, 'shop nav stays shop.read');
assert.match(layout, /perm:\s*'support\.inbox'/, 'support inbox stays gated');

assert.match(staff, /username:\s*'sanaz'/);
assert.match(staff, /username:\s*'yalda'/);
assert.match(staff, /username:\s*'staff\.shop'/);
assert.match(staff, /teamAgentSlug:\s*'sanaz-ghaffari'/);
assert.doesNotMatch(staff, /teamAgentSlug:\s*'yalda-shabani'/);

assert.match(i18n, /"گرافیست":\s*"Graphic designer"/);
assert.match(i18n, /"سوشال":\s*"Social"/);
assert.match(i18n, /"مدیر تامین فروشگاه":\s*"Shop procurement manager"/);
assert.match(i18n, /"تولید محتوا":\s*"Content editor"/);
assert.match(i18n, /"محتوا — ویرایش":\s*"Content — edit"/);

console.log('staffRolesAgents.selftest: ok');
