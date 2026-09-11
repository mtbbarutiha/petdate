/**
 * Guard: admin hamburger / mobile drawer must open from inline-start
 * (RTL = right for FA) with inverted physical translateX, backdrop dismiss,
 * and a toggle that stays above the open drawer.
 * Run: npx tsx packages/web/src/admin/adminMobileNav.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const layout = readFileSync(join(webRoot, 'admin/AdminLayout.tsx'), 'utf8');
const css = readFileSync(join(webRoot, 'styles/admin.css'), 'utf8');

assert.match(layout, /mobileOpen/, 'AdminLayout tracks mobileOpen');
assert.match(layout, /setMobileOpen\(\(v\) => !v\)/, 'hamburger toggles mobileOpen');
assert.match(layout, /admin-icon-btn--mobile/, 'mobile hamburger button present');
assert.match(layout, /admin-backdrop/, 'backdrop dismiss present');
assert.match(layout, /aria-expanded=\{mobileOpen\}/, 'hamburger exposes aria-expanded');
assert.match(layout, /admin-app--nav-open/, 'open state class on shell');
assert.match(layout, /Escape/, 'Escape closes mobile nav');
assert.match(layout, /document\.body\.style\.overflow/, 'body scroll lock while open');
assert.match(
  layout,
  /useEffect\(\(\) => \{\s*setMobileOpen\(false\);\s*\}, \[location\.pathname\]\)/,
  'route change closes drawer'
);

assert.match(css, /admin-icon-btn--mobile\s*\{\s*display:\s*inline-flex/, 'mobile breakpoint shows hamburger');
assert.match(
  css,
  /\.admin-app\s+\.admin-sidebar\s*\{[\s\S]*?transform:\s*translateX\(-110%\)/,
  'LTR closed drawer slides off to the left'
);
assert.match(
  css,
  /\[dir=['\"]rtl['\"]\]\s+\.admin-app\s+\.admin-sidebar\s*\{[\s\S]*?transform:\s*translateX\(110%\)/,
  'RTL closed drawer slides off to the right (FA start edge)'
);
assert.match(
  css,
  /\.admin-app\s+\.admin-sidebar\.is-open\s*\{[\s\S]*?transform:\s*translateX\(0\)/,
  'open drawer at translateX(0)'
);
assert.match(css, /admin-app--nav-open\s+\.admin-icon-btn--mobile/, 'open toggle stays above drawer');

const mobile768Blocks = [...css.matchAll(/@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1] ?? '');
assert.ok(mobile768Blocks.length >= 1, 'expected at least one 768px media query');
for (const block of mobile768Blocks) {
  assert.equal(
    /\.admin-app\s+\.admin-sidebar\s*\{[^}]*position:\s*relative/.test(block),
    false,
    '768px breakpoint must not force relative sidebar (breaks drawer)'
  );
}

console.log('adminMobileNav.selftest: ok');
