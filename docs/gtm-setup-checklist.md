# GTM + UTM setup — petdate.ir

Container: **GTM-KQPJT9Q4** (live in `packages/web/index.html`)  
Clarity: **ygkl5nck6k**  
GA4 Measurement ID: set in admin «آنالیتیکس» / platform settings (`ga4MeasurementId`) — never invent one.

Admin:
- `/admin/analytics` (site reports hub) — tabs: نمای کلی / رویدادها / UTM / راه‌اندازی / Tag Manager / Clarity
- `/admin/tag-manager` — catalog + first-party metrics

## First-party analytics (source of truth for admin charts)

SPA fires `/api/analytics/collect` on every public route change with:
`sessionId`, path, referrer, persisted `utm_*` + `gclid`/`fbclid`, device, language, country (CF-IPCountry when nginx forwards it).

UTM first-touch: parse URL on landing → `sessionStorage` + cookie → attach to every beacon.

## GTM UI (no Admin API OAuth in this environment)

Use admin tab **راه‌اندازی** for click-by-click steps, or:

1. **Variables** — Data Layer: `page_path`, `page_title`, `page_location`, `page_type`, `user_id`, `user_status`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `fbclid`, `click_*` …
2. **Triggers** — Custom Event per `page_view`, `link_click`, `login`, `sign_up`, `purchase`, …
3. **Tags** — GA4 Configuration (Send page view = False) + GA4 Event tags + Conversion Linker (All Pages)

Shared catalog: `packages/shared/src/gtm-contract.ts`.

## Verify

```bash
# sample UTM collect
curl -sS -X POST https://petdate.ir/api/analytics/collect \
  -H 'Content-Type: application/json' -H 'CF-IPCountry: IR' \
  -d '{"sessionId":"verify-sess-0001","path":"/shop","referrer":"https://t.me/x","utmSource":"telegram","utmMedium":"social","utmCampaign":"verify","language":"fa-IR","screenW":390,"userAgent":"Mozilla/5.0 (iPhone)","eventType":"pageview"}'

# admin → آنالیتیکس: ترافیک روزانه / صفحات پربازدید / نشست‌های اخیر باید پر باشد
```
