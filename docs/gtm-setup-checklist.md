# GTM setup checklist — petdate.ir

Container: **GTM-KQPJT9Q4** (live in `packages/web/index.html`)  
Clarity: **ygkl5nck6k**  
Public SPA pushes a documented `dataLayer` contract; Tags inside Google’s container are created in the GTM UI (no Admin API OAuth in this repo).

Admin report: `/admin/tag-manager`

## Site contract (already shipped)

### Variables (dataLayer keys)

| Key | When |
| --- | --- |
| `page_path`, `page_title`, `page_location`, `page_type` | every `page_view` |
| `user_id`, `user_status` | every `page_view` / auth events (`guest` \| `logged_in`) |
| `click_text`, `click_url`, `click_id`, `link_kind` | link tracking |
| `form_id`, `form_name` | `generate_lead` |
| `currency`, `value`, `items`, `transaction_id` | shop ecommerce |
| `ga4_measurement_id` | first init **only if** `VITE_GA4_MEASUREMENT_ID` is set |

Helper: `pushDataLayer(event, payload)` in `packages/web/src/lib/siteAnalytics.ts`.

### Triggers / Custom Events

| Event | Where |
| --- | --- |
| `page_view` | SPA route changes (not `/admin`) |
| `link_click` | CTA / outbound / telegram / download / contact |
| `outbound_click` | external links |
| `file_download` | file / `download` links |
| `login` / `sign_up` | OTP + Telegram link success |
| `generate_lead` | footer newsletter |
| `view_item` / `add_to_cart` / `begin_checkout` / `purchase` | shop |
| `scroll` | 75% depth once per path |

Shared catalog: `packages/shared/src/gtm-contract.ts`.

## Create inside GTM UI

1. **Variables** — Data Layer Variables for the keys above; optional Constant/DL for GA4 Measurement ID.
2. **Triggers** — Custom Event triggers matching each event name (`page_view`, `login`, …).
3. **Tags** (require a real Measurement ID — use `PLACEHOLDER_G-XXXXXXXX` until `VITE_GA4_MEASUREMENT_ID` exists):
   - GA4 Configuration (do **not** auto-send page_view if you use the SPA `page_view` event tag)
   - GA4 Event tags for `page_view` + other Custom Events
   - Conversion Linker (All Pages)
4. Exclude `/admin` via exception triggers if needed (site already skips admin).

## Env

```bash
VITE_GTM_ID=GTM-KQPJT9Q4
GTM_ID=GTM-KQPJT9Q4
# VITE_GA4_MEASUREMENT_ID=G-XXXXXXXX   # optional — do not invent
```

## Deep links

- [Google Tag Manager](https://tagmanager.google.com/) — search container `GTM-KQPJT9Q4`
- [Tag Assistant](https://tagassistant.google.com/)
- [Clarity](https://clarity.microsoft.com/projects/view/ygkl5nck6k/)
