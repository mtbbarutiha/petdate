# Pre-launch checklist / چک‌لیست پیش از لانچ

Short human steps only. Code/ops gates for backup, ready-health, and demo-seed skip are already on `main` (#389).

## GO (shipped in code)

- Card-to-card **fails closed** if `PAYMENT_CARD_NUMBER` / `PAYMENT_CARD_HOLDER` are missing or are the old hardcoded default.
- Production rejects admin bootstrap password `petdate`.
- Public `/api/health/candoo` and `/api/health/infra` are **404** without admin auth (SMS balance / infra no longer public).
- Bot **never** `setWebhook` without an HTTP listener — always polling.
- FAQ / magazine / games / invite LandingChrome reserve mobile dock clearance.

## Human (must do before launch)

| EN | FA |
|----|----|
| Confirm `/admin` password is **not** `petdate`. Set a strong `ADMIN_PASSWORD` on the VPS if verify-prod-env says `DEFAULT-RISK`. | رمز `/admin` را تأیید کن که `petdate` نباشد. اگر verify-prod-env گفت `DEFAULT-RISK`، `ADMIN_PASSWORD` قوی بگذار. |
| Smoke OTP: one real SMS (Candoo) + one email to `no-reply@petdate.ir`. | یک پیامک واقعی و یک ایمیل OTP را تست کن. |
| Confirm card-to-card shows the **live** destination card (wallet + shop + bot). | کارت واریز زنده را در کیف پول، شاپ و ربات ببین. |
| Wait for mail PTR / deliverability after DNS to `185.110.189.218` (proxy off). | بعد از اصلاح DNS ایمیل، PTR و inbox را چک کن. |
| Log into admin **Monitoring** (deep probes). Liveness `GET /api/health` is not enough. | با مانیتورینگ ادمین لاگین کن؛ `/api/health` فقط liveness است. |
| Keep `BOT_WEBHOOK_URL` **empty** on the VPS. | `BOT_WEBHOOK_URL` را خالی بگذار. |
| Do **not** set `ALLOW_DEMO_SEEDS=1` in production. | در پروداکشن `ALLOW_DEMO_SEEDS=1` نگذار. |

## Out of scope here

ParsPack/WCDN DNS changes, rotating live secrets, interactive Telegram/admin login from CI.
