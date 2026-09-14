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
assert(xml.includes('/llms.txt'), 'missing llms.txt for agentic discovery');
assert(xml.includes('/llms-full.txt'), 'missing llms-full.txt');
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
assert(map.includes('/shop/product/p1 /shop'), 'retired p1 301s to /shop');
assert(map.includes('/shop/product/dog-food-1-p1 /shop'), 'retired demo slug 301s to /shop');
assert(!xml.includes('/shop/product/dog-food-1-p1'), 'demo SKUs must not be in sitemap');
assert(xml.includes('/shop/product/dog-food-royal-canin-mini-adult-2kg'), 'live p221 stays in sitemap');
assert(
  map.includes('/shop/dog-food-royal-canin-mini-adult-2kg '),
  'bare /shop/:slug 301s to /shop/product/:slug'
);
assert(
  map.includes('/shop/dog-food-royal-canin-mini-indoor-puppy-1-5kg '),
  'batch 2 slug aliases 301 to /shop/product/:slug'
);
assert(
  map.includes('/shop/cat-food-josera-kitten-2kg '),
  'Josera Kitten slug aliases 301 to /shop/product/:slug'
);
assert(
  map.includes('/shop/cat-food-josera-marinesse-2kg '),
  'batch 3 Marinesse slug aliases 301 to /shop/product/:slug'
);
assert(
  map.includes('/shop/dog-food-royal-canin-hypoallergenic-2kg '),
  'batch 3 Hypoallergenic slug aliases 301 to /shop/product/:slug'
);
assert(
  xml.includes('/shop/product/cat-food-royal-canin-sensible-2kg'),
  'batch 3 Sensible stays in sitemap'
);
assert(
  xml.includes('/shop/product/cat-litter-mr-cat-cat-litter-10-l-carbon'),
  'batch-multi wave 1 carbon litter stays in sitemap'
);
assert(
  map.includes('/shop/dog-treats-wanpy-toothbrush-chews-100g '),
  'batch-multi wave 1 Wanpy slug aliases 301 to /shop/product/:slug'
);
assert(
  xml.includes('/shop/product/dog-treats-wanpy-chicken-jerky-chips-100g'),
  'batch-multi wave 2 Wanpy jerky stays in sitemap'
);
assert(
  map.includes('/shop/dog-toys-luna-squeaky-smile-watermelon-plush-dog-toy '),
  'batch-multi wave 2 Luna slug aliases 301 to /shop/product/:slug'
);
assert(
  xml.includes('/shop/product/cat-toys-petopoli-4-way-foldable-cat-play-tunnel'),
  'batch-multi wave 3 Petopoli tunnel stays in sitemap'
);
assert(
  map.includes('/shop/dog-accessories-hannapet-silicone-dog-leash-size-l '),
  'batch-multi wave 3 Hannapet leash slug aliases 301 to /shop/product/:slug'
);
assert(
  !xml.includes('/shop/product/cat-accessories-hannapet-double-wooden-bowl-stand'),
  'later waves stay out of sitemap'
);
console.log('sitemap.selftest: ok');
