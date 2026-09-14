/**
 * Per-route SEO helpers — crawlers must not see homepage meta on every URL.
 * Run: npx tsx packages/web/src/lib/pageSeo.selftest.ts
 */
import assert from 'node:assert/strict';
import { SEO, SITE } from '@petdate/shared';
import { SHOP_PRODUCTS } from '../data/shopCatalog.ts';
import {
  absAsset,
  applySeoToHtml,
  canonicalUrl,
  listProductIdRedirects,
  listPrerenderPaths,
  listSitemapEntries,
  normalizePath,
  pageSeoForPath,
  productCanonicalPath,
} from './pageSeo.ts';

assert.equal(normalizePath('/faq/'), '/faq');
assert.equal(normalizePath('faq'), '/faq');
assert.equal(canonicalUrl('/faq'), 'https://petdate.ir/faq');
assert.equal(canonicalUrl('/'), 'https://petdate.ir/');

const home = pageSeoForPath('/');
assert.equal(home.canonicalPath, '/');
assert.equal(home.title, SEO.titleDefault);
assert.match(JSON.stringify(home.jsonLd), /Organization/);
assert.match(JSON.stringify(home.jsonLd), /WebSite/);
assert.doesNotMatch(JSON.stringify(home.jsonLd), /www\.petdate\.ir/, 'sameAs must not dual-signal www');
assert.match(home.noscriptHtml, /پت‌دیت/);

const faq = pageSeoForPath('/faq');
assert.equal(faq.canonicalPath, '/faq');
assert.notEqual(faq.title, home.title);
assert.match(faq.description, /راهنما|سؤالات/);
assert.match(JSON.stringify(faq.jsonLd), /FAQPage/);
assert.match(faq.noscriptHtml, /<h1>/);
assert.match(faq.noscriptHtml, /<h2>/);

const help = pageSeoForPath('/help');
assert.equal(help.canonicalPath, '/faq', '/help aliases FAQ canonical');
assert.equal(help.title, faq.title);

const shop = pageSeoForPath('/shop');
assert.equal(shop.canonicalPath, '/shop');
assert.notEqual(shop.title, home.title);
assert.match(shop.noscriptHtml, /پت‌شاپ|شاپ/);

const mystery = pageSeoForPath('/this-is-not-home');
assert.equal(mystery.canonicalPath, '/this-is-not-home', 'never force-canonical unknown routes to /');

assert.equal(SHOP_PRODUCTS.length, 89, 'live catalog is exactly 89 SKUs');
assert.deepEqual(
  SHOP_PRODUCTS.map((p) => p.id),
  Array.from({ length: 89 }, (_, i) => `p${221 + i}`),
  'catalog ids are p221–p309'
);
const product = SHOP_PRODUCTS.find((p) => p.id === 'p221') ?? SHOP_PRODUCTS[0];
assert.ok(product, 'catalog has a live product');
const byId = pageSeoForPath(`/shop/product/${product.id}`);
const bySlug = pageSeoForPath(`/shop/product/${product.slug}`);
const byShort = pageSeoForPath(`/shop/${product.slug}`);
const byP = pageSeoForPath(`/shop/p/${product.slug}`);
assert.equal(byId.canonicalPath, productCanonicalPath(product));
assert.equal(bySlug.canonicalPath, productCanonicalPath(product));
assert.equal(byShort.canonicalPath, productCanonicalPath(product), '/shop/:slug uses product canonical');
assert.equal(byP.canonicalPath, productCanonicalPath(product), '/shop/p/:slug uses product canonical');
const miniAdult = pageSeoForPath('/shop/dog-food-royal-canin-mini-adult-2kg');
assert.equal(
  miniAdult.canonicalPath,
  '/shop/product/dog-food-royal-canin-mini-adult-2kg',
  'Royal Canin short slug is a PDP, not homepage'
);
assert.match(bySlug.canonicalPath, /\/shop\/product\/[a-z0-9-]+/);
assert.doesNotMatch(bySlug.canonicalPath, /\/shop\/product\/p\d+$/, 'canonical uses descriptive slug');
assert.match(JSON.stringify(bySlug.jsonLd), /"@type":"Product"/);
assert.ok(bySlug.noscriptHtml.includes(product.title), 'product noscript includes title');
const productImage = absAsset(product.image);
assert.equal(bySlug.image, productImage, 'product SEO uses product pack shot');
assert.notEqual(bySlug.image, SITE.ogImage, 'product SEO must not fall back to brand banner');
assert.equal(byId.image, productImage);
assert.equal(byShort.image, productImage);
assert.equal(byP.image, productImage);
const xsmall = pageSeoForPath('/shop/product/dog-food-royal-canin-xsmall-puppy-1-5kg');
assert.match(
  xsmall.image,
  /royal-canin-xsmall-puppy-1\.5kg\.jpg/,
  'X-Small Puppy og:image is the pack shot'
);
assert.doesNotMatch(xsmall.image, /petdate-banner/, 'X-Small Puppy must not use brand banner');
assert.equal(home.image, SITE.ogImage, 'homepage keeps brand banner');
assert.equal(shop.image, SITE.ogImage, 'shop index keeps brand banner');

const redirects = listProductIdRedirects();
assert.ok(redirects.length > 0, 'id → slug redirects exist');
const p1 = redirects.find((r) => r.from === '/shop/product/p1');
assert.ok(p1 && p1.to === '/shop', 'retired p1 redirects to /shop');
const retiredSlug = redirects.find((r) => r.from === '/shop/product/dog-food-1-p1');
assert.ok(retiredSlug && retiredSlug.to === '/shop', 'retired demo slug redirects to /shop');
const p221 = redirects.find((r) => r.from === '/shop/product/p221');
assert.ok(p221 && p221.to === productCanonicalPath(product), 'p221 redirects to descriptive slug');
const shortAlias = redirects.find((r) => r.from === `/shop/${product.slug}`);
assert.ok(shortAlias && shortAlias.to === productCanonicalPath(product), '/shop/:slug 301s to PDP');
assert.ok(
  redirects.some((r) => r.from === '/shop/dog-food-royal-canin-mini-adult-2kg'),
  'Royal Canin short slug is in nginx map'
);
assert.ok(redirects.every((r) => r.from !== r.to && !/\/p\d+$/.test(r.to)), 'redirect targets are not bare ids');

const sitemap = listSitemapEntries(['علائم-هشدار-سگ-و-گربه']);
const paths = sitemap.map((u) => u.path);
assert.ok(paths.includes('/help'), 'sitemap lists public /help');
assert.ok(paths.includes('/games'), 'sitemap lists /games');
assert.ok(paths.includes('/faq'));
assert.ok(paths.includes(productCanonicalPath(product)));
assert.ok(!paths.includes('/auth/login'), 'login omitted as low-value');
assert.ok(!paths.some((p) => p === `/shop/product/${product.id}` && p !== productCanonicalPath(product)), 'no bare p123 product locs');
assert.ok(paths.includes('/magazine/علائم-هشدار-سگ-و-گربه'));
assert.ok(paths.includes('/llms.txt'), 'sitemap lists llms.txt');
assert.ok(!listPrerenderPaths(['علائم-هشدار-سگ-و-گربه']).includes('/llms.txt'), 'do not prerender HTML over llms.txt');

const shell = `<!DOCTYPE html><html><head>
<title data-pd-seo="title">HOME TITLE</title>
<meta name="description" data-pd-seo="description" content="HOME DESC" />
<meta name="robots" data-pd-seo="robots" content="index,follow" />
<link rel="canonical" data-pd-seo="canonical" href="https://petdate.ir/" />
<link rel="alternate" hreflang="fa-IR" data-pd-seo="hreflang-fa" href="https://petdate.ir/" />
<link rel="alternate" hreflang="x-default" data-pd-seo="hreflang-default" href="https://petdate.ir/" />
<meta property="og:url" data-pd-seo="og:url" content="https://petdate.ir/" />
<meta property="og:title" data-pd-seo="og:title" content="HOME TITLE" />
<meta property="og:description" data-pd-seo="og:description" content="HOME DESC" />
<meta property="og:type" data-pd-seo="og:type" content="website" />
<meta property="og:image" data-pd-seo="og:image" content="https://petdate.ir/brand/petdate-banner.jpg" />
<meta property="og:image:secure_url" data-pd-seo="og:image:secure_url" content="https://petdate.ir/brand/petdate-banner.jpg" />
<meta property="og:image:alt" data-pd-seo="og:image:alt" content="پت‌دیت — همبازی برای پت‌ات" />
<meta name="twitter:title" data-pd-seo="twitter:title" content="HOME TITLE" />
<meta name="twitter:description" data-pd-seo="twitter:description" content="HOME DESC" />
<meta name="twitter:image" data-pd-seo="twitter:image" content="https://petdate.ir/brand/petdate-banner.jpg" />
<meta name="twitter:image:alt" data-pd-seo="twitter:image:alt" content="پت‌دیت — همبازی برای پت‌ات" />
<script type="application/ld+json" data-pd-seo="jsonld">{"home":true}</script>
</head><body><div id="root"></div>
<noscript id="pd-seo-noscript"><link href="https://fonts.googleapis.com/css2?family=Vazirmatn" rel="stylesheet" /></noscript>
</body></html>`;

const homeHtml = applySeoToHtml(shell, '/');
assert.doesNotMatch(
  homeHtml,
  /data-pd-lcp="hero"/,
  'homepage SEO must not inject a hardcoded LCP hero preload'
);
assert.doesNotMatch(
  homeHtml,
  /\/media\/lcp\/hero-playmate-800\.webp/,
  'SEO must not re-introduce the stale playmate WebP preload'
);

const dupShell = shell.replace(
  '</head>',
  `<link rel="preload" as="image" href="/media/lcp/hero-playmate-800.webp" imagesrcset="/media/lcp/hero-playmate-800.webp 800w" data-pd-lcp="hero" />\n</head>`
);
const deduped = applySeoToHtml(dupShell, '/');
assert.equal(
  (deduped.match(/rel="preload"[^>]*hero-playmate-800\.webp/g) || []).length,
  0,
  'SEO strips a leftover static index.html hero preload'
);
assert.doesNotMatch(deduped, /data-pd-lcp="hero"/, 'marked hero preload is stripped from all routes');

const faqHtml = applySeoToHtml(shell, '/faq');
const shopHtml = applySeoToHtml(shell, '/shop');
assert.match(faqHtml, /<title[^>]*>راهنما/);
assert.match(shopHtml, /<title[^>]*>پت‌شاپ/);
assert.doesNotMatch(faqHtml, /data-pd-lcp="hero"/, 'non-home routes must not preload homepage hero');
assert.ok(!faqHtml.includes('href="https://petdate.ir/"'), 'faq canonical is not homepage');
assert.match(faqHtml, /href="https:\/\/petdate\.ir\/faq"/);
assert.match(shopHtml, /href="https:\/\/petdate\.ir\/shop"/);
assert.match(faqHtml, /FAQPage/);
assert.doesNotMatch(faqHtml, /fonts\.googleapis\.com\/css2\?family=Vazirmatn/, 'noscript is real text, not only a font link');
assert.match(faqHtml, /<h1>/);

/* Boot LCP must be parked on non-home prerender shells (ghost hero regression). */
const bootShell = `<!doctype html><html><head><title data-pd-seo="title">x</title>
<meta name="description" data-pd-seo="description" content="d" />
<meta name="robots" data-pd-seo="robots" content="index" />
<link rel="canonical" data-pd-seo="canonical" href="https://petdate.ir/" />
<link rel="alternate" hreflang="fa" data-pd-seo="hreflang-fa" href="https://petdate.ir/" />
<link rel="alternate" hreflang="x-default" data-pd-seo="hreflang-default" href="https://petdate.ir/" />
<meta property="og:url" data-pd-seo="og:url" content="https://petdate.ir/" />
<meta property="og:title" data-pd-seo="og:title" content="x" />
<meta property="og:description" data-pd-seo="og:description" content="d" />
<meta property="og:type" data-pd-seo="og:type" content="website" />
<meta name="twitter:title" data-pd-seo="twitter:title" content="x" />
<meta name="twitter:description" data-pd-seo="twitter:description" content="d" />
<script type="application/ld+json" data-pd-seo="jsonld">{}</script>
</head><body>
<img id="pd-boot-lcp" class="pepito-hero-media" src="/media/lcp/hero-playmate-800.webp" alt="" />
<div id="root"><div class="pepito-landing"><section class="pepito-hero"><h1>home</h1></section></div></div>
<noscript id="pd-seo-noscript">old</noscript>
</body></html>`;
const bootHome = applySeoToHtml(bootShell, '/');
const bootShop = applySeoToHtml(bootShell, '/shop');
assert.doesNotMatch(bootHome, /is-parked/, 'homepage keeps boot LCP visible for first paint');
assert.match(bootHome, /<section class="pepito-hero">/, 'homepage keeps hero shell');
assert.match(bootShop, /id="pd-boot-lcp"[^>]*class="[^"]*\bis-parked\b/, 'shop prerender parks boot LCP');
assert.match(bootShop, /pd-boot-shell-placeholder/, 'shop prerender drops homepage hero shell');
assert.doesNotMatch(bootShop, /<section class="pepito-hero">/, 'shop prerender has no landing hero section');

const productHtml = applySeoToHtml(shell, `/shop/product/${product.id}`);
assert.match(productHtml, /"@type":"Product"/);
assert.match(productHtml, new RegExp(product.slug));
assert.match(
  productHtml,
  new RegExp(`property="og:image"[^>]*content="${productImage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
  'prerender og:image is product pack shot'
);
assert.match(
  productHtml,
  new RegExp(`name="twitter:image"[^>]*content="${productImage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
  'prerender twitter:image is product pack shot'
);
assert.doesNotMatch(
  productHtml,
  /property="og:image"[^>]*petdate-banner\.jpg/,
  'prerender product HTML must not keep brand banner as og:image'
);

const xsmallHtml = applySeoToHtml(shell, '/shop/product/dog-food-royal-canin-xsmall-puppy-1-5kg');
assert.match(xsmallHtml, /royal-canin-xsmall-puppy-1\.5kg\.jpg/, 'X-Small Puppy prerender emits pack shot');
assert.doesNotMatch(
  xsmallHtml,
  /property="og:image"[^>]*petdate-banner\.jpg/,
  'X-Small Puppy prerender og:image is not brand banner'
);

assert.equal(SITE.origin, 'https://petdate.ir');
console.log('pageSeo.selftest: ok');
