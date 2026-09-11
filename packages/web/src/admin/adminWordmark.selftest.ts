/**
 * Guard: admin wordmark uses لوگو مادر (SiteLogo), not PD initials squircle.
 * Run: npx tsx packages/web/src/admin/adminWordmark.selftest.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const wordmark = readFileSync(join(webRoot, 'src/admin/AdminWordmark.tsx'), 'utf8');
const css = readFileSync(join(webRoot, 'src/styles/admin.css'), 'utf8');
const motherLogo = join(webRoot, 'public/pepito/img/logo.png');
const markCrop = join(webRoot, 'public/brand/petdate-mark.png');

assert.match(wordmark, /SITE_LOGO_SRC/, 'AdminWordmark imports SITE_LOGO_SRC (لوگو مادر)');
assert.match(wordmark, /admin-wordmark-logo/, 'renders mother logo img class');
assert.match(wordmark, /petdate-mark\.png/, 'collapsed sidebar uses mark crop from mother');
assert.doesNotMatch(
  wordmark,
  />\s*PD\s*</,
  'no PD initials text avatar in AdminWordmark'
);
assert.doesNotMatch(css, /\.admin-wordmark-mark\s*\{/, 'PD squircle CSS removed');
assert.match(css, /\.admin-wordmark-logo/, 'mother logo CSS present');
assert.match(css, /\.admin-wordmark-collapsed-mark/, 'collapsed mark CSS present');
assert.ok(existsSync(motherLogo), 'لوگو مادر asset exists at public/pepito/img/logo.png');
assert.ok(existsSync(markCrop), 'mark crop exists at public/brand/petdate-mark.png');

console.log('adminWordmark.selftest: ok');
