# Main Mini App — دکمه «Open App» روی پروفایل ربات

هدف UI (مثل `@wallet`): روی صفحهٔ پروفایل ربات `@Petdatebot`، زیر About، دکمهٔ بزرگ آبی **Open App** که مینی‌اپ را باز کند.

مرجع تصویری: [`wallet-open-app-reference.jpg`](./wallet-open-app-reference.jpg)

## وضعیت فعلی (بررسی API — ۲۰۲۶-۰۹-۰۸)

| مورد | وضعیت |
|------|--------|
| `getMe().has_main_web_app` | **`false`** → دکمهٔ پروفایل Open App فعال نیست |
| Direct Link مینی‌اپ `Petdate` | **وجود دارد**: https://t.me/Petdatebot/Petdate |
| URL وب اپ | https://petdate.ir/ |
| `getChatMenuButton` | `web_app` → `https://petdate.ir/` (دکمهٔ نوار چت — **نه** Open App پروفایل) |

متد Bot API برای تنظیم Main Mini App وجود ندارد (`setMainMiniApp` و مشابه → `404 Not Found`). فقط `@BotFather` می‌تواند Main Mini App را فعال کند.

## تفاوت مهم

| قابلیت | کجا دیده می‌شود | چطور تنظیم می‌شود |
|--------|------------------|-------------------|
| **Main Mini App** | دکمهٔ بزرگ **Open App** روی پروفایل ربات | فقط BotFather |
| Menu Button | گوشهٔ پایین چت (کنار فیلد پیام) | Bot API: `setChatMenuButton` (همین الان فعال است) |
| Direct Link | لینک `t.me/Petdatebot/Petdate` | BotFather `/newapp` (از قبل ساخته شده) |

Menu Button را نگه دارید؛ جایگزین Open App پروفایل نیست.

---

## مراحل BotFather برای محمد (الزامی)

URL که باید بدهید: **`https://petdate.ir/`**  
(لینک `t.me/...` را به‌جای URL وب به BotFather ندهید.)

### مسیر پیشنهادی

1. در تلگرام `@BotFather` را باز کنید.
2. بفرستید: `/mybots`
3. ربات **`@Petdatebot`** را انتخاب کنید.
4. بروید: **Bot Settings** → **Configure Mini App** (یا **Mini Apps**).
5. **Enable Mini App** / **Main App** را بزنید.
6. وقتی URL خواست، بفرستید:
   ```
   https://petdate.ir/
   ```
7. در صورت پرسیدن حالت باز شدن (Launch mode): **Fullsize** (یا پیش‌فرض BotFather) مناسب است؛ در صورت نیاز بعداً compact کنید.
8. ذخیره / تأیید را بزنید.

### اگر منوی انگلیسی متفاوت بود

- `/setmenubutton` فقط Menu Button چت را عوض می‌کند — **برای این کار استفاده نکنید**.
- برای Main App همان **Configure Mini App → Enable Mini App** است (نه فقط Menu Button).
- Direct Link با نام کوتاه `Petdate` از قبل هست؛ لازم نیست دوباره `/newapp` بسازید مگر اینکه بخواهید URL همان اپ را اصلاح کنید.

### بعد از فعال‌سازی — چک سریع

از سرور / لوکال (توکن را چاپ نکنید):

```bash
# باید has_main_web_app: true شود
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | python3 -m json.tool | grep main_web
```

یا:

```bash
npm run check:main-mini-app
```

در اپ موبایل تلگرام، پروفایل `@Petdatebot` را باز کنید: زیر About باید دکمهٔ آبی **Open App** ظاهر شود (گاهی یک بار رفرش / بستن و باز کردن تلگرام لازم است).

لینک مستقیم Main App بعد از فعال‌سازی:

- `https://t.me/Petdatebot?startapp`
- مینی‌اپ نام‌دار (از قبل): `https://t.me/Petdatebot/Petdate`

---

## آنچه با API قابل اتوماسیون است (و انجام شده / می‌ماند)

- توضیحات ربات، دستورات، و Menu Button چت → `packages/bot/src/branding.ts`
- Main Mini App → **فقط دستی در BotFather**؛ بعد از فعال‌سازی، `has_main_web_app` را با اسکریپت بالا تأیید کنید.
