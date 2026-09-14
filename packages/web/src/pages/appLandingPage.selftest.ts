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
assert.match(main, /app-landing\.css/);
assert.ok(existsSync(apkPath), 'public APK missing');
assert.ok(statSync(apkPath).size > 100_000, 'APK too small');

console.log('appLandingPage.selftest: ok');
