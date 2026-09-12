/**
 * Guard: admin hamburger fully closes the panel (not just labels),
 * toggle stays above the drawer, Menu ↔ X state is obvious.
 * Run: npx tsx packages/web/src/admin/adminMobileNav.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const layout = readFileSync(join(webRoot, 'admin/AdminLayout.tsx'), 'utf8');
const css = readFileSync(join(webRoot, 'styles/admin.css'), 'utf8');

assert.match(layout, /navOpen/, 'AdminLayout tracks navOpen');
assert.match(layout, /setNavOpen\(\(v\) => !v\)/, 'hamburger toggles navOpen');
assert.match(layout, /admin-nav-toggle/, 'fixed hamburger/close toggle present');
assert.match(layout, /admin-backdrop/, 'backdrop dismiss present');
assert.match(layout, /aria-expanded=\{navOpen\}/, 'toggle exposes aria-expanded');
assert.match(layout, /admin-app--nav-open/, 'open state class on shell');
assert.match(layout, /admin-app--nav-closed/, 'closed state class on shell');
assert.match(layout, /Escape/, 'Escape closes mobile nav');
assert.match(layout, /document\.body\.style\.overflow/, 'body scroll lock while open');
assert.match(layout, /if \(isMobileNav\) setNavOpen\(false\)/, 'route change closes overlay drawer');
assert.match(layout, /navOpen \? <X /, 'open state shows close X');
assert.match(layout, /<Menu /, 'closed state shows hamburger');
assert.doesNotMatch(layout, /admin-icon-btn--mobile/, 'toggle is not trapped inside topbar hamburger');
assert.doesNotMatch(layout, /setCollapsed/, 'icon-rail collapse is no longer the close action');

assert.match(css, /\.admin-nav-toggle\s*\{/, 'toggle styles exist');
assert.match(css, /z-index:\s*60/, 'toggle stacks above drawer (40) and topbar (20)');
assert.match(
  css,
  /\.admin-nav-toggle\s*\{[\s\S]*?position:\s*fixed/,
  'toggle is position:fixed outside topbar stacking context'
);
assert.match(
  css,
  /@media \(min-width:\s*961px\)[\s\S]*?admin-app--nav-closed \.admin-sidebar[\s\S]*?display:\s*none/,
  'desktop close hides the whole sidebar panel'
);
assert.match(
  css,
  /\.admin-app\s+\.admin-sidebar\s*\{[\s\S]*?transform:\s*translateX\(-110%\)/,
  'LTR closed drawer slides off to the left'
);
assert.match(
  css,
  /\[dir=['\"]rtl['\"]\]\s+\.admin-app\s+\.admin-sidebar[\s\S]*?transform:\s*translateX\(110%\)/,
  'RTL closed drawer slides off to the right (FA start edge)'
);
assert.match(
  css,
  /\.admin-app\s+\.admin-sidebar\.is-open[\s\S]*?transform:\s*translateX\(0\)/,
  'open drawer at translateX(0)'
);

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
