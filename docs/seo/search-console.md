# Google Search Console — پت‌دیت

## وضعیت اتوماسیون

در محیط Cloud Agent **اعتبارنامه Search Console / Google API وجود ندارد** (`GOOGLE_APPLICATION_CREDENTIALS` و مشابه خالی است). بنابراین ارسال خودکار sitemap و «Request indexing» از اینجا ممکن نیست — باید یک‌بار در پنل انجام شود.

Sitemap تولید و روی سایت در دسترس است:

- `https://petdate.ir/sitemap.xml`
- اشاره در `https://petdate.ir/robots.txt` → `Sitemap: https://petdate.ir/sitemap.xml`

تولید مجدد هنگام بیلد وب: `npm run sitemap -w @petdate/web` (و `prebuild`).

## چرا ممکن است در گوگل نباشد؟

بلاکرهای کد (مثلاً `Disallow: /` یا `noindex` روی هوم) روی پروداکشن فعلی برداشته شده‌اند؛ با این حال گوگل **فوراً ایندکس نمی‌کند**. بدون ثبت ملک در Search Console و درخواست ایندکس، سایت جدید/کم‌لینک ممکن است دیر یا اصلاً در نتایج دیده نشود. نمی‌توان «صفحه ۱ گوگل» را تضمین کرد — فقط مسیر ایندکس را باز می‌کنیم.

## اقدام کاربر (یک‌بار + URL Inspection)

1. باز کردن [Google Search Console](https://search.google.com/search-console).
2. افزودن ملک:
   - ترجیحاً **Domain** برای `petdate.ir` (شامل www و غیرwww)، یا
   - URL-prefix برای `https://petdate.ir` و در صورت نیاز `https://www.petdate.ir`.
3. تأیید مالکیت — یکی از روش‌ها:
   - **HTML tag** (آماده روی سایت): متای زیر در `packages/web/index.html` است و بعد از دیپلوی وب در HTML اولیه همه صفحات عمومی دیده می‌شود:
     ```html
     <meta name="google-site-verification" content="xaV-T_LTYV_FDK2Yvd7AVCxzHRk1RRDrkxiuAEbBdvo" />
     ```
     در Search Console روی **Verify** بزنید.
   - یا DNS TXT / فایل HTML روی سرور.
4. **Sitemaps** → ارسال `https://petdate.ir/sitemap.xml` → وضعیت باید Success / URLs discovered باشد.
5. **URL Inspection** (بازرسی URL):
   - `https://petdate.ir/` را وارد کنید → **Test live URL** → مطمئن شوید «URL is available to Google» و `robots` = index.
   - سپس **Request indexing** بزنید (سهمیه روزانه محدود است).
   - همین کار را برای چند URL مهم تکرار کنید: `/shop`، `/events`، `/adoption`، `/vet-consult`، `/faq`، `/magazine`.
6. چند روز بعد در گزارش **Pages** / **Coverage** وضعیت Indexed / Discovered / Crawled را چک کنید. اگر «Crawled - currently not indexed» دیدید، محتوا و لینک داخلی را تقویت کنید؛ بلاکر فنی جداست.
7. HTTPS `www` → apex روی origin پیاده شده؛ در پنل CDN هم host-redirect بگذارید تا بازدید Flexible به `https://petdate.ir` برسد.

## چک سریع زنده (قبل از درخواست ایندکس)

```bash
curl -sI https://petdate.ir/robots.txt | head -5
curl -s https://petdate.ir/robots.txt | rg -n 'Sitemap:|Disallow: /$|Allow: /'
curl -sI https://petdate.ir/sitemap.xml | head -5
curl -sI https://petdate.ir/ | rg -i 'HTTP/|x-robots'
curl -s https://petdate.ir/ | rg -i 'name="robots"|rel="canonical"|google-site-verification'
```

انتظار: `robots.txt` با `Allow: /` و `Sitemap:`، هوم با `index,follow` و بدون `X-Robots-Tag: noindex`.

## اگر بعداً API خواستید

متغیرهای پیشنهادی (در Secrets، نه در git):

- `GOOGLE_APPLICATION_CREDENTIALS` → مسیر JSON سرویس‌اکانت با نقش Search Console
- یا OAuth client برای کاربر مالک ملک

سپس می‌توان اسکریپت `webmasters.sitemaps.submit` را اضافه کرد؛ تا آن موقع همین مسیر دستی کافی است.

## Bing (اختیاری)

[Bing Webmaster Tools](https://www.bing.com/webmasters) → Import from Google یا ارسال همان sitemap.
