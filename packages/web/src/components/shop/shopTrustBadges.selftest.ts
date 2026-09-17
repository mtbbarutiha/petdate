/**
 * Shop PDP Digikala-style trust / service badges strip.
 * Run: npx tsx packages/web/src/components/shop/shopTrustBadges.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const badges = readFileSync(join(here, 'ShopTrustBadges.tsx'), 'utf8');
const page = readFileSync(join(here, '../../pages/shop/ShopProductPage.tsx'), 'utf8');
const css = readFileSync(join(here, '../../styles/pepito.css'), 'utf8') + readFileSync(join(here, '../../styles/pepito-shop.css'), 'utf8');

assert.match(page, /ShopTrustBadges/, 'PDP imports and renders trust badges');
assert.match(page, /<ShopTrustBadges\s*\/>/, 'PDP mounts trust badges strip');
assert.match(badges, /data-testid="shop-trust-badges"/, 'trust badges expose test id');
assert.match(badges, /امکان تحویل اکسپرس/, 'express delivery label');
assert.match(badges, /۲۴ ساعته، ۷ روز هفته/, '24/7 support label');
assert.match(badges, /امکان پرداخت در محل/, 'pay on delivery label');
assert.match(badges, /هفت روز ضمانت بازگشت کالا/, '7-day return label');
assert.match(badges, /ضمانت اصل بودن کالا/, 'authenticity label');
assert.match(badges, /pd-dk-trust/, 'uses Digikala trust class namespace');
assert.match(css, /\.pd-dk-trust\b/, 'trust badges CSS present');
assert.match(css, /\.pd-dk-trust-list\b/, 'trust list CSS present');
assert.match(css, /overflow-x:\s*auto/, 'mobile horizontal scroll for trust strip');
assert.match(css, /flex-wrap:\s*wrap/, 'tablet wrap for trust strip');

console.log('shopTrustBadges.selftest.ts: ok');
