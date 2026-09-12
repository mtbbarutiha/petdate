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
assert.match(indexHtml, /id="pd-park-boot-lcp"/, 'index.html parks boot LCP before React on deep links');
assert.match(indexHtml, /getElementById\('pd-boot-lcp'\)/, 'boot script targets the LCP node');
assert.match(pageSeo, /parkBootLcpOnNonHome/, 'prerender parks boot LCP on non-home HTML');
assert.match(pageSeo, /pd-boot-shell-placeholder/, 'prerender strips homepage hero shell off non-home');
assert.match(
  shopChrome,
  /pepito-landing--with-dock/,
  'shop chrome reserves mobile dock clearance'
);

/* CI packages often run selftests via a glob — keep this file discoverable. */
void repoRoot;
console.log('parkBootLcp.selftest: ok');
