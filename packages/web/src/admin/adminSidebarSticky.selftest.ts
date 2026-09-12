/**
 * Guard: desktop admin rail stays viewport-fixed (comes along while the
 * page scrolls), fills 100dvh with no empty chrome under خروج, nav
 * scrolls inside the column, and the #353 hamburger drawer stays a drawer.
 * Run: npx tsx packages/web/src/admin/adminSidebarSticky.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const layout = readFileSync(join(webRoot, 'admin/AdminLayout.tsx'), 'utf8');
const css = readFileSync(join(webRoot, 'styles/admin.css'), 'utf8');
const ci = readFileSync(join(webRoot, '../../../scripts/ci-selftest.sh'), 'utf8');

assert.match(layout, /className=\{`admin-sidebar\$\{navOpen \? ' is-open' : ''\}`\}/, 'sidebar class still toggles is-open');
assert.match(layout, /className="admin-sidebar-foot"/, 'role chip + logout stay in the sidebar foot');
assert.match(layout, /className="admin-nav"/, 'nav list is a sibling of brand + foot');
assert.match(layout, /admin-app--nav-open/, 'open shell class reserved for desktop gutter');
assert.match(layout, /ADMIN_NAV_MQ = '\(max-width: 960px\)'/, 'drawer breakpoint unchanged');

const sidebarBlock = css.match(/\.admin-app\s+\.admin-sidebar\s*\{([^}]*)\}/)?.[1] ?? '';
assert.match(sidebarBlock, /position:\s*fixed/, 'rail is fixed to the viewport (sticky dies under overflow-x clip)');
assert.match(sidebarBlock, /height:\s*100dvh/, 'rail height follows the viewport');
assert.match(sidebarBlock, /max-height:\s*100dvh/, 'rail cannot grow with the page');
assert.match(sidebarBlock, /overflow:\s*hidden/, 'chrome itself does not scroll');
assert.match(sidebarBlock, /inset-block:\s*0/, 'rail pins to the viewport block edges');
assert.match(sidebarBlock, /inset-inline-start:\s*0/, 'rail stays on the inline-start edge (right in FA/RTL)');
assert.match(sidebarBlock, /display:\s*flex/, 'column flex so foot can pin');
assert.match(sidebarBlock, /flex-direction:\s*column/, 'brand / nav / foot stack vertically');
assert.doesNotMatch(sidebarBlock, /position:\s*sticky/, 'do not rely on sticky against #353 overflow-x clip');

const navBlock = css.match(/\.admin-app\s+\.admin-nav\s*\{([^}]*)\}/)?.[1] ?? '';
assert.match(navBlock, /flex:\s*1/, 'nav absorbs leftover column space');
assert.match(navBlock, /min-height:\s*0/, 'nav can shrink so overflow-y actually scrolls');
assert.match(navBlock, /overflow-y:\s*auto/, 'long link lists scroll inside the rail');

const footBlock = css.match(/\.admin-app\s+\.admin-sidebar-foot\s*\{([^}]*)\}/)?.[1] ?? '';
assert.match(footBlock, /flex-shrink:\s*0/, 'logout row does not collapse');
assert.match(footBlock, /margin-top:\s*auto/, 'foot sits at the bottom of the 100dvh column');
assert.match(footBlock, /display:\s*flex/, 'logout stays visible (legacy 768 hide must not win)');

assert.match(
  css,
  /@media \(min-width:\s*961px\)[\s\S]*?admin-app--nav-open \.admin-shell[\s\S]*?padding-inline-start:\s*var\(--admin-sidebar-width\)/,
  'desktop open state reserves a gutter so main does not slide under the fixed rail'
);
assert.match(
  css,
  /@media \(min-width:\s*961px\)[\s\S]*?admin-app--nav-closed \.admin-sidebar[\s\S]*?display:\s*none/,
  'desktop close still hides the whole panel'
);

assert.match(
  css,
  /@media \(max-width:\s*960px\)[\s\S]*?\.admin-app\s+\.admin-sidebar[\s\S]*?position:\s*fixed/,
  '≤960 drawer stays off-canvas fixed'
);
assert.match(
  css,
  /@media \(max-width:\s*960px\)[\s\S]*?\.admin-app\s+\.admin-sidebar[\s\S]*?transform:\s*translateX\(-110%\)/,
  'LTR closed drawer still slides off'
);
const mobile960Blocks = [...css.matchAll(/@media\s*\(max-width:\s*960px\)\s*\{/g)];
assert.ok(mobile960Blocks.length >= 1, 'expected a 960px drawer breakpoint');
assert.doesNotMatch(
  css,
  /@media \(max-width:\s*960px\)[^{]*\{[^{}]*padding-inline-start:\s*var\(--admin-sidebar-width\)/,
  'the 960px drawer query itself must not add a desktop gutter'
);

assert.match(
  css,
  /\[dir=['"]rtl['"]\]\s+\.admin-app\s+\.admin-sidebar[\s\S]*?transform:\s*translateX\(110%\)/,
  'RTL closed drawer still exits toward the inline-start (right) edge'
);
assert.match(
  css,
  /\.admin-app\s+\.admin-sidebar\.is-open[\s\S]*?transform:\s*translateX\(0\)/,
  'open drawer at translateX(0)'
);
assert.match(
  css,
  /html:has\(\.admin-app\),\s*body:has\(\.admin-app\)\s*\{[^}]*overflow-x:\s*hidden/s,
  '#353 document overflow-x clip is still in place'
);

assert.match(ci, /adminSidebarSticky\.selftest\.ts/, 'CI runs the sticky-rail selftest');

console.log('adminSidebarSticky.selftest: ok');
