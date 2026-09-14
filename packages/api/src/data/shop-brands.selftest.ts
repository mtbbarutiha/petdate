/**
 * Shop brands table + top-brand seed contract.
 * Run: npx tsx src/data/shop-brands.selftest.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(here, '../..');
const webRoot = join(here, '../../../web');

const db = readFileSync(join(apiRoot, 'src/db.ts'), 'utf8');
const admin = readFileSync(join(apiRoot, 'src/admin-platform.ts'), 'utf8');
const routes = readFileSync(join(apiRoot, 'src/routes/admin.ts'), 'utf8');
const shop = readFileSync(join(apiRoot, 'src/routes/shop.ts'), 'utf8');
const webCatalog = readFileSync(join(webRoot, 'src/data/shopCatalog.ts'), 'utf8');

assert.match(db, /CREATE TABLE IF NOT EXISTS shop_brands/, 'shop_brands table');
assert.match(db, /fidar-patira/, 'seed includes Fidar Patira');
assert.match(db, /vipet/, 'seed includes VIPET');
assert.match(admin, /listShopBrands/, 'admin listShopBrands');
assert.match(admin, /upsertShopBrand/, 'admin upsertShopBrand');
assert.match(admin, /seedShopBrandsFromCatalog/, 'catalog brand seed helper');
assert.match(routes, /\/shop\/brands/, 'admin brands routes');
assert.match(shop, /shopRouter\.get\('\/brands'/, 'public brands route');
assert.match(webCatalog, /SHOP_TOP_BRAND_IDS/, 'web top brand ids');
assert.match(webCatalog, /id: 'celebone'/, 'Celebone in web catalog');
assert.match(webCatalog, /id: 'monello'/, 'Monello in web catalog');

for (const id of [
  'royal-canin',
  'josera',
  'mofeed',
  'fidar-patira',
  'wanpy',
  'vipet',
  'reflex',
  'gourmet',
  'celebone',
  'monello',
]) {
  assert.ok(existsSync(join(webRoot, `public/shop/brands/${id}.png`)), `logo missing ${id}`);
}

console.log('shop-brands.selftest: ok');
