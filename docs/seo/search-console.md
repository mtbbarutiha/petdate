# Google Search Console — پت‌دیت

## وضعیت فعلی (۲۰۲۶-۰۹-۰۸)

| مورد | وضعیت |
|------|--------|
| متای HTML تأیید | **روی سایت زنده است** (`https://petdate.ir/` و `https://www.petdate.ir/`) |
| DNS TXT تأیید Domain | **اضافه نشده** — فقط SPF موجود است؛ NS روی ParsPack است (`jungle/garden.parspack.net`) و از VPS قابل ویرایش نیست |
| Sitemap | `https://petdate.ir/sitemap.xml` (اشاره در `robots.txt`) |

توکن تأیید:

```
google-site-verification=xaV-T_LTYV_FDK2Yvd7AVCxzHRk1RRDrkxiuAEbBdvo
```

در HTML:

```html
<meta name="google-site-verification" content="xaV-T_LTYV_FDK2Yvd7AVCxzHRk1RRDrkxiuAEbBdvo" />
```

در Cloud Agent اعتبارنامه Search Console / Google API نیست؛ Verify را باید مالک در پنل بزند.

---

## مسیر سریع پیشنهادی (همین الان)

چون متای HTML زنده است، **روش Domain (DNS)** را رها کنید و از **URL-prefix** استفاده کنید:

1. Search Console → **Add property** → **URL prefix**
2. آدرس را دقیقاً بگذارید: `https://www.petdate.ir/`  
   (یا `https://petdate.ir/` — هر دو متا دارند؛ با canonical فعلی apex ترجیح دارد اگر redirect یکدست شود)
3. روش تأیید: **HTML tag**
4. دکمه **Verify** را بزنید (متا از قبل روی سایت است؛ نیازی به کپی مجدد نیست)
5. بعد از تأیید: **Sitemaps** → ارسال `https://petdate.ir/sitemap.xml`

---

## اگر روی Domain (`petdate.ir`) ماندید

DNS را **فقط** در پنل دامنه / ParsPack عوض کنید (نه روی VPS — bind محلی نیست).

1. وارد پنل DNS دامنه شوید (ParsPack / ثبت‌کننده).
2. یک رکورد **TXT جدید** در apex (`@` یا خالی) اضافه کنید — **SPF را حذف نکنید**:
   - Type: `TXT`
   - Host/Name: `@`
   - Value: `google-site-verification=xaV-T_LTYV_FDK2Yvd7AVCxzHRk1RRDrkxiuAEbBdvo`
3. چند ساعت صبر کنید تا منتشر شود، بعد در Search Console روی **Verify** بزنید.
4. چک از ترمینال:

```bash
dig TXT petdate.ir +short
# باید هم SPF و هم google-site-verification را ببینید
```

رکورد فعلی که Google پیدا کرده (فقط SPF):

```
v=spf1 ip4:185.110.189.218 a:mail.petdate.ir mx -all
```

جزئیات SPF/DKIM/DMARC میل: `docs/infra/mail-petdate.md`.

---

## اتوماسیون بعدی (اختیاری)

Secrets پیشنهادی (نه در git):

- `GOOGLE_APPLICATION_CREDENTIALS` → JSON سرویس‌اکانت با دسترسی Search Console

سپس می‌توان `webmasters.sitemaps.submit` را اسکریپت کرد؛ تا آن موقع مسیر دستی کافی است.

## Bing (اختیاری)

[Bing Webmaster Tools](https://www.bing.com/webmasters) → Import from Google یا همان sitemap.
