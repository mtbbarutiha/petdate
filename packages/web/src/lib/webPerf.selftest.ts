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
assert.match(viewportMeta, /initial-scale\s*=\s*1/, 'viewport sets initial-scale=1');
assert.doesNotMatch(
  viewportMeta,
  /user-scalable\s*=\s*no/,
  'viewport must not disable pinch-zoom (Lighthouse meta-viewport / a11y)'
);
assert.doesNotMatch(
  viewportMeta,
  /maximum-scale\s*=\s*[0-4](?:\s|,|$)/,
  'viewport must not set maximum-scale < 5 (Lighthouse meta-viewport)'
);
const globalCss = readFileSync(join(webSrc, 'styles/global.css'), 'utf8');
assert.match(globalCss, /html\s*\{[\s\S]*?touch-action:\s*manipulation/, 'html disables double-tap zoom');
assert.match(globalCss, /body\s*\{[\s\S]*?touch-action:\s*manipulation/, 'body disables double-tap zoom');
assert.match(main, /gesturestart/, 'iOS gesturestart zoom is blocked in main');
assert.match(main, /gesturechange/, 'iOS gesturechange zoom is blocked in main');
const androidMain = readFileSync(
  join(repoRoot, 'android/app/src/main/java/ir/petdate/app/MainActivity.java'),
  'utf8'
);
assert.match(androidMain, /setSupportZoom\(false\)/, 'Android WebView disables pinch zoom');
assert.match(androidMain, /setBuiltInZoomControls\(false\)/, 'Android WebView hides built-in zoom');
const wwwIndex = readFileSync(join(repoRoot, 'www/index.html'), 'utf8');
assert.match(wwwIndex, /maximum-scale\s*=\s*1/, 'Capacitor www viewport locks zoom');
assert.match(wwwIndex, /user-scalable\s*=\s*no/, 'Capacitor www disables user scaling');
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
assert.match(indexHtml, /font-display:optional/, 'self-hosted face uses font-display:optional (CLS)');
assert.doesNotMatch(indexHtml, /fonts\.googleapis\.com|fonts\.gstatic\.com/, 'no Google Fonts on the public shell');
assert.doesNotMatch(indexHtml, /Urbanist/, 'Urbanist is not a competing UI face');
assert.match(indexHtml, /pepito-hero-inner/, 'critical CSS reserves hero-inner (CLS)');
assert.match(
  indexHtml,
  /--pepito-hero-h:calc\(100svh - var\(--pepito-nav-h\)\)/,
  'critical mobile hero fills the viewport under the nav (no pink peek under the dock)'
);
assert.match(
  indexHtml,
  /88svh - var\(--pepito-nav-h\)/,
  'critical desktop hero uses compact 88svh (not a 93svh dark void)'
);
assert.match(
  indexHtml,
  /\.pepito-hero\{[^}]*background:#14161e/,
  'critical hero uses solid fill (photo comes from boot LCP / React only)'
);
assert.doesNotMatch(
  indexHtml,
  /\.pepito-hero\{[^}]*hero-playmate-800\.webp/,
  'critical hero must not paint a second static photo under the slide img'
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
assert.match(
  indexHtml,
  /pepito-hero-dot\{box-sizing:content-box;width:10px/,
  'critical CSS uses 10px visual hero dots (padding expands the tap box)'
);
assert.match(indexHtml, /pepito-hero-dots\{[^}]*gap:\.75rem/, 'critical CSS keeps non-overlapping gap between hit boxes');
assert.match(indexHtml, /pepito-hero-dot\{[^}]*padding:17px;margin:0/, 'critical hero dots use 44px pads without negative margin');
assert.match(indexHtml, /is-active::after\{background:#c9bde8/, 'critical active dot is lavender, not white');
assert.match(indexHtml, /scrollbar-gutter:stable/, 'critical CSS reserves scrollbar gutter (CLS)');
assert.match(indexHtml, /id="pd-lock-hero-h"/, 'hero height re-locks after critical CSS');
assert.match(indexHtml, /pepito-nav-section-link\{[^}]*min-height:44px/, 'critical CSS sizes nav section links for touch');
assert.match(
  indexHtml,
  /html\.theme-dark \.pepito-faq-q[^}]*#f4f3f8/,
  'critical dark FAQ questions use AA ink #f4f3f8'
);
assert.match(indexHtml, /rel="preload"[\s\S]*Vazirmatn-Variable\.woff2/, 'font preload remains in HTML');
assert.match(
  indexHtml,
  /<!--pd-lcp-boot-->[\s\S]*?data-pd-lcp="hero"[\s\S]*?<!--\/pd-lcp-boot-->/,
  'initial HTML embeds LCP preload snapshot (admin mutations rewrite the markers)'
);
assert.match(
  indexHtml,
  /id="pd-boot-lcp"[\s\S]*?data-pd-boot-hero="snapshot"/,
  'boot LCP ships a snapshot src so discovery does not wait on /api/hero'
);
assert.doesNotMatch(
  indexHtml,
  /id="pd-boot-lcp"[^>]*src="\/media\/lcp\/hero-/,
  'boot LCP must not ship a hardcoded /media/lcp/hero src (admin SoT URLs)'
);
assert.match(indexHtml, /id="pd-boot-hero-from-api"/, 'boot script refreshes LCP from /api/hero');
assert.match(indexHtml, /fetch\('\/api\/hero'/, 'boot hero script calls the admin-resolved hero API');
assert.match(
  indexHtml,
  /addEventListener\('load',\s*scheduleRefresh\)|readyState === 'complete'\) scheduleRefresh/,
  'boot hero /api/hero waits for window load (not critical-path)'
);
assert.match(
  indexHtml,
  /setTimeout\(refreshFromApi,\s*2000\)/,
  'boot hero refresh is deferred ~2s after load'
);
assert.doesNotMatch(indexHtml, /cache:\s*['"]no-store['"]/, 'boot hero fetch must allow HTTP cache');
assert.match(indexHtml, /id="pd-hero-boot-json"/, 'inlined hero boot JSON for zero-RTT apply');
assert.match(indexHtml, /class="theme-dark"/, 'html defaults to theme-dark before paint (CLS)');
assert.match(
  indexHtml,
  /charset="UTF-8"[\s\S]*?Prevent flash of wrong theme[\s\S]*?Google Tag Manager/,
  'theme script runs before GTM so dark class applies before paint'
);
assert.match(
  indexHtml,
  /\.pepito-nav-logo img\{[^}]*aspect-ratio:390\/114/,
  'critical CSS sizes the logo with aspect-ratio (unsized-image CLS)'
);
assert.match(indexHtml, /id="root">[\s\S]*pepito-hero-inner/, 'static hero copy shell is in #root for FCP');
assert.match(indexHtml, /id="pd-boot-lcp"[\s\S]*id="root"/, 'LCP img precedes #root so React cannot replace it');
assert.match(indexHtml, /rel="alternate" type="text\/plain" href="https:\/\/petdate\.ir\/llms\.txt"/, 'HTML advertises llms.txt');
assert.doesNotMatch(indexHtml, /rel="preconnect" href="https:\/\/fonts/, 'no unused gstatic/googleapis preconnect');
assert.doesNotMatch(
  indexHtml,
  /rel="preload"\s+as="style"/,
  'do not preload a stylesheet (unused-preload warning)'
);
assert.match(indexHtml, /web-perf-v50-cls-a11y/, 'deploy marker bumped so SW/HTML cache misses');
assert.match(
  indexHtml,
  /--pepito-dock-clearance:calc\(96px \+ env\(safe-area-inset-bottom,0px\)\)/,
  'critical CSS dock clearance clears the 58+10 pill plus a gap'
);
assert.match(indexHtml, /id="pd-boot-lcp"/, 'LCP img lives outside #root so React cannot replace it');
assert.match(
  indexHtml,
  /id="pd-boot-lcp"[\s\S]*decoding="async"/,
  'LCP img decodes async so main-thread JS cannot stall paint (render delay)'
);
assert.match(
  indexHtml,
  /id="pd-boot-lcp"[\s\S]*style="[^"]*position:absolute/,
  'boot LCP has inline geometry so paint never waits on hashed CSS'
);
assert.match(
  indexHtml,
  /data-pd-react-owned/,
  'boot scripts refuse to unpark once React owns the LCP node'
);
assert.match(
  indexHtml,
  /data-pd-hero-h-locked/,
  'hero height locks before first paint (CLS)'
);
assert.match(
  indexHtml,
  /body>#pd-boot-lcp,body>#pd-boot-lcp\.pepito-hero-media\{[^}]*inset:auto/,
  'critical CSS overrides hero-media inset so boot LCP keeps hero-band size'
);
assert.match(indexHtml, /name="theme-color" content="#1a1d27"/, 'theme-color matches dark default');
assert.match(indexHtml, /name="color-scheme" content="dark"/, 'color-scheme matches dark default');
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
assert.doesNotMatch(main, /styles\/pepito\.css/, 'pepito CSS is not a static main import (route-lazy)');
assert.doesNotMatch(main, /styles\/global\.css/, 'global CSS is not a static main import (route-lazy)');
assert.doesNotMatch(main, /styles\/theme-dark\.css/, 'theme-dark CSS is not a static main import (route-lazy)');
assert.match(appTsx, /loadAppCss|EnsureAppCss/, 'non-landing routes load app CSS');
assert.match(
  readFileSync(join(webSrc, 'styles/loadAppCss.ts'), 'utf8'),
  /scheduleLandingAppCss/,
  'landing schedules chrome CSS after input/idle'
);
assert.match(
  readFileSync(join(webSrc, 'styles/loadAppCss.ts'), 'utf8'),
  /pepito-shop\.css/,
  'full shop CSS is a separate lazy chunk'
);
assert.match(
  readFileSync(join(webSrc, 'components/shop/ShopChrome.tsx'), 'utf8'),
  /loadShopCss/,
  'ShopChrome loads shop CSS on mount'
);
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
assert.match(welcome, /heroReady/, 'React gates slide photos on hero readiness');
assert.match(welcome, /readBootHeroOverlay|pd-hero-boot-json/, 'React seeds hero from HTML boot snapshot');
assert.match(welcome, /scheduleAfterLoadIdle/, 'React defers /api/hero until after load+idle');
assert.match(welcome, /setTimeout\(go,\s*10000\)/, 'React hero refresh waits 10s or input (not +2s)');
assert.match(welcome, /hero-playmate-800\.webp/, 'offline fallback still knows the default 800w WebP');
assert.match(welcome, /WelcomeBelowFold/, 'below-fold is code-split off the TBT path');
assert.match(welcome, /showBelowFold/, 'below-fold waits for intersection/input (lucide off critical path)');
assert.doesNotMatch(welcome, /addEventListener\('scroll', load/, 'below-fold must not arm on scroll');
assert.doesNotMatch(welcome, /key=\{current\.role\}/, 'hero-inner must not remount per slide (CLS)');
assert.doesNotMatch(welcome, /from 'lucide-react'/, 'hero path does not parse lucide-react');
assert.doesNotMatch(welcome, /magazineApi/, 'welcome critical path does not fetch magazine');
assert.match(welcome, /logo-390\.webp/, 'nav logo is 390w so 2x density passes');
assert.match(welcome, /unparkBootLcp|parkBootLcp/, 'HTML LCP img stays visible on slide 0 then parks on handoff');
assert.match(welcome, /bootHandedOff/, 'boot LCP handoff waits for slide change (no first-paint park)');
assert.match(welcome, /i !== 0 \|\| bootHandedOff/, 'slide 0 uses #pd-boot-lcp until handoff');
assert.match(welcome, /data-pd-hero-h-locked/, 'React must not re-lock hero height after head script');
assert.match(appTsx, /const WelcomePage = lazy/, 'WelcomePage is route-lazy (smaller index entry)');
assert.doesNotMatch(appTsx, /import \{ WelcomePage \}/, 'WelcomePage must not be a static App import');
assert.match(appTsx, /lazy\(\(\) =>\s*import\('\.\/components\/AppDialog'\)/, 'AppDialogHost is lazy off landing entry');
assert.match(appTsx, /lazy\(\(\) =>\s*import\('\.\/components\/FaceVerifyRewardToast'\)/, 'FaceVerify toast is lazy off landing entry');
assert.match(appTsx, /lazy\(\(\) =>\s*import\('\.\/pages\/VetConsultRoute'\)/, 'VetConsultRoute is lazy off landing entry');
assert.doesNotMatch(appTsx, /import \{ AppDialogHost \}/, 'AppDialogHost must not be a static App import');
assert.doesNotMatch(appTsx, /import \{ FaceVerifyRewardToast \}/, 'FaceVerify must not be a static App import');
assert.doesNotMatch(appTsx, /import \{ VetConsultRoute \}/, 'VetConsultRoute must not be a static App import');
assert.match(
  readFileSync(join(webSrc, 'styles/loadAppCss.ts'), 'utf8'),
  /import\('\.\/theme-dark\.css'\)[\s\S]*?import\('\.\/pepito\.css'\)/,
  'theme-dark CSS loads before pepito so FAQ tokens are dark'
);
assert.doesNotMatch(main, /styles\/app-landing\.css/, 'app-landing CSS is not on the landing entry');
assert.doesNotMatch(main, /styles\/mobile-app-strip\.css/, 'app-strip CSS is not on the landing entry');
assert.match(indexHtml, /id="pd-park-boot-lcp"/, 'deep-link boot script parks LCP before React');
assert.match(appTsx, /ParkBootLcpOnNonHome/, 'non-home routes park boot LCP from App');
assert.match(welcome, /i === slide && \(i !== 0 \|\| bootHandedOff\)/, 'active non-boot slides mint in-hero photos');
assert.doesNotMatch(welcome, /appendChild\(img\)/, 'must not move the LCP node (causes render delay)');
assert.match(
  indexHtml,
  /body>#pd-boot-lcp,body>#pd-boot-lcp\.pepito-hero-media\{position:absolute;[^}]*z-index:1/,
  'critical CSS keeps the HTML LCP in document flow above #root fill'
);
assert.match(below, /magazineApi/, 'magazine fetch stays on the below-fold chunk');
assert.match(below, /hydrateShopCatalogOnce/, 'landing hydrates shop catalog from below-fold only');
assert.match(below, /IntersectionObserver/, 'landing shop catalog waits for #shop intersection');
assert.match(below, /scheduleLandingAppCss/, 'below-fold arms deferred chrome CSS');
assert.doesNotMatch(below, /if \(newsIndex === 0\) return/, 'news arrows must scroll back to page 0');
assert.match(below, /svcIndex === 0/, 'service carousel skips sync layout on mount');
assert.match(below, /ResizeObserver/, 'carousel step is measured off the React commit path');
assert.match(below, /requestAnimationFrame\(\(\) => \{\s*\n?\s*raf2 = window\.requestAnimationFrame/, 'carousel measures after double-rAF (forced-reflow)');
assert.doesNotMatch(below, /getComputedStyle/, 'carousel must not force-reflow via getComputedStyle');
assert.match(below, /\$\{base\}-232\.webp/, 'adoption thumbs use 232w WebP');
assert.match(below, /about-480\.webp/, 'about photo serves a display-sized WebP');
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
assert.match(nginx, /location = \/api\/hero/, 'nginx serves /api/hero without blanket no-store');
assert.match(
  nginx,
  /location \^~ \/api\/hero\/images\//,
  'nginx serves hero images without blanket no-store'
);
{
  const heroExact = (nginx.match(/location = \/api\/hero \{/g) || []).length;
  assert.equal(heroExact, 2, `exact /api/hero once per server (got ${heroExact})`);
}
assert.match(llms, /Roles/, 'llms.txt documents product roles for agents');
assert.match(llms, /پت‌دیت/, 'llms.txt includes Persian product name');
assert.match(robots, /Allow: \/llms\.txt/, 'robots.txt advertises llms.txt');

const pepitoCss = readFileSync(join(webSrc, 'styles/pepito.css'), 'utf8');
assert.match(pepitoCss, /body > #pd-boot-lcp,\s*body > #pd-boot-lcp\.pepito-hero-media \{[\s\S]*?position:\s*absolute/, 'hydrated boot LCP is absolute, not viewport-fixed');
assert.match(pepitoCss, /body > #pd-boot-lcp,\s*body > #pd-boot-lcp\.pepito-hero-media \{[\s\S]*?z-index:\s*1/, 'hydrated boot LCP paints above landing fill');
assert.match(pepitoCss, /body > #pd-boot-lcp,\s*body > #pd-boot-lcp\.pepito-hero-media \{[\s\S]*?inset:\s*auto/, 'hydrated boot LCP overrides hero-media inset');
assert.match(below, /width=\{232\}[\s\S]*?height=\{232\}/, 'below-fold adoption thumbs reserve 232px');
assert.match(below, /width=\{480\}[\s\S]*?height=\{388\}/, 'below-fold about photo attrs match 480 WebP');
assert.match(
  pepitoCss,
  /\.pepito-hero \{[\s\S]*?background:\s*#14161e;/,
  'hydrated hero uses solid fill (no dual static photo under slides)'
);
assert.doesNotMatch(
  pepitoCss,
  /\.pepito-hero \{[\s\S]*?url\('\/media\/lcp\/hero-playmate-800\.webp'\)/,
  'hydrated hero must not layer a second playmate photo'
);
assert.match(pepitoCss, /--pepito-btn-1-bg:\s*#5c4d91/, 'button-1 fill stays AA vs white');
assert.match(pepitoCss, /--pepito-btn-3-bg:\s*#a24a86/, 'button-3 fill is darkened pink for AA');
assert.match(
  pepitoCss,
  /--pepito-hero-h:\s*calc\(100svh - var\(--pepito-nav-h\)\)/,
  'hydrated mobile hero fills the viewport under the nav'
);
assert.match(pepitoCss, /88svh - var\(--pepito-nav-h\)/, 'desktop hero stays the compact 88svh band');
assert.match(
  pepitoCss,
  /--pepito-mobile-dock-clearance:\s*calc\(96px \+ env\(safe-area-inset-bottom, 0px\)\)/,
  'hydrated dock clearance matches critical CSS (pill + gap)'
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
assert.match(pepitoCss, /\.pepito-hero-dot \{\s*box-sizing: content-box/, 'hero-dot tap padding is outside the 10px visual box');
assert.match(pepitoCss, /\.pepito-hero-dot \{\s*box-sizing: content-box;\s*width: 10px/, 'hero visual dots are 10px (not 44px boxes)');
assert.match(pepitoCss, /\.pepito-hero-dots \{[\s\S]*?gap:\s*0\.75rem/, 'hero dots keep positive gap between 44px hit boxes');
assert.match(pepitoCss, /\.pepito-hero-dot \{[\s\S]*?padding:\s*17px;\s*margin:\s*0/, 'hero dots do not use overlapping negative margins');
assert.match(pepitoCss, /\.pepito-hero-dot\.is-active::after \{[\s\S]*?background:\s*#c9bde8/, 'active hero dot is lavender');
assert.doesNotMatch(pepitoCss, /\.pepito-hero-dot::before/, 'hero dots do not use overlapping ::before hit layers');
assert.match(
  pepitoCss,
  /\.pepito-nav-section-link \{[\s\S]*?min-height:\s*44px/,
  'nav section links meet 44px touch target height'
);
assert.match(
  pepitoCss,
  /html\.theme-dark \.pepito-faq-q[\s\S]*?#f4f3f8/,
  'pepito.css hardcodes AA FAQ ink for dark before theme-dark loads'
);
assert.match(
  pepitoCss,
  /\.pepito-nav-logo img \{[\s\S]*?aspect-ratio:\s*390\s*\/\s*114/,
  'hydrated logo CSS reserves aspect-ratio (unsized-image CLS)'
);

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
assert.match(below, /width=\{480\}[\s\S]*?height=\{480\}/, 'below-fold team photo attrs match 480 WebP reserve');
assert.match(below, /width=\{600\} height=\{600\}/, 'below-fold review photo attrs match 1:1 reserve');
const newsImgBlock = pepitoCss.match(/\.pepito-news-img \{[^}]+\}/)?.[0] || '';
assert.match(newsImgBlock, /aspect-ratio:\s*2\s*\/\s*1/, 'news/magazine covers use short 2:1 crop');
assert.doesNotMatch(newsImgBlock, /max-height/, 'news frames stay full-width (no thumb cap)');
const newsCoverBlock = pepitoCss.match(/\.pepito-news-img img \{[^}]+\}/)?.[0] || '';
assert.match(newsCoverBlock, /object-fit:\s*cover/, 'news imgs cover the short frame');
assert.match(newsCoverBlock, /height:\s*100%/, 'news imgs fill the frame (HTML height attr cannot win)');
assert.doesNotMatch(newsCoverBlock, /aspect-ratio:\s*900/, 'news imgs must not keep the 3:2 / height=900 portrait box');
assert.match(below, /width=\{1600\} height=\{800\}/, 'news cover attrs match 2:1 reserve');

const header = readFileSync(join(webSrc, 'components/SiteHeader.tsx'), 'utf8');
const themeToggle = readFileSync(join(webSrc, 'components/ThemeToggle.tsx'), 'utf8');
const navCluster = readFileSync(join(webSrc, 'components/NavUserCluster.tsx'), 'utf8');
const toast = readFileSync(join(webSrc, 'hooks/useAppToast.tsx'), 'utf8');
assert.doesNotMatch(header, /from 'lucide-react'/, 'SiteHeader must not parse lucide');
assert.doesNotMatch(themeToggle, /from 'lucide-react'/, 'ThemeToggle must not parse lucide');
assert.doesNotMatch(navCluster, /from 'lucide-react'/, 'guest nav cluster must not parse lucide');
assert.doesNotMatch(toast, /from 'lucide-react'/, 'toast host must not pull lucide onto landing');

const shopInvoice = readFileSync(join(webSrc, 'components/shop/ShopInvoice.tsx'), 'utf8');
assert.match(shopInvoice, /pd-shop-invoice-seal/, 'shop invoice renders seal/stamp');
assert.match(shopInvoice, /مهر فروشگاه/, 'shop invoice seal label');
assert.match(pepitoCss, /\.pd-shop-invoice-seal__ring/, 'seal ring styles present');

console.log('webPerf.selftest: ok');
