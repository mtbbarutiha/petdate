/**
 * Guard: shared shop cart API exists for web session + telegram.
 * Run: npx tsx src/routes/shop-cart.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src/routes/shop.ts'), 'utf8');
const service = readFileSync(join(process.cwd(), 'src/services/shop-cart.ts'), 'utf8');
const db = readFileSync(join(process.cwd(), 'src/db.ts'), 'utf8');

assert.match(src, /shopRouter\.get\('\/cart'/, 'GET /cart');
assert.match(src, /shopRouter\.post\('\/cart\/merge'/, 'POST /cart/merge');
assert.match(src, /shopRouter\.put\('\/cart'/, 'PUT /cart');
assert.match(src, /shopRouter\.post\('\/cart\/items'/, 'POST /cart/items');
assert.match(src, /shopRouter\.get\('\/cart-telegram'/, 'GET /cart-telegram');
assert.match(src, /shopRouter\.post\('\/cart-telegram\/items'/, 'POST /cart-telegram/items');
assert.match(src, /clearCartAfterCheckout/, 'checkout clears shared cart');
assert.match(src, /mergeAndPersistShopCart/, 'merge helper wired');

assert.match(service, /merge-then-persist/, 'documents merge-then-persist rule');
assert.match(service, /CREATE TABLE IF NOT EXISTS shop_carts/, 'ensures shop_carts table');
assert.match(db, /CREATE TABLE IF NOT EXISTS shop_carts/, 'migrateSchema creates shop_carts');
assert.match(db, /DELETE FROM shop_carts WHERE user_id/, 'user delete clears cart');

console.log('shop-cart.routes.selftest: ok');
