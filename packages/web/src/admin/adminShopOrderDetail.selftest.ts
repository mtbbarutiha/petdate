/**
 * Guard: admin shop order expand panel is a clean RTL detail UI (not raw JSON dump).
 * Run: npx tsx packages/web/src/admin/adminShopOrderDetail.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const page = readFileSync(join(webRoot, 'src/admin/pages/AdminShopOrdersPage.tsx'), 'utf8');
const css = readFileSync(join(webRoot, 'src/styles/admin.css'), 'utf8');

assert.match(page, /admin-order-detail/, 'expanded panel uses admin-order-detail class');
assert.match(page, /OrderItemsList/, 'items rendered via OrderItemsList helper');
assert.match(page, /آدرس \/ یادداشت/, 'address/note block labeled in Persian');
assert.match(page, /آیتم‌ها/, 'items section labeled');
assert.doesNotMatch(
  page,
  /آیتم‌ها:\s*\{JSON\.stringify/,
  'does not dump raw JSON inline as RTL text under آیتم‌ها'
);
assert.match(page, /adminWantsRawJson/, 'raw JSON gated behind developer localStorage flag');
assert.match(page, /showRawJson/, 'raw JSON only rendered when showRawJson is true');
assert.match(
  page,
  /\{showRawJson \? \([\s\S]*admin-order-detail__raw[\s\S]*\) : null\}/,
  'JSON خام details is not always mounted for normal admins'
);
assert.match(page, /setOpenId\(open \? null : o\.id\)/, 'close / details toggle still wired');
assert.match(page, /patch\(o\.id, e\.target\.value\)/, 'status dropdown still patches order');
assert.match(page, /admin-order-detail__item-title/, 'human-readable item title class');
assert.match(page, /itemUnitPrice|itemLineTotal/, 'item prices rendered for humans');

assert.match(css, /\.admin-order-detail\s*\{/, 'order detail panel CSS present');
assert.match(
  css,
  /\.admin-order-detail__address[\s\S]*white-space:\s*pre-wrap/m,
  'address block keeps readable wrapping'
);
assert.match(
  css,
  /@media \(max-width: 720px\)[\s\S]*\.admin-order-detail[\s\S]*grid-template-columns:\s*1fr/m,
  'detail panel stacks on narrow screens'
);

console.log('adminShopOrderDetail.selftest: ok');
