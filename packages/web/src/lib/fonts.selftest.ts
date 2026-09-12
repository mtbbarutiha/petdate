/**
 * UI font stack is self-hosted Vazirmatn (SIL OFL 1.1) — no Google Fonts / Urbanist.
 * Run: npx tsx packages/web/src/lib/fonts.selftest.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = join(webSrc, '..');
const repoRoot = join(webRoot, '../..');

const indexHtml = readFileSync(join(webRoot, 'index.html'), 'utf8');
const globalCss = readFileSync(join(webSrc, 'styles/global.css'), 'utf8');
const pepitoCss = readFileSync(join(webSrc, 'styles/pepito.css'), 'utf8');
const adminCss = readFileSync(join(webSrc, 'styles/admin.css'), 'utf8');
const woff2 = join(webRoot, 'public/fonts/Vazirmatn-Variable.woff2');
const ofl = join(webRoot, 'public/fonts/Vazirmatn-OFL.txt');
const apiOfl = join(repoRoot, 'packages/api/assets/fonts/Vazirmatn-OFL.txt');

assert.ok(existsSync(woff2), 'Vazirmatn variable woff2 is committed');
assert.ok(statSync(woff2).size > 80_000, 'woff2 is a real variable face, not a stub');
assert.equal(readFileSync(woff2).subarray(0, 4).toString('ascii'), 'wOF2', 'file is woff2');

assert.ok(existsSync(ofl), 'web Vazirmatn OFL is committed');
assert.match(readFileSync(ofl, 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/, 'OFL 1.1 text');
assert.ok(existsSync(apiOfl), 'API Vazirmatn OFL is committed');

assert.match(indexHtml, /--font-sans:/, 'critical CSS defines --font-sans');
assert.match(indexHtml, /font-family:var\(--font-sans\)/, 'body uses --font-sans');
assert.match(indexHtml, /font-display:swap/, 'swap to limit FOIT');
assert.doesNotMatch(indexHtml, /fonts\.googleapis\.com|fonts\.gstatic\.com/, 'no Google Fonts preconnect/CSS');
assert.doesNotMatch(indexHtml, /Urbanist/, 'no Urbanist competing stack');

assert.match(globalCss, /--font-sans:\s*'Vazirmatn'/, 'global --font-sans is Vazirmatn');
assert.match(globalCss, /--font-display:\s*var\(--font-sans\)/, 'headings share --font-sans');
assert.match(globalCss, /--font-body:\s*var\(--font-sans\)/, 'body shares --font-sans');
assert.doesNotMatch(globalCss, /Urbanist|fonts\.googleapis/, 'global.css has no leftover stack');

assert.match(pepitoCss, /--font-sans:\s*'Vazirmatn'/, 'pepito tokens use Vazirmatn');
assert.match(pepitoCss, /--font-display:\s*var\(--font-sans\)/, 'pepito headings use --font-sans');
assert.doesNotMatch(pepitoCss, /Urbanist/, 'pepito has no Urbanist');

assert.doesNotMatch(adminCss, /fonts\.googleapis/, 'admin does not @import Google Fonts');
assert.match(adminCss, /--admin-font:\s*var\(--font-sans/, 'admin chrome uses --font-sans');
assert.match(adminCss, /--admin-display:\s*var\(--admin-font\)/, 'admin headings match body');

console.log('fonts.selftest: ok');
