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

assert.match(strip, /data-testid="mobile-app-download-strip"/);
assert.match(strip, /ANDROID_APK_HREF/);
assert.match(strip, /\/landings\/app/);
assert.match(strip, /isNativeCapacitorShell/);
assert.match(welcome, /MobileAppDownloadStrip/);
assert.match(welcome, /<MobileAppDownloadStrip\s*\/>/);
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

console.log('mobileAppDownloadStrip.selftest: ok');
