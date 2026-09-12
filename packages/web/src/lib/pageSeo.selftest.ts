/**
 * Per-route SEO helpers — crawlers must not see homepage meta on every URL.
 * Run: npx tsx packages/web/src/lib/pageSeo.selftest.ts
 */
import assert from 'node:assert/strict';
import { SEO, SITE } from '@petdate/shared';
import { SHOP_PRODUCTS } from '../data/shopCatalog.ts';
import {
  applySeoToHtml,
  canonicalUrl,
  listProductIdRedirects,
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

const product = SHOP_PRODUCTS.find((p) => p.id === 'p1') ?? SHOP_PRODUCTS[0];
assert.ok(product, 'catalog has a product');
const byId = pageSeoForPath(`/shop/product/${product.id}`);
const bySlug = pageSeoForPath(`/shop/product/${product.slug}`);
assert.equal(byId.canonicalPath, productCanonicalPath(product));
assert.equal(bySlug.canonicalPath, productCanonicalPath(product));
assert.match(bySlug.canonicalPath, /\/shop\/product\/[a-z0-9-]+/);
assert.doesNotMatch(bySlug.canonicalPath, /\/shop\/product\/p\d+$/, 'canonical uses descriptive slug');
assert.match(JSON.stringify(bySlug.jsonLd), /"@type":"Product"/);
assert.ok(bySlug.noscriptHtml.includes(product.title), 'product noscript includes title');

const redirects = listProductIdRedirects();
assert.ok(redirects.length > 0, 'id → slug redirects exist');
const p1 = redirects.find((r) => r.from === '/shop/product/p1');
assert.ok(p1 && p1.to === productCanonicalPath(product), 'p1 redirects to descriptive slug');
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
<meta name="twitter:title" data-pd-seo="twitter:title" content="HOME TITLE" />
<meta name="twitter:description" data-pd-seo="twitter:description" content="HOME DESC" />
<script type="application/ld+json" data-pd-seo="jsonld">{"home":true}</script>
</head><body><div id="root"></div>
<noscript id="pd-seo-noscript"><link href="https://fonts.googleapis.com/css2?family=Vazirmatn" rel="stylesheet" /></noscript>
</body></html>`;

const faqHtml = applySeoToHtml(shell, '/faq');
const shopHtml = applySeoToHtml(shell, '/shop');
assert.match(faqHtml, /<title[^>]*>راهنما/);
assert.match(shopHtml, /<title[^>]*>پت‌شاپ/);
assert.ok(!faqHtml.includes('href="https://petdate.ir/"'), 'faq canonical is not homepage');
assert.match(faqHtml, /href="https:\/\/petdate\.ir\/faq"/);
assert.match(shopHtml, /href="https:\/\/petdate\.ir\/shop"/);
assert.match(faqHtml, /FAQPage/);
assert.doesNotMatch(faqHtml, /fonts\.googleapis\.com\/css2\?family=Vazirmatn/, 'noscript is real text, not only a font link');
assert.match(faqHtml, /<h1>/);

const productHtml = applySeoToHtml(shell, `/shop/product/${product.id}`);
assert.match(productHtml, /"@type":"Product"/);
assert.match(productHtml, new RegExp(product.slug));

assert.equal(SITE.origin, 'https://petdate.ir');
console.log('pageSeo.selftest: ok');
