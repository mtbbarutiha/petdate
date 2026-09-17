/**
 * Guard: Digikala-style Android app landing + APK download rail.
 * Run: npx tsx packages/web/src/pages/appLandingPage.selftest.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(dir, 'AppLandingPage.tsx'), 'utf8');
const app = readFileSync(join(dir, '../App.tsx'), 'utf8');
const seo = readFileSync(join(dir, '../lib/pageSeo.ts'), 'utf8');
const fa = readFileSync(join(dir, '../i18n/locales/fa.ts'), 'utf8');
const en = readFileSync(join(dir, '../i18n/locales/en.ts'), 'utf8');
const footer = readFileSync(join(dir, '../components/SiteFooter.tsx'), 'utf8');
const css = readFileSync(join(dir, '../styles/app-landing.css'), 'utf8');
const main = readFileSync(join(dir, '../main.tsx'), 'utf8');
const apkPath = join(dir, '../../public/downloads/petdate-android.apk');

assert.match(page, /export const ANDROID_APK_HREF = '\/downloads\/petdate-android\.apk'/);
assert.match(page, /data-testid="app-landing-apk-download"/);
assert.match(page, /data-testid="app-landing-sms-form"/);
assert.match(page, /sendAppDownloadSms/);
assert.match(page, /smsSentOk|smsComposerOk/);
assert.match(page, /hideBanner/);
assert.match(page, /showMobileEvents=\{false\}/);
assert.match(page, /showDesktopNav=\{false\}/);
assert.match(page, /appLanding\.heroTitle/);
assert.match(app, /path="landings\/app"/);
assert.match(app, /path="app"/);
assert.match(app, /AppLandingPage/);
assert.match(seo, /\/landings\/app/);
assert.match(seo, /SoftwareApplication/);
assert.match(seo, /petdate-android\.apk/);
assert.match(fa, /appLanding:\s*\{/);
assert.match(fa, /androidApp:/);
assert.match(en, /appLanding:\s*\{/);
assert.match(en, /androidApp:/);
assert.match(footer, /\/landings\/app/);
assert.match(footer, /footer\.androidApp/);
assert.match(css, /\.pd-app-land-hero\b/);
assert.match(css, /\.pd-app-land-download\b/);
assert.match(
  css,
  /@media\s*\(\s*min-width:\s*860px\s*\)[\s\S]*?\.pepito-app-landing-page\s*>\s*main\.pd-app-land\s*\{[^}]*padding-top:\s*var\(--pepito-nav-h/,
  'hideBanner landing clears fixed SiteHeader on desktop (nav in-flow on mobile)'
);
assert.doesNotMatch(
  css,
  /\.pepito-app-landing-page[^{]*\{[^}]*padding-top:\s*0/,
  'must not zero out top pad under fixed nav'
);
assert.match(
  css,
  /html\[data-theme=['"]dark['"]\]\s+\.pd-app-land\b/,
  'dark theme remaps app-landing tokens (light wash must not keep light ink)'
);
assert.match(
  css,
  /html\[data-theme=['"]dark['"]\]\s+\.pd-app-land-hero\b/,
  'dark theme restyles hero wash'
);
assert.match(
  css,
  /html\[data-theme=['"]dark['"]\]\s+\.pd-app-land-phone-screen\b/,
  'dark theme restyles phone mock screen'
);
assert.match(page, /app-landing\.css/, 'app-landing page loads its CSS on mount');
assert.doesNotMatch(main, /import ['\"]\.\/styles\/app-landing\.css['\"]/, 'app-landing CSS is not a static main import');
assert.ok(existsSync(apkPath), 'public APK missing');
assert.ok(statSync(apkPath).size > 100_000, 'APK too small');

console.log('appLandingPage.selftest: ok');
