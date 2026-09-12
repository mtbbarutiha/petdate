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
const appTsx = readFileSync(join(webSrc, 'App.tsx'), 'utf8');
const welcome = readFileSync(join(webSrc, 'pages/WelcomePage.tsx'), 'utf8');
const vetRoute = readFileSync(join(webSrc, 'pages/VetConsultRoute.tsx'), 'utf8');
const below = readFileSync(join(webSrc, 'pages/WelcomeBelowFold.tsx'), 'utf8');
const llms = readFileSync(join(webRoot, 'public/llms.txt'), 'utf8');
const llmsFull = readFileSync(join(webRoot, 'public/llms-full.txt'), 'utf8');
const robots = readFileSync(join(webRoot, 'public/robots.txt'), 'utf8');

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
assert.match(indexHtml, /setTimeout\(run, 10000\)/, 'GTM waits for interaction or 10s — not first idle');
assert.doesNotMatch(indexHtml, /requestIdleCallback/, 'GTM must not use requestIdleCallback (fires on first idle)');
assert.doesNotMatch(
  indexHtml,
  /\['pointerdown', 'keydown', 'touchstart', 'scroll'\]/,
  'GTM must not arm on scroll (Lighthouse emits scroll during load)'
);
assert.match(indexHtml, /Vazirmatn Fallback/, 'critical CSS ships font fallback metrics (CLS)');
assert.match(indexHtml, /Vazirmatn-Variable\.woff2/, 'critical CSS self-hosts Vazirmatn woff2');
assert.match(indexHtml, /font-display:swap/, 'self-hosted face uses font-display:swap');
assert.doesNotMatch(indexHtml, /fonts\.googleapis\.com|fonts\.gstatic\.com/, 'no Google Fonts on the public shell');
assert.doesNotMatch(indexHtml, /Urbanist/, 'Urbanist is not a competing UI face');
assert.match(indexHtml, /pepito-hero-inner/, 'critical CSS reserves hero-inner (CLS)');
assert.match(
  indexHtml,
  /100svh - var\(--pepito-nav-h\) - var\(--pepito-dock-clearance\)/,
  'critical mobile hero ends at the dock (no peek under the pill)'
);
assert.match(
  indexHtml,
  /88svh - var\(--pepito-nav-h\)/,
  'critical desktop hero uses compact 88svh (not a 93svh dark void)'
);
assert.match(
  indexHtml,
  /\.pepito-hero\{[^}]*hero-playmate-800\.webp/,
  'critical hero paints the preloaded playmate WebP on the box itself'
);
assert.match(
  indexHtml,
  /@media \(min-width:860px\)\{[\s\S]*?\.pepito-landing--with-dock\{padding-bottom:0\}/,
  'critical CSS drops dock clearance on desktop'
);
assert.doesNotMatch(
  indexHtml,
  /\.pepito-hero\{min-height:calc\(100svh/,
  'critical CSS must not over-reserve a raw 100svh hero min-height'
);
assert.match(indexHtml, /pepito-hero-dot\{width:44px/, 'critical CSS reserves 44px hero dots');
assert.match(indexHtml, /rel="preload"[\s\S]*hero-playmate-800\.webp/, 'LCP image is preload-discovered from HTML');
assert.match(indexHtml, /id="root">[\s\S]*pepito-hero-inner/, 'static hero copy shell is in #root for FCP');
assert.match(indexHtml, /id="pd-boot-lcp"[\s\S]*id="root"/, 'LCP img precedes #root so React cannot replace it');
assert.match(indexHtml, /rel="alternate" type="text\/plain" href="https:\/\/petdate\.ir\/llms\.txt"/, 'HTML advertises llms.txt');
assert.doesNotMatch(indexHtml, /rel="preconnect" href="https:\/\/fonts/, 'no unused gstatic/googleapis preconnect');
assert.doesNotMatch(
  indexHtml,
  /rel="preload"\s+as="style"/,
  'do not preload a stylesheet (unused-preload warning)'
);
assert.match(indexHtml, /web-perf-v29-hero-dock/, 'deploy marker bumped so SW/HTML cache misses');
assert.match(indexHtml, /id="pd-boot-lcp"/, 'LCP img lives outside #root so React cannot replace it');
assert.match(indexHtml, /id="pd-boot-lcp"[\s\S]*decoding="sync"/, 'LCP img decodes sync so main-thread JS cannot stall paint');
assert.match(indexHtml, /data-pd-lcp="hero"/, 'static preload is marked so SEO inject does not duplicate it');
assert.equal(
  (indexHtml.match(/data-pd-lcp="hero"/g) || []).length,
  1,
  'index.html ships exactly one marked LCP preload'
);
assert.match(
  indexHtml,
  /rel="preload"[^>]+href="\/fonts\/Vazirmatn-Variable\.woff2"[^>]+as="font"/,
  'preload the same-origin UI font'
);
assert.match(indexHtml, /\.pepito-faq-item,\s*\.pepito-help-card/, 'critical CSS covers FAQ/help cards');
assert.match(indexHtml, /html\.theme-light \.pepito-faq-item/, 'critical CSS has light FAQ overrides');

assert.match(vite, /sourcemap:\s*true/, 'production source maps for large first-party JS');
assert.match(vite, /vendor-lucide/, 'lucide stays in its own chunk');
assert.match(vite, /vendor-tiptap/, '@tiptap/react must not share vendor-react');
assert.match(vite, /@tiptap/, 'tiptap matcher runs before /react/');
assert.match(vite, /resolveDependencies/, 'lucide is not modulepreloaded');
assert.match(vite, /petdate-defer-css/, 'hashed CSS is deferred off first paint');
assert.match(vite, /pd-defer-css-fallback/, 'deferred CSS has a load fallback');
assert.match(vite, /onload="this.media='all'"/, 'hashed CSS applies as soon as it loads');
assert.doesNotMatch(vite, /setTimeout\(inject,\s*8000\)/, 'must not wait 8s before painting CSS');

assert.doesNotMatch(main, /styles\/chat\.css/, 'chat.css is not on the landing CSS graph');
assert.match(analytics, /scheduleAfterLoadIdle/, 'third-party tags wait for load+idle');
assert.match(analytics, /timeoutMs = 10000/, 'Clarity/GA4 wait for input or 10s (not first idle)');
assert.doesNotMatch(analytics, /requestIdleCallback/, 'analytics must not use requestIdleCallback');
assert.match(analytics, /Do not listen for scroll/, 'analytics idle arm skips scroll');
assert.match(analytics, /s\.onerror/, 'Clarity 400/blocked must not retry');
assert.match(appTsx, /import\('\.\/lib\/siteAnalytics'\)/, 'analytics chunk is dynamically imported');
assert.match(appTsx, /useAfterFirstInput/, 'analytics import waits for input or 10s');
assert.match(appTsx, /DeferredLandingDock/, 'mobile dock is not on the first-paint graph');
assert.doesNotMatch(appTsx, /import \{[^}]*trackPageview/, 'index chunk must not statically import trackPageview');
assert.doesNotMatch(appTsx, /import \{ LoginPage \}/, 'login is lazy so lucide stays off landing');
assert.match(vetRoute, /const VetConsultLandingPage = lazy/, 'vet landing is lazy so lucide leaves /');

assert.match(welcome, /role="region"/, 'hero carousel has an explicit role (aria-roledescription)');
assert.doesNotMatch(welcome, /role="tablist"|role="tab"/, 'landing dots are not invalid tabs');
assert.match(welcome, /width=\{1600\}/, 'hero img has intrinsic dimensions (CLS)');
assert.match(welcome, /hero-playmate-800\.webp/, 'mobile LCP is the 800w WebP');
assert.match(welcome, /WelcomeBelowFold/, 'below-fold is code-split off the TBT path');
assert.match(welcome, /showBelowFold/, 'below-fold waits for intersection/input (lucide off critical path)');
assert.doesNotMatch(welcome, /addEventListener\('scroll', load/, 'below-fold must not arm on scroll');
assert.doesNotMatch(welcome, /key=\{current\.role\}/, 'hero-inner must not remount per slide (CLS)');
assert.doesNotMatch(welcome, /from 'lucide-react'/, 'hero path does not parse lucide-react');
assert.doesNotMatch(welcome, /magazineApi/, 'welcome critical path does not fetch magazine');
assert.match(welcome, /logo-390\.webp/, 'nav logo is 390w so 2x density passes');
assert.match(welcome, /pd-boot-lcp/, 'HTML LCP img is parked after hydrate');
assert.match(welcome, /classList\.add\('is-parked'\)/, 'boot LCP is parked so it cannot cover/hide the hero');
assert.match(welcome, /i === slide \?/, 'every active slide including 0 renders an in-hero photo');
assert.doesNotMatch(welcome, /i !== 0/, 'slide 0 must mint an in-hero <img> (out-of-root LCP painted a black band)');
assert.doesNotMatch(welcome, /appendChild\(img\)/, 'must not move the LCP node (causes render delay)');
assert.match(
  indexHtml,
  /body>#pd-boot-lcp\{position:absolute;[^}]*z-index:1/,
  'critical CSS keeps the HTML LCP in document flow above #root fill'
);
assert.match(below, /magazineApi/, 'magazine fetch stays on the below-fold chunk');
assert.match(below, /svcIndex === 0/, 'service carousel skips sync layout on mount');
assert.match(below, /ResizeObserver/, 'carousel step is measured off the React commit path');
assert.doesNotMatch(below, /getComputedStyle/, 'carousel must not force-reflow via getComputedStyle');
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
assert.match(nginx, /location = \/\.well-known\/llms\.txt/, 'well-known/llms.txt aliases the same file');
assert.match(nginx, /location \^~ \/media\/lcp\//, 'LCP media has its own long-cache location');
assert.match(llms, /Roles/, 'llms.txt documents product roles for agents');
assert.match(llms, /پت‌دیت/, 'llms.txt includes Persian product name');
assert.match(robots, /Allow: \/llms\.txt/, 'robots.txt advertises llms.txt');

const pepitoCss = readFileSync(join(webSrc, 'styles/pepito.css'), 'utf8');
assert.match(pepitoCss, /body > #pd-boot-lcp \{[\s\S]*?position:\s*absolute/, 'hydrated boot LCP is absolute, not viewport-fixed');
assert.match(pepitoCss, /body > #pd-boot-lcp \{[\s\S]*?z-index:\s*1/, 'hydrated boot LCP paints above landing fill');
assert.match(
  pepitoCss,
  /\.pepito-hero \{[\s\S]*?hero-playmate-800\.webp/,
  'hydrated hero paints the playmate WebP on the box'
);
assert.match(pepitoCss, /--pepito-btn-1-bg:\s*#5c4d91/, 'button-1 fill stays AA vs white');
assert.match(pepitoCss, /--pepito-btn-3-bg:\s*#a24a86/, 'button-3 fill is darkened pink for AA');
assert.match(
  pepitoCss,
  /100svh - var\(--pepito-nav-h\) - var\(--pepito-mobile-dock-clearance\)/,
  'hydrated mobile hero ends at the dock clearance'
);
assert.match(pepitoCss, /88svh - var\(--pepito-nav-h\)/, 'desktop hero stays the compact 88svh band');
assert.doesNotMatch(
  pepitoCss,
  /--pepito-hero-h:\s*calc\(100svh\s*-\s*var\(--pepito-nav-h\)\)/,
  'mobile hero must subtract dock clearance, not only nav'
);
assert.match(
  pepitoCss,
  /@media \(min-width: 860px\) \{[\s\S]*?\.pepito-landing--with-dock \{[\s\S]*?padding-bottom:\s*0/,
  'desktop landing drops dock clearance'
);
assert.match(
  pepitoCss,
  /\.pepito-about \{[\s\S]*?background:\s*var\(--pepito-white\)/,
  'about section is a distinct surface under the hero'
);
assert.match(pepitoCss, /\.pepito-hero-dot \{\s*width: 44px/, 'hero dots are 44px targets (no overlapping ::before)');
assert.doesNotMatch(welcome, /animation:\s*pepito-rise/, 'hero-inner no longer uses pepito-rise');

const reviewFrameBlock = pepitoCss.match(/\.pepito-review-img-frame \{[^}]+\}/)?.[0] || '';
assert.match(reviewFrameBlock, /aspect-ratio:\s*1\s*\/\s*1/, 'review photos use short 1:1 crop');
assert.doesNotMatch(reviewFrameBlock, /max-height/, 'review frames stay full-width (no thumb cap)');
const memberPhotoBlock = pepitoCss.match(/\.pepito-member-photo \{[^}]+\}/)?.[0] || '';
assert.match(memberPhotoBlock, /aspect-ratio:\s*1\s*\/\s*1/, 'team photos use short 1:1 crop');
assert.doesNotMatch(memberPhotoBlock, /max-height/, 'team frames stay full-width (no thumb cap)');
const reviewImgBlock = pepitoCss.match(/\.pepito-review-img img \{[^}]+\}/)?.[0] || '';
assert.match(reviewImgBlock, /object-fit:\s*cover/, 'review imgs cover the short frame');
assert.doesNotMatch(reviewImgBlock, /aspect-ratio:\s*900/, 'review imgs must not keep the 3:2 box');
const memberImgBlock = pepitoCss.match(/\.pepito-member img \{[^}]+\}/)?.[0] || '';
assert.match(memberImgBlock, /object-fit:\s*cover/, 'team imgs cover the short frame');
assert.doesNotMatch(memberImgBlock, /aspect-ratio:\s*600/, 'team imgs must not keep the 6:7 poster crop');
assert.match(below, /width=\{600\} height=\{600\}/, 'below-fold photo attrs match 1:1 reserve');

const header = readFileSync(join(webSrc, 'components/SiteHeader.tsx'), 'utf8');
const themeToggle = readFileSync(join(webSrc, 'components/ThemeToggle.tsx'), 'utf8');
const navCluster = readFileSync(join(webSrc, 'components/NavUserCluster.tsx'), 'utf8');
const toast = readFileSync(join(webSrc, 'hooks/useAppToast.tsx'), 'utf8');
assert.doesNotMatch(header, /from 'lucide-react'/, 'SiteHeader must not parse lucide');
assert.doesNotMatch(themeToggle, /from 'lucide-react'/, 'ThemeToggle must not parse lucide');
assert.doesNotMatch(navCluster, /from 'lucide-react'/, 'guest nav cluster must not parse lucide');
assert.doesNotMatch(toast, /from 'lucide-react'/, 'toast host must not pull lucide onto landing');

console.log('webPerf.selftest: ok');
