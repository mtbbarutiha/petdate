# کیف پول چندارزی (Multi-currency wallet)

کاربر دارای سه موجودی است که در وب کنار آواتار پروفایل نمایش داده می‌شود.

| ارز | فیلد DB | معنی | واریز / خرج |
|-----|---------|------|-------------|
| **سکه ربات** | `users.coins` | اقتصاد فعلی همبازی | فعال (جایزه، خرید کارت/Stars در بات؛ پرداخت فروشگاه؛ تبدیل) |
| **Stars** | `users.wallet_stars` | **موجودی ستاره مشترک با ربات** (نه موجودی بومی Stars حساب تلگرام) | نمایش + **پرداخت فروشگاه** (`POST /api/shop/checkout/stars`)؛ تبدیل ۱:۱ با سکه؛ خرید سکه با فاکتور Telegram Stars در بات جدا از این موجودی است |
| **تومان** | `users.wallet_toman` | IRT | موجودی کیف‌پول — تبدیل به سکه با نرخ خرید ادمین؛ برداشت به کارت |

> ستون legacy `users.wallet_ton` ممکن است در DB بماند؛ از محصول حذف شده و در API/UI نمایش داده نمی‌شود.

## همگام‌سازی تلگرام (صفحه `/wallet`)

- اگر `telegram_id` روی کاربر نیست: دکمه «اتصال به تلگرام» لینک یک‌بارمصرف `t.me/Bot?start=wlink_<token>` می‌سازد؛ ربات با `POST /api/auth/telegram/link-complete` حساب را وصل می‌کند.
- اگر وصل است: وضعیت اتصال + موجودی ستاره از همان `GET /api/auth/wallet` (منبع مشترک با ربات) و دکمه همگام‌سازی/تازه‌سازی.
- ورود ربات→وب: لینک HMAC‌شده `/auth/telegram` → `POST /api/auth/telegram/exchange`.

## نرخ فروشگاه

هم‌تراز اقتصاد ربات (`COIN_PRICE_TOMAN` / `COIN_PRICE_STARS`):

- هر **سکه** ≈ **۲٬۰۰۰ تومان**
- هر **ستاره (wallet)** ≈ **۲٬۰۰۰ تومان** (چون در ربات ۱ سکه = ۱ Star)
- هزینه سبد: `ceil(قیمت_تومان / ۲۰۰۰)` برای سکه یا ستاره

ثابت‌ها در `@petdate/shared`: `COIN_PRICE_TOMAN`, `STAR_PRICE_TOMAN`, `tomanToShopCoins`, `tomanToShopStars`.

## API

- `GET /api/auth/me` → `user.wallet` و فیلدهای `walletTon` / `walletStars` / `walletToman` / `coins` / `telegramId`
- `GET /api/auth/wallet` → `{ ok, wallet, coins, telegram: { linked, telegramId, username } }`
- `POST /api/auth/telegram/link-start` (Bearer) → deep link اتصال
- `POST /api/auth/telegram/link-complete` → تکمیل اتصال از ربات
- `POST /api/auth/telegram/exchange` → ورود وب از لینک امضاشده ربات
- `GET /api/shop/star-rate` → نرخ تومان به‌ازای ستاره
- `POST /api/shop/checkout/coins` — کسر اتمیک `coins`، `payment_currency=coins`
- `POST /api/shop/checkout/stars` — کسر اتمیک `wallet_stars`، `payment_currency=stars`
- `POST /api/admin/wallet/credit` (هدر `x-admin-password`)  
  body: `{ userId, currency: "stars"|"coins"|"toman", amount }`  
  `amount` می‌تواند منفی باشد (برداشت، در صورت موجودی کافی)

## یادداشت

ستون جداگانه‌ای به نام `wallet_coins` نداریم؛ سکه ربات همان `coins` است تا منطق فعلی بات/لجر نشکند.
موجودی بومی Telegram Stars از Bot Payment API به‌عنوان «بالانس کیف» قابل خواندن نیست؛ همگام‌سازی یعنی همان `wallet_stars` محصول.
ربات در منوی سکه، موجودی `wallet_stars` را از همان منبع API/وب نشان می‌دهد (بدون سیلو جدا).


## تبدیل ارز (وب + ادمین)

- کاربر در `/wallet` می‌تواند تومان↔سکه و ستاره↔سکه تبدیل کند.
- نرخ خرید پیش‌فرض: **۲٬۰۰۰ تومان / سکه** (`coinPriceToman`).
- نرخ فروش پیش‌فرض: **۱٬۰۰۰ تومان / سکه** (`coinSellPriceToman`).
- ادمین از **تنظیمات پلتفرم** این دو نرخ را عوض می‌کند.
- API: `GET /api/auth/wallet/rates`, `POST /api/auth/wallet/convert`.

## کمبود سکه

هر جا کسر سکه لازم باشد و موجودی کافی نباشد، وب کاربر را به `/wallet?buy=1` می‌برد و ربات دکمه «🪙 خرید سکه» نشان می‌دهد.

## تأیید کسر

قبل از هر کسر سکه در وب (ساخت/پیوستن ایونت و …) از کاربر تأیید گرفته می‌شود.
