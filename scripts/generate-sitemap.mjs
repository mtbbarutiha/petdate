#!/usr/bin/env node
/**
 * Generates packages/web/public/sitemap.xml from public SPA routes.
 * Run before web build (also wired in @petdate/web prebuild).
 *
 * Includes: landing, FAQ, shop + categories, featured products, adoption pets, vet consult, login.
 * Excludes: /admin, /auth/otp, /chats*, /home, wallet, profile, onboarding, cart/orders.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://petdate.ir';
const OUT = path.join(ROOT, 'packages/web/public/sitemap.xml');

const today = new Date().toISOString().slice(0, 10);

/** @type {{ path: string; changefreq: string; priority: string }[]} */
const urls = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/faq', changefreq: 'weekly', priority: '0.9' },
  { path: '/shop', changefreq: 'daily', priority: '0.9' },
  { path: '/shop/c/all', changefreq: 'daily', priority: '0.85' },
  { path: '/vet-consult', changefreq: 'weekly', priority: '0.85' },
  { path: '/auth/login', changefreq: 'monthly', priority: '0.4' },
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** Extract slug entries from ADOPTION_PETS. */
function adoptionSlugs() {
  const src = read('packages/web/src/data/adoptionPets.ts');
  const block = src.match(/export const ADOPTION_PETS[\s\S]*?= \[([\s\S]*?)\];/);
  if (!block) return [];
  return [...block[1].matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
}

/** Extract shop category slugs from SHOP_CATEGORIES. */
function shopCategorySlugs() {
  const src = read('packages/web/src/data/shopCatalog.ts');
  const block = src.match(/export const SHOP_CATEGORIES[\s\S]*?= \[([\s\S]*?)\];/);
  if (!block) return [];
  return [...block[1].matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
}

/** Featured product ids (id near featured: true). */
function featuredProductIds() {
  const src = read('packages/web/src/data/shopCatalog.ts');
  const ids = new Set();
  const objects = src.split(/\n\s*\{\s*\n/).slice(1);
  for (const chunk of objects) {
    if (!/featured:\s*true/.test(chunk)) continue;
    const id = chunk.match(/\bid:\s*'([^']+)'/);
    if (id) ids.add(id[1]);
  }
  const welcome = read('packages/web/src/pages/WelcomePage.tsx');
  for (const m of welcome.matchAll(/to:\s*'\/shop\/product\/([^']+)'/g)) {
    ids.add(m[1]);
  }
  return [...ids];
}

for (const slug of shopCategorySlugs()) {
  urls.push({ path: `/shop/c/${slug}`, changefreq: 'weekly', priority: '0.75' });
}

for (const id of featuredProductIds()) {
  urls.push({ path: `/shop/product/${id}`, changefreq: 'weekly', priority: '0.65' });
}

for (const slug of adoptionSlugs()) {
  urls.push({ path: `/adoption/${slug}`, changefreq: 'weekly', priority: '0.7' });
}

const seen = new Set();
const unique = [];
for (const u of urls) {
  if (seen.has(u.path)) continue;
  seen.add(u.path);
  unique.push(u);
}

const esc = (s) => s;
const body = unique
  .map((u) => {
    const loc = `${ORIGIN}${u.path === '/' ? '/' : u.path}`;
    return [
      '  <url>',
      `    <loc>${esc(loc)}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>${u.changefreq}</changefreq>`,
      `    <priority>${u.priority}</priority>`,
      '  </url>',
    ].join('\n');
  })
  .join('\n');

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  body,
  '</urlset>',
  '',
].join('\n');

fs.writeFileSync(OUT, xml);
console.log(`sitemap: wrote ${unique.length} URLs → ${path.relative(ROOT, OUT)}`);
