/**
 * SW bust generation must move when guest marketing routes change.
 * v14 cacheId stayed active after later bust *keys*, so #213's new shell
 * never replaced the controlling worker (live still showed Layout + /#pets).
 * Run: npx tsx packages/web/src/lib/swCache.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(webSrc, '..');
const sw = readFileSync(join(webSrc, 'lib/swRegister.ts'), 'utf8');
const vite = readFileSync(join(root, 'vite.config.ts'), 'utf8');

assert.match(sw, /petdate-sw-20260912-lh-pass-v25/, 'swRegister bust generation is v25');
assert.match(sw, /petdate-web-v25-lh-pass/, 'swRegister active cacheId is v25');
assert.match(vite, /cacheId:\s*'petdate-web-v25-lh-pass'/, 'vite PWA cacheId is v25');
assert.doesNotMatch(sw, /petdate-web-v24-lh-pass/, 'old v24-lh-pass cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-lh-pass-v24/, 'old v24-lh-pass bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v24-vazirmatn/, 'old v24-vazirmatn cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-vazirmatn-v24/, 'old v24-vazirmatn bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v23-hero-compact/, 'old v23-hero-compact cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-hero-compact-v23/, 'old v23-hero-compact bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v23-lh-pass/, 'old v23 cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-lh-pass-v23/, 'old v23 bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v23-vazirmatn/, 'old v23 vazirmatn cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-vazirmatn-v23/, 'old v23 vazirmatn bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v22-cls-agentic/, 'old v22 cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-cls-agentic-v22/, 'old v22 bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v21-faq-dark/, 'old v21 cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-faq-dark-v21/, 'old v21 bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v20-agentic/, 'old v20 cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-agentic-v20/, 'old v20 bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v19-mobile/, 'old v19 cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-mobile-v19/, 'old v19 bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v14-pets-sync/, 'old v14 cacheId is no longer active');
assert.doesNotMatch(sw, /petdate-web-v15-vet-landing/, 'unshipped v15 cacheId is not active');
assert.doesNotMatch(sw, /petdate-web-v17-seo/, 'old v17 cacheId is retired');
assert.doesNotMatch(sw, /petdate-web-v18-lighthouse/, 'old v18 cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-lighthouse-v18/, 'old v18 bust key is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-seo-v17/, 'old v17 bust key is retired');
assert.doesNotMatch(sw, /petdate-sw-20260908-profile-pets-v14/, 'old v14 bust key is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-profile-about-pets-v2/, 'v14-cacheId bust key is retired');

console.log('swCache.selftest: ok');
