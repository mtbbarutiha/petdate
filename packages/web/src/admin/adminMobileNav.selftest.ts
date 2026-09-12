/**
 * Guard: admin hamburger fully closes the panel (not just labels),
 * close control lives in the sidebar brand row (not a topbar logo strip),
 * reopen is a muted topbar icon when the panel is hidden, and the mobile
 * drawer stays usable. Menu ↔ X state is obvious.
 * Run: npx tsx packages/web/src/admin/adminMobileNav.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const layout = readFileSync(join(webRoot, 'admin/AdminLayout.tsx'), 'utf8');
const css = readFileSync(join(webRoot, 'styles/admin.css'), 'utf8');
const dark = readFileSync(join(webRoot, 'styles/theme-dark.css'), 'utf8');

assert.match(layout, /navOpen/, 'AdminLayout tracks navOpen');
assert.match(layout, /setNavOpen\(\(v\) => !v\)/, 'hamburger toggles navOpen');
assert.match(layout, /admin-nav-toggle/, 'hamburger/close toggle present');
assert.match(layout, /admin-brand-row/, 'sidebar has a standard brand header row');
assert.match(layout, /admin-nav-toggle--reopen/, 'closed state reopen lives in the topbar');
assert.doesNotMatch(layout, /admin-topbar-wordmark/, 'no second wordmark strip in the page header');
assert.match(layout, /admin-backdrop/, 'backdrop dismiss present');
assert.match(layout, /aria-expanded=\{navOpen\}/, 'toggle exposes aria-expanded');
assert.match(layout, /admin-app--nav-open/, 'open state class on shell');
assert.match(layout, /admin-app--nav-closed/, 'closed state class on shell');
assert.match(layout, /Escape/, 'Escape closes mobile nav');
assert.match(layout, /document\.body\.style\.overflow/, 'body scroll lock while open');
assert.match(layout, /if \(isMobileNav\) setNavOpen\(false\)/, 'route change closes overlay drawer');
assert.match(layout, /navOpen \? <X /, 'open state shows close X');
assert.match(layout, /<Menu /, 'closed state shows hamburger');
assert.doesNotMatch(layout, /admin-icon-btn--mobile/, 'legacy topbar-only mobile button is gone');
assert.doesNotMatch(layout, /setCollapsed/, 'icon-rail collapse is no longer the close action');

const brandRowIdx = layout.indexOf('admin-brand-row');
const toggleIdx = layout.indexOf('admin-nav-toggle');
const topbarIdx = layout.indexOf('className="admin-topbar"');
const reopenIdx = layout.indexOf('admin-nav-toggle--reopen');
assert.ok(brandRowIdx >= 0 && toggleIdx > brandRowIdx && toggleIdx < topbarIdx, 'close toggle is inside the sidebar brand row');
assert.ok(reopenIdx > topbarIdx, 'reopen hamburger is in the page topbar, only when nav is closed');
assert.match(layout, /!navOpen \? \(/, 'topbar reopen renders only while the sidebar is hidden');

assert.match(css, /\.admin-app\s+\.admin-nav-toggle\s*\{/, 'toggle styles exist');
assert.match(css, /\.admin-app\s+\.admin-brand-row\s*\{/, 'sidebar brand row is a flex header');
assert.match(
  css,
  /\.admin-app\s+\.admin-nav-toggle\s*\{[^}]*position:\s*relative/,
  'toggle stays in document flow (not position:fixed)'
);
assert.doesNotMatch(
  css,
  /\.admin-app\s+\.admin-nav-toggle\s*\{[^}]*position:\s*fixed/,
  'toggle is not a fixed slab on the sidebar seam'
);
assert.doesNotMatch(css, /inset-inline-start:\s*calc\(264px/, 'toggle is not parked on the sidebar border');
assert.doesNotMatch(css, /admin-topbar-wordmark/, 'no leftover topbar wordmark chrome');
assert.match(
  css,
  /@media \(max-width:\s*640px\)[\s\S]*?admin-topbar-eyebrow[\s\S]*?display:\s*none/,
  'narrow RTL topbar hides the eyebrow so the reopen hamburger stays on-screen'
);
assert.match(
  css,
  /@media \(max-width:\s*640px\)[\s\S]*?admin-live-pulse\.admin-topbar-chip[\s\S]*?display:\s*none/,
  'narrow topbar hides the live chip (overrides later inline-flex)'
);
assert.match(
  css,
  /@media \(min-width:\s*961px\)[\s\S]*?admin-app--nav-closed \.admin-sidebar[\s\S]*?display:\s*none/,
  'desktop close hides the whole sidebar panel'
);
assert.doesNotMatch(
  dark,
  /\.admin-nav-toggle\.is-open\s*\{[\s\S]*?background:\s*#f4f1ff/,
  'dark open state is not a bright white fill'
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
