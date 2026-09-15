/**
 * Guard: Digikala-style mobile homepage app download strip + Android shell flags.
 * Run: npx tsx packages/web/src/pages/mobileAppDownloadStrip.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const webSrc = join(dir, '..');
const root = join(dir, '../../../..');

const strip = readFileSync(join(webSrc, 'components/MobileAppDownloadStrip.tsx'), 'utf8');
const welcome = readFileSync(join(webSrc, 'pages/WelcomePage.tsx'), 'utf8');
const welcomeBelow = readFileSync(join(webSrc, 'pages/WelcomeBelowFold.tsx'), 'utf8');
const magazinePage = readFileSync(join(webSrc, 'pages/MagazinePage.tsx'), 'utf8');
const articlePage = readFileSync(join(webSrc, 'pages/MagazineArticlePage.tsx'), 'utf8');
const main = readFileSync(join(webSrc, 'main.tsx'), 'utf8');
const css = readFileSync(join(webSrc, 'styles/mobile-app-strip.css'), 'utf8');
const fa = readFileSync(join(webSrc, 'i18n/locales/fa.ts'), 'utf8');
const en = readFileSync(join(webSrc, 'i18n/locales/en.ts'), 'utf8');
const manifest = readFileSync(join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
const activity = readFileSync(
  join(root, 'android/app/src/main/java/ir/petdate/app/MainActivity.java'),
  'utf8',
);
const styles = readFileSync(join(root, 'android/app/src/main/res/values/styles.xml'), 'utf8');

assert.match(strip, /mobile-app-download-strip/);
assert.match(strip, /article-app-download-strip/);
assert.match(strip, /ANDROID_APK_HREF/);
assert.match(strip, /\/landings\/app/);
assert.match(strip, /isNativeCapacitorShell/);
assert.doesNotMatch(welcome, /MobileAppDownloadStrip/, 'home strip is below articles, not under hero');
assert.match(welcomeBelow, /MobileAppDownloadStrip/);
assert.match(welcomeBelow, /variant=["']article["']/);
assert.match(welcomeBelow, /SiteFooter/);
// strip must appear before footer in below-fold
assert.ok(welcomeBelow.indexOf('MobileAppDownloadStrip') < welcomeBelow.indexOf('SiteFooter'));
assert.match(magazinePage, /MobileAppDownloadStrip/);
assert.match(magazinePage, /variant=["']article["']/);
assert.match(main, /mobile-app-strip\.css/);
assert.match(css, /\.pd-app-strip\b/);
assert.match(css, /@media\s*\(\s*max-width:\s*859px\s*\)/);
assert.match(
  css,
  /html\[data-theme=['"]dark['"]\]\s+\.pd-app-strip-inner\b/,
  'dark theme restyles app download strip',
);
assert.match(fa, /appStripTitle:/);
assert.match(en, /appStripTitle:/);
assert.match(manifest, /ACCESS_FINE_LOCATION/);
assert.match(manifest, /ACCESS_COARSE_LOCATION/);
assert.match(activity, /enableFullscreen/);
assert.match(activity, /requestLocationPermissionIfNeeded/);
assert.match(activity, /ACCESS_FINE_LOCATION/);
assert.match(styles, /android:windowFullscreen/);


assert.match(strip, /variant\s*=\s*'home'\s*\|\s*'article'|AppDownloadStripVariant/);
assert.match(strip, /pd-app-strip--article/);
assert.match(articlePage, /MobileAppDownloadStrip/);
assert.match(articlePage, /variant=["']article["']/);
assert.match(css, /\.pd-app-strip--article\b/, 'article variant visible on all viewports');
assert.match(css, /@media\s*\(\s*min-width:\s*860px\s*\)[\s\S]*?\.pd-app-strip--article\b/);

console.log('mobileAppDownloadStrip.selftest: ok');
