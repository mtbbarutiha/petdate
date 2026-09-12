/**
 * Language-aware chrome for first-party analytics / GTM / Clarity cards.
 * API notes stay FA for backward compat; the admin UI never renders them raw.
 */
import { tr, uiLang } from '../i18n';

export function adminDeviceLabel(device: string): string {
  if (device === 'desktop' || device === 'دسکتاپ') return tr('دسکتاپ');
  if (device === 'mobile' || device === 'موبایل') return tr('موبایل');
  if (device === 'tablet' || device === 'تبلت') return tr('تبلت');
  return tr(device);
}

export function ga4StatusNote(ga4: {
  configured: boolean;
  measurementId?: string | null;
  source?: 'env' | 'settings' | null;
}): string {
  if (ga4.configured && ga4.measurementId) {
    return tr(
      'شناسه GA4 ({id}) از {source} — gtag روی صفحات عمومی و dataLayer برای GTM فعال است.',
      {
        id: ga4.measurementId,
        source: ga4.source === 'settings' ? tr('تنظیمات پلتفرم') : 'env',
      },
    );
  }
  return tr(
    'شناسه اندازه‌گیری GA4 هنوز تنظیم نشده. در «آنالیتیکس» یا تنظیمات پلتفرم فیلد Measurement ID را ذخیره کنید، یا VITE_GA4_MEASUREMENT_ID را در env بگذارید. تا آن زمان گزارش‌های زیر از آنالیتیکس اول‌شخص petdate است.',
  );
}

export function gtmStatusNote(gtm: { configured: boolean; containerId?: string | null }): string {
  if (gtm.configured && gtm.containerId) {
    return tr(
      'کانتینر GTM ({id}) در HTML اولیه نصب است (Tag Assistant). روی مسیرهای عمومی: dataLayer قبل از gtm.js، رویداد page_view در هر تغییر مسیر SPA، و رویدادهای auth/ecommerce/لید — تگ‌های داخل کانتینر را در Tag Manager وصل کنید (نه /admin).',
      { id: gtm.containerId },
    );
  }
  return tr('شناسهٔ GTM نامعتبر است. مقدار VITE_GTM_ID را به صورت GTM-XXXX تنظیم کنید.');
}

export function clarityStatusNote(configured: boolean): string {
  return configured
    ? tr('پروژه Clarity پیکربندی شده — برای session replay و heatmap به داشبورد Clarity بروید.')
    : tr(
        'شناسهٔ داده‌شده (UUID ایجنت) توسط Clarity به‌عنوان project id رد شد؛ گزارش‌های زیر از آنالیتیکس اول‌شخص petdate است. برای Clarity یک Project ID معتبر را در VITE_CLARITY_PROJECT_ID ست کنید.',
      );
}

export function analyticsHealthNote(lastEventAt: string | null | undefined, eventsLast24h: number): string {
  if (lastEventAt) {
    return tr('آخرین رویداد اول‌شخص: {at} — جمع ۲۴ساعت: {n}', {
      at: lastEventAt,
      n: eventsLast24h,
    });
  }
  return tr('هنوز رویدادی در site_analytics ثبت نشده؛ پس از ترافیک عمومی اینجا پر می‌شود.');
}

export function gtmStatusLabel(configured: boolean): string {
  return configured ? tr('پیکربندی‌شده / snippet در HTML') : tr('پیکربندی نشده');
}

export function catalogDescription(row: { descriptionFa: string; descriptionEn?: string }): string {
  return uiLang() === 'en' && row.descriptionEn ? row.descriptionEn : tr(row.descriptionFa);
}

export function checklistTitle(item: { titleFa: string; titleEn?: string }): string {
  return uiLang() === 'en' && item.titleEn ? item.titleEn : tr(item.titleFa);
}

export function checklistDetail(item: { detailFa: string }): string {
  return tr(item.detailFa);
}

export function catalogWhere(whereFired: string): string {
  return tr(whereFired);
}

export function ga4TmNote(ga4: { configured: boolean; measurementId?: string | null }): string {
  if (ga4.configured && ga4.measurementId) {
    return tr(
      'شناسه GA4 ({id}) از تنظیمات پلتفرم — در GTM به‌عنوان Measurement ID استفاده کنید.',
      { id: ga4.measurementId },
    );
  }
  return tr(
    'شناسه GA4 تنظیم نشده (VITE_GA4_MEASUREMENT_ID یا تنظیمات پلتفرم). در چک‌لیست از PLACEHOLDER_G-XXXXXXXX استفاده کنید — مقدار ساختگی وارد نکنید.',
  );
}
