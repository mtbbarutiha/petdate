/**
 * Landing Lighthouse guards — TBT / unused preloads / a11y-tree / agentic llms.txt.
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
const llms = readFileSync(join(webRoot, 'public/llms.txt'), 'utf8');
const llmsFull = readFileSync(join(webRoot, 'public/llms-full.txt'), 'utf8');

assert.match(indexHtml, /mobile-web-app-capable/, 'modern PWA meta is present');
assert.match(indexHtml, /apple-mobile-web-app-capable/, 'legacy iOS meta kept beside the modern one');
assert.doesNotMatch(
  indexHtml,
  /user-scalable=no|maximum-scale=1/,
  'viewport must allow pinch-zoom (Lighthouse a11y + best practices)'
);
assert.match(indexHtml, /requestIdleCallback/, 'GTM snippet delays gtm.js until idle');
assert.doesNotMatch(
  indexHtml,
  /rel="preload"\s+as="style"/,
  'do not preload the Google Fonts CSS (unused-preload warning)'
);
assert.match(indexHtml, /web-perf-v18-lighthouse/, 'deploy marker bumped');

assert.match(vite, /sourcemap:\s*true/, 'production source maps for large first-party JS');
assert.match(vite, /vendor-lucide/, 'lucide stays in its own chunk');
assert.match(vite, /resolveDependencies/, 'lucide is not modulepreloaded');

assert.doesNotMatch(main, /styles\/chat\.css/, 'chat.css is not on the landing CSS graph');
assert.match(analytics, /scheduleAfterLoadIdle/, 'third-party tags wait for load+idle');
assert.match(analytics, /s\.onerror/, 'Clarity 400/blocked must not retry');

assert.match(welcome, /role="region"/, 'hero carousel has an explicit role (aria-roledescription)');
assert.doesNotMatch(welcome, /role="tablist"|role="tab"/, 'landing dots are not invalid tabs');
assert.match(welcome, /width=\{1600\}/, 'hero img has intrinsic dimensions');
assert.match(welcome, /from '\.\.\/lib\/magazineApi'/, 'welcome does not import MagazinePage.tsx');

assert.match(llms, /^# /m, 'llms.txt has an H1');
assert.match(llms, /\[[^\]]+\]\(https:\/\/petdate\.ir\/\)/, 'llms.txt uses markdown links (Lighthouse parser)');
assert.ok(llms.length > 50, 'llms.txt is not suspiciously short');
assert.match(llmsFull, /\[[^\]]+\]\(https:\/\/petdate\.ir\/\)/, 'llms-full.txt uses markdown links');

const nginx = readFileSync(join(repoRoot, 'infra/nginx/petdate.conf'), 'utf8');
assert.match(nginx, /location = \/llms\.txt/, 'nginx serves /llms.txt outside the no-store catch-all');

console.log('webPerf.selftest: ok');
