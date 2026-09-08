# Google Search Console — پت‌دیت

## وضعیت اتوماسیون

در محیط Cloud Agent **اعتبارنامه Search Console / Google API وجود ندارد** (`GOOGLE_APPLICATION_CREDENTIALS` و مشابه خالی است). بنابراین ارسال خودکار sitemap انجام نشد.

Sitemap تولید و روی سایت در دسترس است:

- `https://petdate.ir/sitemap.xml`
- اشاره در `https://petdate.ir/robots.txt` → `Sitemap: https://petdate.ir/sitemap.xml`

تولید مجدد هنگام بیلد وب: `npm run sitemap -w @petdate/web` (و `prebuild`).

## اقدام کاربر (یک‌بار)

1. باز کردن [Google Search Console](https://search.google.com/search-console).
2. افزودن ملک:
   - ترجیحاً **Domain** برای `petdate.ir` (شامل www و غیرwww)، یا
   - URL-prefix برای `https://petdate.ir` و در صورت نیاز `https://www.petdate.ir`.
3. تأیید مالکیت (DNS TXT یا فایل HTML روی سرور).
4. **Sitemaps** → ارسال `https://petdate.ir/sitemap.xml`.
5. (پیشنهاد) در nginx یک **۳۰۱** از `www` به apex (یا برعکس) تا با canonicalهای فعلی (`https://petdate.ir/...`) هم‌خوان شود.

## اگر بعداً API خواستید

متغیرهای پیشنهادی (در Secrets، نه در git):

- `GOOGLE_APPLICATION_CREDENTIALS` → مسیر JSON سرویس‌اکانت با نقش Search Console
- یا OAuth client برای کاربر مالک ملک

سپس می‌توان اسکریپت `webmasters.sitemaps.submit` را اضافه کرد؛ تا آن موقع همین مسیر دستی کافی است.

## Bing (اختیاری)

[Bing Webmaster Tools](https://www.bing.com/webmasters) → Import from Google یا ارسال همان sitemap.
