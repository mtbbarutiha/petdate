/**
 * Ensures generate-sitemap output stays public-only and includes key marketing URLs.
 * Run: npx tsx packages/web/src/lib/sitemap.selftest.ts
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
execFileSync(process.execPath, [path.join(root, 'scripts/generate-sitemap.mjs')], {
  stdio: 'pipe',
});
const xml = fs.readFileSync(path.join(root, 'packages/web/public/sitemap.xml'), 'utf8');

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(xml.includes('<loc>https://petdate.ir/</loc>'), 'missing home');
assert(xml.includes('/faq'), 'missing faq');
assert(xml.includes('/magazine'), 'missing magazine');
assert(xml.includes('/magazine/'), 'missing magazine articles');
assert(xml.includes('https://petdate.ir/shop</loc>'), 'missing shop');
assert(xml.includes('/vet-consult'), 'missing vet');
assert(xml.includes('https://petdate.ir/adoption</loc>'), 'missing adoption listing');
assert(xml.includes('/adoption/'), 'missing adoption');
assert(xml.includes('/shop/c/'), 'missing shop categories');
assert(!xml.includes('/chats'), 'chats must not be in sitemap');
assert(!xml.includes('/admin'), 'admin must not be in sitemap');
assert(!xml.includes('/wallet'), 'wallet must not be in sitemap');
console.log('sitemap.selftest: ok');
