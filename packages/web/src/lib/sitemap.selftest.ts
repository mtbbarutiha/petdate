/**
 * Ensures generate-sitemap output stays public-only and includes key marketing URLs.
 * Run: npx tsx packages/web/src/lib/sitemap.selftest.ts
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
execFileSync('npx', ['tsx', path.join(root, 'scripts/generate-sitemap.ts')], {
  stdio: 'pipe',
  cwd: root,
});
const xml = fs.readFileSync(path.join(root, 'packages/web/public/sitemap.xml'), 'utf8');
const map = fs.readFileSync(path.join(root, 'infra/nginx/shop-product-redirects.map'), 'utf8');

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(xml.includes('<loc>https://petdate.ir/</loc>'), 'missing home');
assert(xml.includes('/faq'), 'missing faq');
assert(xml.includes('/help'), 'missing public /help');
assert(xml.includes('/games'), 'missing /games');
assert(xml.includes('/magazine'), 'missing magazine');
assert(xml.includes('/magazine/'), 'missing magazine articles');
assert(xml.includes('https://petdate.ir/shop</loc>'), 'missing shop');
assert(xml.includes('/vet-consult'), 'missing vet');
assert(xml.includes('https://petdate.ir/adoption</loc>'), 'missing adoption listing');
assert(xml.includes('/adoption/'), 'missing adoption');
assert(xml.includes('/shop/c/'), 'missing shop categories');
assert(xml.includes('/shop/product/'), 'missing shop products');
assert(!xml.includes('/shop/product/p1<'), 'bare product ids must not be sitemap locs');
assert(!xml.includes('/auth/login'), 'login is low-value — omit from sitemap');
assert(!xml.includes('/chats'), 'chats must not be in sitemap');
assert(!xml.includes('/admin'), 'admin must not be in sitemap');
assert(!xml.includes('/wallet'), 'wallet must not be in sitemap');
assert(map.includes('map $uri $shop_product_redirect'), 'nginx product redirect map');
assert(map.includes('/shop/product/p1 '), 'p1 id still 301s to slug');
console.log('sitemap.selftest: ok');
