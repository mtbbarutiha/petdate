/**
 * Supplier catalog + purchase invoice edit wiring (no database).
 * Run: npx tsx packages/api/src/shop-suppliers.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalSupplierName,
  isDigikalaSupplierName,
  normalizeSupplierKey,
} from './shop-supplier-names.ts';

const root = dirname(fileURLToPath(import.meta.url));
const suppliers = readFileSync(join(root, 'shop-suppliers.ts'), 'utf8');
const warehouse = readFileSync(join(root, 'shop-warehouse.ts'), 'utf8');
const admin = readFileSync(join(root, 'routes/admin.ts'), 'utf8');
const page = readFileSync(join(root, '../../web/src/admin/pages/AdminShopWarehousePage.tsx'), 'utf8');
const suppliersPage = readFileSync(join(root, '../../web/src/admin/pages/AdminShopSuppliersPage.tsx'), 'utf8');
const layout = readFileSync(join(root, '../../web/src/admin/AdminLayout.tsx'), 'utf8');

assert.equal(canonicalSupplierName('دی جی کالا'), 'دیجی‌کالا');
assert.equal(canonicalSupplierName('ديجي كالا'), 'دیجی‌کالا');
assert.equal(canonicalSupplierName('digikala'), 'دیجی‌کالا');
assert.equal(isDigikalaSupplierName('دیجی‌کالا'), true);
assert.equal(normalizeSupplierKey('دیجی\u200cکالا'), 'دیجیکالا');
assert.equal(canonicalSupplierName('  فروشگاه محلی  '), 'فروشگاه محلی');

assert.match(suppliers, /if \(ensuringSuppliers\) return/, 'schema ensure does not recurse');
assert.match(suppliers, /supplier_id/, 'purchases store supplier id');
assert.match(suppliers, /function migrateLegacyPurchaseSuppliers/, 'legacy text suppliers are migrated');
assert.match(warehouse, /ensureShopSuppliersSchema\(\)/, 'warehouse schema opens the supplier catalog');
assert.match(warehouse, /export function updateSupplierPurchase/, 'purchase invoices can be edited');
assert.match(warehouse, /refreshProductCost/, 'edit recalculates unit cost');
assert.match(admin, /patch\('\/shop\/purchases\/:id'/, 'PATCH purchase route');
assert.match(admin, /\/shop\/suppliers/, 'supplier CRUD routes');
assert.match(page, /supplierId/, 'warehouse form stores supplier id');
assert.doesNotMatch(page, /placeholder=\{tr\('تأمین‌کننده'\)\}/, 'supplier is not a free-text field');
assert.match(page, /ویرایش/, 'each purchase row has edit');
assert.match(suppliersPage, /تأمین‌کنندگان/, 'suppliers admin page');
assert.match(layout, /\/admin\/shop\/suppliers/, 'suppliers nav item');

console.log('shop-suppliers.selftest: ok');
