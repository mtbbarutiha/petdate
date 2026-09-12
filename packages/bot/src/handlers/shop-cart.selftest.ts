/**
 * Guard: bot shop uses shared server cart APIs.
 * Run: npx tsx src/handlers/shop-cart.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const shop = readFileSync(join(process.cwd(), 'src/handlers/shop.ts'), 'utf8');
const index = readFileSync(join(process.cwd(), 'src/handlers/index.ts'), 'utf8');
const api = readFileSync(join(process.cwd(), 'src/api-client.ts'), 'utf8');

assert.match(shop, /handleShopAddToCart/, 'add to cart handler');
assert.match(shop, /handleShopCart/, 'cart view handler');
assert.match(shop, /handleShopCartCheckout/, 'cart checkout handler');
assert.match(shop, /fetchShopCartTelegram/, 'reads server cart');
assert.match(shop, /addShopCartItemTelegram/, 'writes server cart');
assert.match(shop, /افزودن به سبد/, 'add-to-cart button label');
assert.match(shop, /merge-then-persist/, 'mentions sync rule');

assert.match(index, /shop:cart/, 'registers shop:cart callback');
assert.match(index, /shop:add:/, 'registers shop:add callback');
assert.match(index, /shop:cartcheckout/, 'registers cart checkout');

assert.match(api, /\/api\/shop\/cart-telegram/, 'telegram cart API client');

console.log('bot shop-cart.selftest: ok');
