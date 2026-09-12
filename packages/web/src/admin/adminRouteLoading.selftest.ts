/**
 * Guard: admin tab/route switches show a local loading state instead of
 * flashing the previous page (RR7 startTransition + lazy pages).
 * Run: npx tsx packages/web/src/admin/adminRouteLoading.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const layout = readFileSync(join(webRoot, 'admin/AdminLayout.tsx'), 'utf8');
const outlet = readFileSync(join(webRoot, 'admin/AdminRouteOutlet.tsx'), 'utf8');
const loading = readFileSync(join(webRoot, 'admin/AdminPageLoading.tsx'), 'utf8');
const css = readFileSync(join(webRoot, 'styles/admin.css'), 'utf8');
const app = readFileSync(join(webRoot, 'App.tsx'), 'utf8');

assert.match(layout, /AdminRouteOutlet/, 'AdminLayout renders AdminRouteOutlet');
assert.doesNotMatch(
  layout,
  /<Outlet\s*\/>/,
  'AdminLayout must not render a bare Outlet (stale page flash)'
);

assert.match(outlet, /<Suspense\b/, 'nested Suspense around admin Outlet');
assert.match(outlet, /fallback=\{<AdminPageLoading/, 'Suspense uses admin loading fallback');
assert.match(outlet, /key=\{pathname\}/, 'Suspense remounts on location.pathname');
assert.match(outlet, /readyPath !== pathname/, 'overlay tied to pathname vs ready path');
assert.match(outlet, /AdminPageLoading overlay/, 'pathname overlay while previous page is hidden');
assert.match(outlet, /admin-outlet-page\$\{pending \? ' is-pending'/, 'pending class hides stale outlet');
assert.match(outlet, /<Outlet\s*\/>/, 'new route still mounts under the overlay');

assert.match(loading, /admin\.loading/, 'loading copy uses i18n');
assert.match(loading, /admin-route-spinner/, 'centered spinner');
assert.match(loading, /admin-route-skeleton/, 'skeleton bars');
assert.match(loading, /role="status"/, 'accessible status role');

assert.match(css, /\.admin-app\s+\.admin-outlet\s*\{/, 'outlet fills main column');
assert.match(css, /\.admin-outlet-page\.is-pending/, 'pending outlet is hidden');
assert.match(css, /visibility:\s*hidden/, 'stale content not visible during transition');
assert.match(css, /\.admin-route-loading--overlay/, 'overlay covers main content');
assert.match(css, /padding-inline/, 'RTL-safe loading padding');
assert.match(css, /prefers-reduced-motion:\s*reduce/, 'loading motion can be disabled');
assert.match(css, /var\(--admin-bg\)/, 'loading uses admin tokens (dark/light)');
assert.match(css, /var\(--admin-accent\)/, 'spinner uses admin accent');

assert.match(app, /lazy\(\(\) =>\s*import\('\.\/admin\/pages\/AdminUsersPage'\)/, 'admin pages stay lazy');
assert.match(app, /<Route element=\{<AdminLayout \/>\}>/, 'admin pages still nest under AdminLayout');

console.log('adminRouteLoading.selftest: ok');
