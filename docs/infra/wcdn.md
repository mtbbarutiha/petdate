# ParsPack WCDN + origin (petdate.ir)

Live topology confirmed 2026-09-11 (after #213):

| Host | Edge | Origin pull |
|------|------|-------------|
| `https://petdate.ir` | Origin nginx (`server: nginx`) | Direct TLS to VPS |
| `https://www.petdate.ir` | ParsPack **WCDN 3.9.6** (`wcdn-cache-policy: SMART`) | Flexible SSL → origin `:80` |
| `http://www.petdate.ir` | WCDN / OpenResty **301** → `https://www.petdate.ir/` | Never hits origin |
| `http://petdate.ir` | Origin nginx `:80` | Direct — **301** to HTTPS when not a CDN pull |

Flexible SSL means: browser → CDN is HTTPS; CDN → origin is HTTP. Origin **must not** 301 every `:80` request, or www origin-pulls loop.

## HTTP → HTTPS (`http://petdate.ir/`)

`infra/nginx/petdate.conf` redirects **apex** HTTP to HTTPS when the request is not a CDN pull:

- `$host = petdate.ir` **and**
- `X-Forwarded-Proto` is not `https` **and**
- no `WCDN-Edge` request header

www `:80` stays HTTP 200 for Flexible origin pulls. `http://www.petdate.ir/` is already forced at the CDN edge.

**Do not** add a blanket `:80` `return 301 https://$host…` for `www.petdate.ir`.

If apex is later moved behind Flexible SSL without those headers, switch to a CDN “Always HTTPS” rule and remove the origin apex redirect.

## Profile avatar upload (`POST /api/auth/avatar`)

Origin nginx used a prefix `location ^~ /api/auth/avatar/` for immutable file GETs.
That made bare `POST /api/auth/avatar` (no trailing slash) **301 → `/api/auth/avatar/`**.
Browsers then rewrite the redirected request to **GET** and drop the multipart body —
the SPA shows a generic upload / «API error».

Fix: keep an exact `location = /api/auth/avatar` that proxies the upload, and leave
`location ^~ /api/auth/avatar/` for stored files only (`/api/auth/avatar/{userId}/{file}`).

| Request | Before | After |
|---------|--------|-------|
| `POST /api/auth/avatar` (multipart) | nginx **301** HTML | proxied to Express (401 without auth, 201 on success) |
| `GET /api/auth/avatar/9/uuid.jpg` | 200 JPEG | unchanged |

## www API 4xx bodies (JSON vs WCDN HTML)

Origin always returns JSON for `/api/*` errors (`Content-Type: application/json`, `X-Content-Type-Options: nosniff`, `X-PetDate-API: 1`).

| Request | Status | Body |
|---------|--------|------|
| `https://petdate.ir/api/pets/mine` (no auth) | 401 | `{"error":"وارد نشده‌اید"}` |
| `https://www.petdate.ir/api/pets/mine` (no auth) | 401 | WCDN HTML **Upstream Error - Unauthorized** (~50KB) |

Confirmed with `Accept: application/json`. The wrap happens **after** origin (`wcdn-nfc-reason: CacheControl_Header`). nginx cannot keep the JSON body on www without changing status codes (breaks clients) or turning Flexible SSL off.

**CDN-only fix** (ParsPack panel — does not affect Flexible SSL):

1. CDN → domain `www.petdate.ir` → **صفحات سفارشی** (Custom pages).
2. Enable **نمایش خطای سرور مقصد** (show origin-server errors) so 4xx/5xx from `/api/*` pass through.
3. Or disable custom error pages for HTTP 400 / 401 / 403 / 404 on this hostname.

Until that toggle is on, treat www HTML 4xx as a **WCDN custom-error-page limit**. Apex JSON is the source of truth.

**SPA clients must not call `response.json()` blindly on non-OK (or even OK) bodies.** `packages/web/src/lib/api.ts` reads text first and maps HTML / parse failures to short Persian messages via `apiErrorMessage.ts` (see `apiErrorMessage.selftest.ts`). Otherwise the profile medical card shows `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.

## SPA routes under `/pets/` (stock photos vs medical tab)

`packages/web/public/pets/` holds stock JPGs (`/pets/cat-01.jpg`, …). Origin nginx used to pin `location ^~ /pets/ { try_files $uri =404; }`, which **hard-404’d SPA deep links**:

| URL | Before | After |
|-----|--------|-------|
| `/pets/cat-01.jpg` | 200 JPEG | 200 JPEG (cached 7d) |
| `/pets/35` / `/pets/35?tab=medical` / `/pets/35/edit` | nginx **404** (WCDN «Upstream Error - Not Found» on www) | SPA `index.html` (no-cache) |

Mobile owners opening «پرونده پزشکی» from My Pets use `/pets/:id#pet-medical` (hash is **not** sent to the CDN, so a poisoned `?tab=medical` WCDN 404 cannot stick). Legacy `?tab=medical` still works once the edge entry expires or is purged. Public share URLs stay `/pet/:slug` (singular).

**After origin fix:** if www still serves «Upstream Error - Not Found» for an old URL, purge that path in the ParsPack panel (or open `/pets/:id` / `#pet-medical` instead). New responses under `/pets/:id` are `Cache-Control: no-cache`.

Docs: [تنظیمات دیگر CDN پارس‌پک](https://docs.parspack.com/cdn/other-settings/).

## What origin will not do

- Do not remap API 4xx → HTTP 200 `{ ok:false }` just to dodge WCDN error pages.
- Do not force HTTPS on www `:80` (Flexible SSL).
- Do not 301 www → apex on origin (do that in the CDN panel if desired).
