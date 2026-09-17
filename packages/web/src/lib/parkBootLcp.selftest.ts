/**
 * Guard: out-of-root #pd-boot-lcp must not cover non-home routes.
 * Run: npx tsx packages/web/src/lib/parkBootLcp.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isHomePath } from './parkBootLcp.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(root, '../..');

assert.equal(isHomePath('/'), true);
assert.equal(isHomePath(''), true);
assert.equal(isHomePath('/shop'), false);
assert.equal(isHomePath('/faq'), false);
assert.equal(isHomePath('/auth/login'), false);
assert.equal(isHomePath('/?x=1'), true);
assert.equal(isHomePath('/shop?x=1'), false);

const app = readFileSync(join(root, 'App.tsx'), 'utf8');
const welcome = readFileSync(join(root, 'pages/WelcomePage.tsx'), 'utf8');
const indexHtml = readFileSync(join(root, '../index.html'), 'utf8');
const pageSeo = readFileSync(join(root, 'lib/pageSeo.ts'), 'utf8');
const shopChrome = readFileSync(join(root, 'components/shop/ShopChrome.tsx'), 'utf8');

assert.match(app, /ParkBootLcpOnNonHome/, 'App parks boot LCP off the homepage');
assert.match(app, /isHomePath/, 'App uses shared home-path helper');
assert.match(welcome, /parkBootLcp\(\)/, 'WelcomePage parks via shared helper');
assert.match(welcome, /unparkBootLcp\(\)/, 'WelcomePage keeps boot LCP visible on slide 0');
assert.match(welcome, /bootHandedOff/, 'WelcomePage defers park until slide handoff');
assert.match(indexHtml, /id="pd-park-boot-lcp"/, 'index.html parks boot LCP before React on deep links');
assert.match(indexHtml, /id="pd-boot-hero-from-api"/, 'index.html hydrates boot LCP from /api/hero');
assert.match(indexHtml, /getElementById\('pd-boot-lcp'\)/, 'boot script targets the LCP node');
assert.match(indexHtml, /data-pd-react-owned/, 'boot script respects React ownership (no late unpark)');
assert.match(pageSeo, /parkBootLcpOnNonHome/, 'prerender parks boot LCP on non-home HTML');
assert.match(pageSeo, /stripHardcodedHeroPreload/, 'SEO strips hardcoded hero image preloads');
assert.match(pageSeo, /pd-boot-shell-placeholder/, 'prerender strips homepage hero shell off non-home');
assert.match(welcome, /heroReady/, 'WelcomePage gates slide photos on hero readiness');
assert.match(welcome, /pd-hero-boot-json|readBootHeroOverlay/, 'WelcomePage seeds from boot snapshot');
assert.match(welcome, /scheduleAfterLoadIdle/, 'WelcomePage defers /api/hero off the critical path');
assert.match(
  shopChrome,
  /pepito-landing--with-dock/,
  'shop chrome reserves mobile dock clearance'
);

/* CI packages often run selftests via a glob — keep this file discoverable. */
void repoRoot;
console.log('parkBootLcp.selftest: ok');
