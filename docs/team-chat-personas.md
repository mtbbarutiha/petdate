# Team chat personas → domain AI agents

## FA

پنج چهرهٔ سایت به **سه موتور دامنه** وصل است (استک موجود `ai-consult`، استک موازی ساخته نشد).

| شخصیت | دامنه / موتور | مسیر چت |
|--------|----------------|----------|
| فرانک احمدی | مربی (جایگزین پاشا؛ خودمعرفی) | `/team-chat/faranak-ahmadi` |
| لیلا کیانی | مربی | `/team-chat/leila-kiani` |
| دکتر ساناز غفاری | دامپزشک | `/team-chat/sanaz-ghaffari` |
| دکتر سارا نوری | دامپزشک | `/team-chat/sara-noori` |
| یلدا شعبانی | پشتیبانی (+ تیکت) | `/support/chat` |

عکس‌ها: `packages/web/public/agents/<slug>.jpg?v=persona-v2` (چهره‌های متمایز v2).

## EN

Five landing faces share three existing LLM roles (`trainer` | `vet` | `support`) in `packages/api/src/services/ai-consult.ts`.

- Out-of-domain answers name the right colleague **and** the route above.
- Faranak introduces herself and continues the former Pasha coach role.
- Vets triage clinical photos (vision when `AI_CONSULT_API_KEY` is set) + disclaimer.
- Yalda knows site workflow, can open/track tickets, mentions SMS only when the product already sends it, asks the owner when unknown.

Cache bust: `tmp/cache-bust-sara-noori-vet-link-v1` → SW `petdate-web-v46-sara-noori-vet`.

Sara (`/team-chat/sara-noori`) and Sanaz (`/team-chat/sanaz-ghaffari`) share the same `vet` / دامپزشک `ai-consult` engine. Sara’s synthetic telegram id stays `petdate_ai_sara_nozi` (existing DB row); `petdate_ai_sara_noori` is an alias so resolve never falls through to trainer.
