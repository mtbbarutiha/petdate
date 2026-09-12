/**
 * Guard: admin shell stays stable across phone / tablet / laptop / wide
 * viewports — no leftover public-site CSS flattening the drawer, no
 * page-level horizontal scroll from tables or the off-canvas nav.
 * Run: npx tsx packages/web/src/admin/adminResponsive.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const layout = readFileSync(join(webRoot, 'admin/AdminLayout.tsx'), 'utf8');
const css = readFileSync(join(webRoot, 'styles/admin.css'), 'utf8');
const global = readFileSync(join(webRoot, 'styles/global.css'), 'utf8');
const ci = readFileSync(join(webRoot, '../../../scripts/ci-selftest.sh'), 'utf8');
const modal = readFileSync(join(webRoot, 'admin/AdminModal.tsx'), 'utf8');

assert.match(layout, /ADMIN_NAV_MQ = '\(max-width: 960px\)'/, 'hamburger drawer still starts at 960px');
assert.match(layout, /admin-nav-toggle/, 'hamburger / close toggle present');
assert.match(layout, /admin-backdrop/, 'mobile backdrop present');

assert.match(
  css,
  /html:has\(\.admin-app\),\s*body:has\(\.admin-app\)\s*\{[^}]*overflow-x:\s*hidden/s,
  'admin document clips off-canvas drawer overflow (no page-level X scroll)'
);
assert.match(
  css,
  /html:has\(\.admin-app\),\s*body:has\(\.admin-app\)\s*\{[^}]*padding:\s*0\s*!important/s,
  'admin is not inset by public-site body padding'
);
assert.match(
  css,
  /\.admin-app\s*\{[\s\S]*?overflow-x:\s*clip/,
  'admin-app itself does not grow the viewport from transformed children'
);

assert.match(
  css,
  /\.admin-app\s+\.admin-shell\s*\{[^}]*flex-direction:\s*row/s,
  'shell stays a row so the drawer never becomes a stacked strip'
);
assert.match(
  css,
  /\.admin-app\s+\.admin-sidebar-foot\s*\{[^}]*display:\s*flex/s,
  'logout / role chip stay visible in the drawer (legacy global hid them at 768)'
);
assert.match(
  css,
  /\.admin-app\s+\.admin-nav\s*\{[^}]*flex-wrap:\s*nowrap/s,
  'drawer nav stays a vertical list'
);
assert.match(
  css,
  /\.admin-app\s+\.admin-main\s*\{[^}]*min-width:\s*0/s,
  'main can shrink beside the sidebar'
);
assert.match(
  css,
  /\.admin-app\s+\.admin-main\s*\{[^}]*overflow-x:\s*clip/s,
  'main content does not push the page sideways'
);

assert.match(
  css,
  /\.admin-app\s+\.admin-topbar\s*\{[^}]*flex-wrap:\s*wrap/s,
  'topbar wraps instead of overlapping at phone / tablet widths'
);
assert.match(
  css,
  /\.admin-app\s+\.admin-topbar-start\s*\{[^}]*min-width:\s*0/s,
  'topbar title cluster can shrink'
);
assert.match(
  css,
  /\.admin-app\s+\.admin-topbar-title\s*\{[^}]*text-overflow:\s*ellipsis/s,
  'long Persian page titles ellipsis instead of overflowing'
);
assert.match(
  css,
  /\.admin-app\s+\.admin-header\s*\{[^}]*flex-wrap:\s*wrap/s,
  'page headers wrap actions under the title'
);

assert.match(
  css,
  /\.admin-app\s+\.admin-table-wrap\s*\{[^}]*overflow-x:\s*auto/s,
  'tables scroll inside their wrap'
);
assert.match(
  css,
  /\.admin-app\s+\.admin-table-wrap\s*\{[^}]*max-width:\s*100%/s,
  'table wrap cannot expand the page'
);
assert.match(
  css,
  /\.admin-app\s+\.admin-table-wrap\s*\{[^}]*min-width:\s*0/s,
  'table wrap can shrink in flex/grid parents'
);
assert.match(
  css,
  /\.admin-app\s+\.admin-search\s*\{[^}]*min-width:\s*min\(100%,\s*200px\)/s,
  'search fields do not force a 200px overflow on ~360px viewports'
);
assert.match(
  css,
  /\.admin-app\s+\.admin-form-grid\s*\{[^}]*minmax\(min\(100%,\s*260px\)/s,
  'form grids use min() so auto-fill tracks fit the container'
);
assert.match(
  css,
  /\.admin-app\s+\.admin-stats\s*\{[^}]*minmax\(min\(100%,\s*168px\)/s,
  'KPI auto-fill tracks fit narrow cards'
);

assert.match(
  css,
  /\.admin-app\s+\.wdg-grid\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/s,
  'widget board reflows to 2 columns before wide desktop'
);
assert.match(
  css,
  /@media \(min-width:\s*1400px\)\s*\{\s*\.admin-app \.wdg-grid \{[^}]*repeat\(4, minmax\(0, 1fr\)\)/,
  '4-column widget board only on wide desktop'
);
assert.match(
  css,
  /@media \(max-width:\s*720px\)[\s\S]*?\.wdg-grid\s*\{[^}]*grid-template-columns:\s*1fr/,
  'widgets stack to 1 column on phones'
);
assert.match(
  css,
  /\.admin-app\s+\.wdg-tile--w1\s*\{[^}]*grid-column:\s*span 1/s,
  'persisted 1-col widget span is class-based'
);
assert.match(
  css,
  /\.admin-app\s+\.wdg-tile\s*\{[^}]*overflow:\s*hidden/s,
  'resized widgets stay inside their grid area'
);

assert.match(
  css,
  /\.admin-app\s+\.admin-modal-card\s*\{[^}]*max-width:\s*100%/s,
  'modals cannot overflow the viewport'
);
assert.match(modal, /admin-modal-card--\$\{size\}/, 'shared AdminModal still sizes via CSS classes');

assert.match(
  css,
  /@media \(min-width:\s*1024px\)[\s\S]*?\.admin-shell[\s\S]*?overflow:\s*visible\s*!important/,
  'laptop+ shell does not clip dropdowns / drawers with overflow:hidden'
);
assert.match(
  css,
  /\[dir=['\"]rtl['\"]\]\s+\.admin-app\s+\.admin-sidebar[\s\S]*?transform:\s*translateX\(110%\)/,
  'RTL drawer still exits toward the inline-start (right) edge'
);

assert.match(
  global,
  /body:not\(:has\(\.admin-app\)\)\s*\{[^}]*padding:\s*16px 0/s,
  'public-site tablet body padding is excluded from admin'
);
assert.match(
  global,
  /body:not\(:has\(\.admin-app\)\)\s+\.admin-sidebar-foot/,
  'legacy 768px sidebar-foot hide does not apply inside admin-app'
);
assert.match(
  global,
  /body:not\(:has\(\.admin-app\)\)\s+\.admin-shell\s*\{[^}]*flex-direction:\s*column/s,
  'legacy 768px column-shell does not apply inside admin-app'
);
assert.doesNotMatch(
  global,
  /@media \(max-width:\s*768px\)\s*\{[^}]*[^{}]*\.admin-sidebar-foot\s*\{\s*display:\s*none/s,
  'unscoped .admin-sidebar-foot { display:none } must not remain'
);

assert.match(ci, /adminResponsive\.selftest\.ts/, 'CI runs the admin responsive selftest');

console.log('adminResponsive.selftest: ok');
