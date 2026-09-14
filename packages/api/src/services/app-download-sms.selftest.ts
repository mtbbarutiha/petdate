/**
 * Offline checks for app-download SMS copy.
 * Run: npx tsx packages/api/src/services/app-download-sms.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  APP_DOWNLOAD_APK_PATH,
  appDownloadApkUrl,
  formatAppDownloadSms,
} from './app-download-sms';

const body = formatAppDownloadSms(`https://petdate.ir${APP_DOWNLOAD_APK_PATH}`);
assert.match(body, /پت‌دیت/);
assert.match(body, /همبازی/);
assert.match(body, /\/downloads\/petdate-android\.apk/);
assert.doesNotMatch(body, /لینک دانلود اپ اندروید/);
assert.equal(APP_DOWNLOAD_APK_PATH, '/downloads/petdate-android.apk');
assert.equal(appDownloadApkUrl('https://petdate.ir'), 'https://petdate.ir/downloads/petdate-android.apk');

console.log('app-download-sms.selftest: ok');
