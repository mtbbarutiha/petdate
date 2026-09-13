# Team chat personas → domain AI agents

## FA

چهار چهرهٔ لندینگ + یلدا در هاب پشتیبانی. هر کدام به **موتور دامنه و Grok Bot زنده** وصل است.

| شخصیت | نقش | دامنه | مسیر چت | Grok agent id |
|--------|------|--------|----------|----------------|
| فرانک احمدی | مربی | trainer | `/team-chat/faranak-ahmadi` | `b6e496b5-0b15-4c9b-852d-644d3f5e411a` |
| لیلا کیانی | مدیر مالی | finance | `/team-chat/leila-kiani` | `2410554d-9496-4a60-9b15-4248dcc6e725` |
| ساناز غفاری | پشتیبانی | support | `/team-chat/sanaz-ghaffari` | `18a4d76a-1900-49dc-964c-27d23abb31e9` |
| دکتر سارا نوری | دامپزشک | vet | `/team-chat/sara-noori` | `0140b645-f844-45c1-b6d8-3f06514529de` |
| یلدا شعبانی | پشتیبانی | support | `/support/chat` | همان ایجنت ساناز (`18a4d76a-…`) |

فقط **یک** دامپزشک: سارا. ساناز دامپزشک نیست. لیلا مربی نیست.

عکس‌ها: `packages/web/public/agents/<slug>.jpg?v=persona-v2`.

Cache bust: `tmp/cache-bust-persona-roles-remap-v1` → SW `petdate-web-v47-persona-roles`.

## EN

Landing `#team` cards and `/team-chat/:slug` use `TEAM_AGENTS` kinds (`trainer` | `finance` | `support` | `vet`) in `packages/api/src/services/ai-consult.ts`.

Grok engine ids are baked into `TEAM_AGENTS.grokBotId` and exposed by `GET /api/consultations/team-agents` (`grokBot.id` + `grokBot.linked`). Replies still go through the existing ai-consult path with that persona’s system prompt — not a parallel stub stack.

Sara’s synthetic telegram id stays `petdate_ai_sara_nozi` (existing DB row); `petdate_ai_sara_noori` is an alias so resolve never falls through to trainer.
