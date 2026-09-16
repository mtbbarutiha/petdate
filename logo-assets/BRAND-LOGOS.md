# لوگوهای بات و کانال

همه از **لوگو مادر** (`packages/web/public/pepito/img/logo.png`) ساخته می‌شوند:

```bash
python3 packages/web/scripts/generate-brand-assets.py
```

## بات `@Petdatebot`

- فقط مارک (سگ+گربه، بدون تایپ «Pet Date») روی زمینه صورتی ملایم
- فایل‌ها: `logo-assets/telegram/bot-profile-*.jpg`
- فعال در ربات: `packages/bot/assets/bot-profile.jpg` + `welcome-logo.jpg`
- آپلود پروفایل: BotFather (Edit Botpic) یا API

## کانال / پنل `@petdating`

- مارک + تایپ «Pet Date» به‌صورت stacked (عمودی) تا در کراپ دایره‌ای نشکند — زمینه بنفش ملایم
- فایل‌ها: `logo-assets/telegram/panel-profile-*.jpg`
- آپلود پروفایل کانال: تنظیمات کانال → Edit → Photo (یا `setChatPhoto` توسط بات ادمین)

جزئیات: [`telegram/README.md`](./telegram/README.md)

## آرشیو نئون (قدیمی)

پوشه‌های `neon/` و `petdating-channel/` نسخه‌های نئون قبلی‌اند؛ مرجع فعلی مادر است.
