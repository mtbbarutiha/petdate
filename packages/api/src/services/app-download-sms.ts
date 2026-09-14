/**
 * Public app-download SMS — warm PetDate copy + Android APK link via Candoo.
 */
import { formatIranMobileDisplay, normalizeIranMobile, SITE } from '@petdate/shared';
import { candooSendWithSrcFallback, isCandooConfigured } from './candoo';

/** Same path as `ANDROID_APK_HREF` on the web landing page. */
export const APP_DOWNLOAD_APK_PATH = '/downloads/petdate-android.apk';

export function appDownloadApkUrl(origin = SITE.origin): string {
  const base = String(origin || SITE.origin).replace(/\/$/, '');
  return `${base}${APP_DOWNLOAD_APK_PATH}`;
}

/** Short, friendly Persian SMS body for the recipient. */
export function formatAppDownloadSms(downloadUrl = appDownloadApkUrl()): string {
  return [
    'پت‌دیت',
    'همبازی برای پت‌ات، شاپ و دامپزشک آنلاین — همیشه دم‌دست.',
    'نصب اندروید:',
    downloadUrl,
  ].join('\n');
}

export type SendAppDownloadSmsResult =
  | { ok: true; sent: true; phone: string; body: string }
  | { ok: true; sent: false; fallback: true; phone: string; body: string; reason: string }
  | { ok: false; error: string };

export async function sendAppDownloadSms(rawPhone: string): Promise<SendAppDownloadSmsResult> {
  const recipient = normalizeIranMobile(rawPhone);
  if (!recipient) {
    return { ok: false, error: 'شماره موبایل نامعتبر است' };
  }

  const body = formatAppDownloadSms();
  const phone = formatIranMobileDisplay(recipient);

  if (!isCandooConfigured()) {
    return {
      ok: true,
      sent: false,
      fallback: true,
      phone,
      body,
      reason: 'سرویس پیامک پیکربندی نشده',
    };
  }

  try {
    const sent = await candooSendWithSrcFallback({
      recipient,
      body,
      type: 0,
    });
    if (sent.ok) {
      return { ok: true, sent: true, phone, body };
    }
    console.error('app-download SMS failed:', sent.error, sent.raw, 'src=', sent.srcNum);
    return {
      ok: true,
      sent: false,
      fallback: true,
      phone,
      body,
      reason: sent.error || 'ارسال پیامک ناموفق بود',
    };
  } catch (err) {
    console.error('app-download SMS exception:', err);
    return {
      ok: true,
      sent: false,
      fallback: true,
      phone,
      body,
      reason: 'خطا در ارسال پیامک',
    };
  }
}
