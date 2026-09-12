/**
 * Landing Lighthouse guards — TBT / LCP / FCP / a11y weights / agentic llms.txt.
 * Run: npx tsx packages/web/src/lib/webPerf.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = join(webSrc, '..');
const repoRoot = join(webRoot, '../..');

const indexHtml = readFileSync(join(webRoot, 'index.html'), 'utf8');
const vite = readFileSync(join(webRoot, 'vite.config.ts'), 'utf8');
const main = readFileSync(join(webSrc, 'main.tsx'), 'utf8');
const analytics = readFileSync(join(webSrc, 'lib/siteAnalytics.ts'), 'utf8');
const welcome = readFileSync(join(webSrc, 'pages/WelcomePage.tsx'), 'utf8');
const below = readFileSync(join(webSrc, 'pages/WelcomeBelowFold.tsx'), 'utf8');
const llms = readFileSync(join(webRoot, 'public/llms.txt'), 'utf8');
const llmsFull = readFileSync(join(webRoot, 'public/llms-full.txt'), 'utf8');

assert.match(indexHtml, /mobile-web-app-capable/, 'modern PWA meta is present');
assert.match(indexHtml, /apple-mobile-web-app-capable/, 'legacy iOS meta kept beside the modern one');
const viewportMeta = indexHtml.match(/<meta[\s\S]*?name="viewport"[\s\S]*?>/)?.[0] || '';
assert.match(viewportMeta, /width=device-width/, 'viewport meta exists');
assert.doesNotMatch(
  indexHtml,
  /user-scalable|maximum-scale/,
  'served index must not mention zoom locks anywhere (meta or scripts)'
);
assert.match(indexHtml, /pd-critical-first-paint/, 'inline critical CSS kills the white filmstrip');
assert.match(indexHtml, /timeout: 8000/, 'GTM waits for interaction or long idle (TBT 30%)');
assert.doesNotMatch(
  indexHtml,
  /rel="preload"\s+as="style"/,
  'do not preload the Google Fonts CSS (unused-preload warning)'
);
assert.match(indexHtml, /web-perf-v20-agentic/, 'deploy marker bumped so SW/HTML cache misses');

assert.match(vite, /sourcemap:\s*true/, 'production source maps for large first-party JS');
assert.match(vite, /vendor-lucide/, 'lucide stays in its own chunk');
assert.match(vite, /resolveDependencies/, 'lucide is not modulepreloaded');
assert.match(vite, /petdate-defer-css/, 'hashed CSS is deferred off first paint');

assert.doesNotMatch(main, /styles\/chat\.css/, 'chat.css is not on the landing CSS graph');
assert.match(analytics, /scheduleAfterLoadIdle/, 'third-party tags wait for load+idle');
assert.match(analytics, /timeoutMs = 8000/, 'Clarity/GA4 use the long-idle budget');
assert.match(analytics, /s\.onerror/, 'Clarity 400/blocked must not retry');

assert.match(welcome, /role="region"/, 'hero carousel has an explicit role (aria-roledescription)');
assert.doesNotMatch(welcome, /role="tablist"|role="tab"/, 'landing dots are not invalid tabs');
assert.match(welcome, /width=\{1600\}/, 'hero img has intrinsic dimensions (CLS)');
assert.match(welcome, /hero-playmate-800\.webp/, 'mobile LCP is the 800w WebP');
assert.match(welcome, /WelcomeBelowFold/, 'below-fold is code-split off the TBT path');
assert.doesNotMatch(welcome, /from 'lucide-react'/, 'hero path does not parse lucide-react');
assert.doesNotMatch(welcome, /magazineApi/, 'welcome critical path does not fetch magazine');
assert.match(below, /magazineApi/, 'magazine fetch stays on the below-fold chunk');
assert.match(below, /role="img"/, 'review stars have a role so aria-label is allowed');
assert.match(below, /pepito-news-nav" role="group"/, 'news nav is not a generic labeled div');

/** Same three checks as GoogleChrome/lighthouse core/audits/agentic/llms-txt.js */
function assertLighthouseLlmsTxt(content: string, label: string) {
  const hasH1 = /^\s*#\s+.+/m.test(content);
  const hasLink = /\[.+\]\(.+\)/.test(content);
  const isTooShort = content.length < 50;
  assert.ok(hasH1, `${label} fails Lighthouse hasH1 (/^\\s*#\\s+.+/m)`);
  assert.ok(hasLink, `${label} fails Lighthouse hasLink (/\\[.+\\]\\(.+\\)/)`);
  assert.ok(!isTooShort, `${label} fails Lighthouse isTooShort (length < 50)`);
  const stripped = content.replace(/\[[^\]]*\]\([^)]+\)/g, '');
  assert.doesNotMatch(stripped, /https?:\/\//, `${label} still has a bare URL outside markdown links`);
  assert.doesNotMatch(content, /\[https?:\/\//, `${label} must not use a URL as markdown link text`);
  assert.doesNotMatch(content, /Website:\s*https?:\/\//, `${label} must not use Website: plus a bare URL`);
}

assertLighthouseLlmsTxt(llms, 'llms.txt');
assertLighthouseLlmsTxt(llmsFull, 'llms-full.txt');

const nginx = readFileSync(join(repoRoot, 'infra/nginx/petdate.conf'), 'utf8');
assert.match(nginx, /location = \/llms\.txt/, 'nginx serves /llms.txt outside the no-store catch-all');
assert.match(
  nginx,
  /location = \/llms\.txt \{[\s\S]*?Cache-Control "public, max-age=86400"/,
  'llms.txt stays cacheable so the 2s agentic fetch (#17082) can complete'
);

console.log('webPerf.selftest: ok');
