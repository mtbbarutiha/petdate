/**
 * Guard: admin login icon fields keep an RTL-safe text gutter.
 * Physical `right` / `padding-right` plus the admin .form-input padding
 * reset caused username/password placeholders to collide with the icon.
 * Run: npx tsx packages/web/src/admin/adminLoginInputIcon.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const login = readFileSync(join(webRoot, 'admin/pages/AdminLoginPage.tsx'), 'utf8');
const globalCss = readFileSync(join(webRoot, 'styles/global.css'), 'utf8');
const adminCss = readFileSync(join(webRoot, 'styles/admin.css'), 'utf8');

assert.match(login, /className="admin-input-icon"/, 'login uses shared icon-field wrapper');
assert.match(login, /<User size=\{16\} aria-hidden="true"/, 'username icon is decorative');
assert.match(login, /<Lock size=\{16\} aria-hidden="true"/, 'password icon is decorative');

const iconBlock = globalCss.match(/\.admin-input-icon\s*\{[\s\S]*?\.admin-input-icon \.form-input\s*\{[^}]+\}/);
assert.ok(iconBlock, 'shared admin-input-icon control is defined');
assert.match(iconBlock[0], /--admin-input-icon-gutter:/, 'shared control exposes an icon gutter token');
assert.match(iconBlock[0], /inset-inline-end:/, 'icon is pinned to inline-end (left in RTL, right in LTR)');
assert.match(iconBlock[0], /padding-inline-end:\s*var\(--admin-input-icon-gutter/, 'input reserves inline-end gutter');
assert.match(iconBlock[0], /pointer-events:\s*none/, 'icon does not steal clicks from the input');
assert.doesNotMatch(iconBlock[0], /(?<![-\w])right:\s*\d/, 'icon must not use physical right (breaks RTL)');
assert.doesNotMatch(iconBlock[0], /padding-right:/, 'gutter must be logical, not padding-right');

assert.doesNotMatch(
  adminCss,
  /\.admin-app \.form-input,\s*\.admin-app \.admin-input-icon \.form-input\s*\{[^}]*padding:\s*11px 12px/,
  'admin theme must not reset icon-field padding back to 12px',
);
assert.match(
  adminCss,
  /\.admin-app \.admin-input-icon \.form-input\s*\{[^}]*padding-inline-end:\s*var\(--admin-input-icon-gutter/,
  'admin theme keeps the shared icon gutter on .form-input',
);
assert.match(
  adminCss,
  /\.admin-app \.admin-input-icon svg\s*\{[^}]*inset-inline-end:/,
  'admin theme keeps icon on inline-end',
);
assert.match(
  adminCss,
  /\.admin-app \.admin-input-icon svg\s*\{[^}]*color:\s*var\(--admin-muted\)/,
  'admin icon color follows theme tokens (light + dark)',
);
assert.match(
  adminCss,
  /\.admin-app \.form-input\s*\{[^}]*padding:\s*11px 12px/,
  'plain admin .form-input padding is unchanged',
);

console.log('adminLoginInputIcon.selftest: ok');
