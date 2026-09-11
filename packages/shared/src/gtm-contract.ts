/**
 * First-party GTM “contract” for petdate.ir — dataLayer keys + Custom Events
 * the public SPA emits. Actual Tags/Triggers/Variables inside Google’s container
 * (GTM-KQPJT9Q4) are configured in tagmanager.google.com; this catalog documents
 * what the site pushes so ops can wire GA4 / Conversion Linker / etc.
 */

export const GTM_CONTAINER_ID = 'GTM-KQPJT9Q4';
export const CLARITY_PROJECT_ID = 'ygkl5nck6k';
export const GTM_DASHBOARD_URL = 'https://tagmanager.google.com/';
export const TAG_ASSISTANT_URL = 'https://tagassistant.google.com/';
export const CLARITY_DASHBOARD_URL = `https://clarity.microsoft.com/projects/view/${CLARITY_PROJECT_ID}/`;

/** Custom events pushed to dataLayer (Trigger food). */
export const GTM_EVENT_NAMES = [
  'page_view',
  'link_click',
  'outbound_click',
  'file_download',
  'sign_up',
  'login',
  'generate_lead',
  'view_item',
  'add_to_cart',
  'begin_checkout',
  'purchase',
  'scroll',
] as const;

export type GtmEventName = (typeof GTM_EVENT_NAMES)[number];

export type GtmCatalogRow = {
  name: string;
  kind: 'variable' | 'trigger' | 'event';
  descriptionFa: string;
  descriptionEn: string;
  whereFired: string;
};

/** dataLayer keys (Variables) the SPA sets. */
export const GTM_SITE_VARIABLES: GtmCatalogRow[] = [
  {
    name: 'page_path',
    kind: 'variable',
    descriptionFa: 'مسیر صفحه بدون query',
    descriptionEn: 'Pathname without query string',
    whereFired: 'هر page_view',
  },
  {
    name: 'page_title',
    kind: 'variable',
    descriptionFa: 'عنوان document.title',
    descriptionEn: 'document.title',
    whereFired: 'هر page_view',
  },
  {
    name: 'page_location',
    kind: 'variable',
    descriptionFa: 'URL کامل صفحه',
    descriptionEn: 'Full location.href',
    whereFired: 'هر page_view',
  },
  {
    name: 'page_type',
    kind: 'variable',
    descriptionFa: 'نوع صفحه (home/shop/auth/…)',
    descriptionEn: 'Inferred content group',
    whereFired: 'هر page_view',
  },
  {
    name: 'user_id',
    kind: 'variable',
    descriptionFa: 'شناسه داخلی کاربر لاگین (بدون سکرت)',
    descriptionEn: 'Internal logged-in user id (no secrets)',
    whereFired: 'page_view و رویدادهای auth وقتی لاگین است',
  },
  {
    name: 'user_status',
    kind: 'variable',
    descriptionFa: 'guest یا logged_in',
    descriptionEn: 'guest | logged_in',
    whereFired: 'هر page_view',
  },
  {
    name: 'click_text',
    kind: 'variable',
    descriptionFa: 'متن لینک کلیک‌شده',
    descriptionEn: 'Clicked link inner text',
    whereFired: 'link_click / outbound_click / file_download',
  },
  {
    name: 'click_url',
    kind: 'variable',
    descriptionFa: 'URL لینک کلیک‌شده',
    descriptionEn: 'Clicked href',
    whereFired: 'link_click / outbound_click / file_download',
  },
  {
    name: 'click_id',
    kind: 'variable',
    descriptionFa: 'id یا data-gtm-id عنصر',
    descriptionEn: 'Element id / data-gtm-id',
    whereFired: 'link_click وقتی موجود باشد',
  },
  {
    name: 'link_kind',
    kind: 'variable',
    descriptionFa: 'outbound | cta | download | telegram | contact',
    descriptionEn: 'Link classification',
    whereFired: 'link_click',
  },
  {
    name: 'form_id',
    kind: 'variable',
    descriptionFa: 'شناسه فرم',
    descriptionEn: 'Form id attribute',
    whereFired: 'generate_lead',
  },
  {
    name: 'form_name',
    kind: 'variable',
    descriptionFa: 'نام فرم',
    descriptionEn: 'Form name / label',
    whereFired: 'generate_lead',
  },
  {
    name: 'currency',
    kind: 'variable',
    descriptionFa: 'واحد پول (IRR)',
    descriptionEn: 'ISO-ish currency code (IRR)',
    whereFired: 'view_item / add_to_cart / begin_checkout / purchase',
  },
  {
    name: 'value',
    kind: 'variable',
    descriptionFa: 'مبلغ به تومان',
    descriptionEn: 'Numeric value in toman',
    whereFired: 'ecommerce events',
  },
  {
    name: 'items',
    kind: 'variable',
    descriptionFa: 'آرایه اقلام GA4-style',
    descriptionEn: 'GA4-style items[]',
    whereFired: 'ecommerce events',
  },
  {
    name: 'transaction_id',
    kind: 'variable',
    descriptionFa: 'شناسه سفارش',
    descriptionEn: 'Order / payment id',
    whereFired: 'purchase',
  },
  {
    name: 'ga4_measurement_id',
    kind: 'variable',
    descriptionFa: 'شناسه اندازه‌گیری GA4 از env (اختیاری)',
    descriptionEn: 'Optional VITE_GA4_MEASUREMENT_ID',
    whereFired: 'اولین init وقتی env ست باشد',
  },
];

/** Triggers = Custom Events the site pushes (create matching Triggers in GTM UI). */
export const GTM_SITE_TRIGGERS: GtmCatalogRow[] = [
  {
    name: 'page_view',
    kind: 'trigger',
    descriptionFa: 'بازدید هر مسیر SPA + اولین لود',
    descriptionEn: 'SPA route change + first load',
    whereFired: 'SiteAnalyticsListener (همه مسیرهای غیر /admin)',
  },
  {
    name: 'link_click',
    kind: 'trigger',
    descriptionFa: 'کلیک لینک‌های مهم (CTA / خروجی / تلگرام / دانلود / تماس)',
    descriptionEn: 'Tracked CTA / outbound / telegram / download / contact clicks',
    whereFired: 'document click capture روی <a>',
  },
  {
    name: 'outbound_click',
    kind: 'trigger',
    descriptionFa: 'زیرمجموعهٔ لینک‌های خروجی دامنه',
    descriptionEn: 'External-domain link clicks',
    whereFired: 'همراه link_click وقتی outbound=true',
  },
  {
    name: 'file_download',
    kind: 'trigger',
    descriptionFa: 'دانلود فایل (pdf/zip/…)',
    descriptionEn: 'File download links',
    whereFired: 'لینک‌های فایل یا attribute download',
  },
  {
    name: 'sign_up',
    kind: 'trigger',
    descriptionFa: 'ثبت‌نام موفق (کاربر تازه‌ساخته)',
    descriptionEn: 'Successful new-user OTP / session',
    whereFired: 'OtpPage / TelegramLink پس از auth',
  },
  {
    name: 'login',
    kind: 'trigger',
    descriptionFa: 'ورود موفق کاربر عمومی',
    descriptionEn: 'Successful public login',
    whereFired: 'OtpPage / TelegramLink پس از auth',
  },
  {
    name: 'generate_lead',
    kind: 'trigger',
    descriptionFa: 'لید فرم (خبرنامه و مشابه)',
    descriptionEn: 'Lead form success',
    whereFired: 'SiteFooter newsletter',
  },
  {
    name: 'view_item',
    kind: 'trigger',
    descriptionFa: 'مشاهده صفحه محصول شاپ',
    descriptionEn: 'Shop product detail view',
    whereFired: 'ShopProductPage',
  },
  {
    name: 'add_to_cart',
    kind: 'trigger',
    descriptionFa: 'افزودن به سبد',
    descriptionEn: 'Add to cart',
    whereFired: 'useShopCart.add / addAnimated',
  },
  {
    name: 'begin_checkout',
    kind: 'trigger',
    descriptionFa: 'شروع پرداخت سبد',
    descriptionEn: 'Checkout submit start',
    whereFired: 'ShopCartPage قبل از API پرداخت',
  },
  {
    name: 'purchase',
    kind: 'trigger',
    descriptionFa: 'پرداخت موفق سفارش',
    descriptionEn: 'Successful paid order',
    whereFired: 'ShopCartPage پس از checkout موفق',
  },
  {
    name: 'scroll',
    kind: 'trigger',
    descriptionFa: 'اسکرول عمق ۷۵٪ (یک‌بار در هر صفحه)',
    descriptionEn: '75% scroll depth once per path',
    whereFired: 'listener سبک روی مسیرهای عمومی',
  },
];

export type GtmUiChecklistItem = {
  id: string;
  titleFa: string;
  titleEn: string;
  type: 'tag' | 'trigger' | 'variable' | 'note';
  detailFa: string;
  /** Placeholder when Measurement ID is unknown */
  requiresGa4?: boolean;
};

/**
 * Recommended Tags / Triggers / Variables to create inside GTM UI.
 * No invented Measurement IDs — use VITE_GA4_MEASUREMENT_ID when present.
 */
export const GTM_UI_SETUP_CHECKLIST: GtmUiChecklistItem[] = [
  {
    id: 'var-dl-page-path',
    titleFa: 'Variable: DL - page_path',
    titleEn: 'Data Layer Variable page_path',
    type: 'variable',
    detailFa: 'نوع Data Layer Variable، نام صفحه page_path',
  },
  {
    id: 'var-dl-page-title',
    titleFa: 'Variable: DL - page_title',
    titleEn: 'Data Layer Variable page_title',
    type: 'variable',
    detailFa: 'Data Layer Variable → page_title',
  },
  {
    id: 'var-dl-user-status',
    titleFa: 'Variable: DL - user_status',
    titleEn: 'Data Layer Variable user_status',
    type: 'variable',
    detailFa: 'Data Layer Variable → user_status',
  },
  {
    id: 'var-dl-user-id',
    titleFa: 'Variable: DL - user_id',
    titleEn: 'Data Layer Variable user_id',
    type: 'variable',
    detailFa: 'برای User-ID در GA4 (بدون PII)',
  },
  {
    id: 'var-ga4-mid',
    titleFa: 'Variable: GA4 Measurement ID',
    titleEn: 'Constant / DL ga4_measurement_id',
    type: 'variable',
    detailFa:
      'اگر VITE_GA4_MEASUREMENT_ID ست شده از dataLayer بخوانید؛ وگرنه Constant با PLACEHOLDER_G-XXXXXXXX بسازید و بعداً جایگزین کنید.',
    requiresGa4: true,
  },
  {
    id: 'trig-ce-page-view',
    titleFa: 'Trigger: CE - page_view',
    titleEn: 'Custom Event page_view',
    type: 'trigger',
    detailFa: 'Custom Event برابر page_view (جایگزین History Change برای SPA)',
  },
  {
    id: 'trig-ce-link-click',
    titleFa: 'Trigger: CE - link_click',
    titleEn: 'Custom Event link_click',
    type: 'trigger',
    detailFa: 'Custom Event = link_click',
  },
  {
    id: 'trig-ce-auth',
    titleFa: 'Trigger: CE - login / sign_up',
    titleEn: 'Custom Event login & sign_up',
    type: 'trigger',
    detailFa: 'دو تریگر جدا یا یک RegEx برای login|sign_up',
  },
  {
    id: 'trig-ce-ecom',
    titleFa: 'Trigger: CE - ecommerce',
    titleEn: 'view_item / add_to_cart / begin_checkout / purchase',
    type: 'trigger',
    detailFa: 'چهار Custom Event جدا برای قیف فروشگاه',
  },
  {
    id: 'trig-ce-lead',
    titleFa: 'Trigger: CE - generate_lead',
    titleEn: 'Custom Event generate_lead',
    type: 'trigger',
    detailFa: 'خبرنامه فوتر و فرم‌های لید',
  },
  {
    id: 'tag-ga4-config',
    titleFa: 'Tag: GA4 Configuration',
    titleEn: 'Google Analytics: GA4 Configuration',
    type: 'tag',
    detailFa:
      'Measurement ID از Variable بالا. Send a page view event → False (صفحه را با تگ Event زیر بفرستید). Trigger: All Pages یا Initialization اختیاری.',
    requiresGa4: true,
  },
  {
    id: 'tag-ga4-page-view',
    titleFa: 'Tag: GA4 Event - page_view',
    titleEn: 'GA4 Event page_view',
    type: 'tag',
    detailFa:
      'Event Name = page_view؛ پارامترها: page_path, page_title, page_location, page_type, user_status. Trigger: CE page_view.',
    requiresGa4: true,
  },
  {
    id: 'tag-ga4-events',
    titleFa: 'Tag: GA4 Event - site events',
    titleEn: 'GA4 Event (mirror dataLayer event)',
    type: 'tag',
    detailFa:
      'برای login, sign_up, generate_lead, link_click, purchase و … Event Name = {{Event}} یا نام ثابت؛ پارامترها از DL Variables.',
    requiresGa4: true,
  },
  {
    id: 'tag-conversion-linker',
    titleFa: 'Tag: Conversion Linker',
    titleEn: 'Conversion Linker',
    type: 'tag',
    detailFa: 'Trigger: All Pages — برای لینک تبدیل Google Ads در آینده',
  },
  {
    id: 'note-admin-skip',
    titleFa: 'یادداشت: مسیر /admin',
    titleEn: 'Skip /admin',
    type: 'note',
    detailFa:
      'سایت روی /admin رویداد dataLayer و beacon اول‌شخص نمی‌فرستد. Exception Trigger در GTM برای Page Path شامل /admin پیشنهاد می‌شود.',
  },
  {
    id: 'note-no-api',
    titleFa: 'یادداشت: بدون GTM API',
    titleEn: 'No GTM Admin API',
    type: 'note',
    detailFa:
      'تگ‌های داخل کانتینر Google فقط از UI (یا OAuth GTM API) ساخته می‌شوند؛ این چک‌لیست راهنمای دستی است.',
  },
];

export function isGtmEventName(name: string): name is GtmEventName {
  return (GTM_EVENT_NAMES as readonly string[]).includes(name);
}
