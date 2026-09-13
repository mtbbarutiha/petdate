# Grok Bot (گراک بات) ↔ Petdate team agents

Exactly **four** public personas — same roster as Grok Bot, not a parallel chat system.

| Grok Bot key | Site slug | Role | Domain | Grok agent id | Chat |
|---|---|---|---|---|---|
| `faranak_ahmadi` | `faranak-ahmadi` | مربی | trainer | `b6e496b5-0b15-4c9b-852d-644d3f5e411a` | `/team-chat/faranak-ahmadi` |
| `leila_kiani` | `leila-kiani` | مدیر مالی | finance | `2410554d-9496-4a60-9b15-4248dcc6e725` | `/team-chat/leila-kiani` |
| `sanaz_ghaffari` | `sanaz-ghaffari` | پشتیبانی | support | `18a4d76a-1900-49dc-964c-27d23abb31e9` | `/support/chat` |
| `sara_noori` | `sara-noori` | دامپزشک | vet | `0140b645-f844-45c1-b6d8-3f06514529de` | `/team-chat/sara-noori` |

**Not public:** یلدا شعبانی — `/team-chat/yalda-shabani` and name aliases resolve to ساناز. Only **one** vet (سارا).

Code: `packages/shared/src/team-agents.ts` + `packages/api/src/services/grok-bot-bridge.ts`.  
Public list: `GET /api/consultations/team-agents` (4 agents; `grokBot.id` + `linked` + `llmLive`).

## Important: roster UUID ≠ live LLM

Grok Bot **share/agent UUIDs** are for the Grok Bot desktop app (identity / Add to Grok Bot). xAI does **not** expose a public HTTP API to “invoke agent `b6e496b5-…` by UUID”.

Live site answers use **OpenAI-compatible Chat Completions** via `ai-consult` (provider chain):

| Env | Effect |
|---|---|
| `AI_CONSULT_API_KEY` / `OPENAI_API_KEY` | Preferred OpenAI-compatible base URL/model |
| `XAI_API_KEY` | `https://api.x.ai/v1` + Grok — needs credits (403 → marked dead) |
| `GROQ_API_KEY` | Free-tier fallback (`api.groq.com/openai/v1`) |
| `OPENROUTER_API_KEY` | Fallback; prefer a `:free` model |
| `AI_CONSULT_FALLBACK_*` | Explicit second OpenAI-compatible endpoint |
| Pollinations (default on) | Keyless last resort; shared budget often exhausts |
| *(none usable)* | Offline Persian KB (بشین / دست بده / …) — never a hard error |

`GET /api/consultations/team-agents` fields:

- `grokBot.linked` — roster identity present (baked UUID). **Does not mean live Grok.**
- `llmLive` — `true` only when at least one provider is configured **and** not billing/budget-blocked.
- `llmProvider` — active provider id (`xai` / `groq` / `openrouter` / `pollinations` / …).

Ids are baked into `TEAM_AGENTS.grokBotId`. Public `grokBot.id` always equals `grokBotId`. Optional on `/opt/petdate/.env`:

```bash
GROK_BOT_FARANAK_AHMADI_URL=https://x.ai/…
# Live coaching without buying xAI credits — paste a free Groq key:
GROQ_API_KEY=gsk_…          # https://console.groq.com (free tier)
# or OpenRouter :free model:
OPENROUTER_API_KEY=sk-or-…
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
# optional keep xAI for later (403 no-credits will not fake llmLive):
XAI_API_KEY=xai-…
XAI_MODEL=grok-4-fast-non-reasoning
```

After setting a key: `pm2 restart petdate-api --update-env`.

## How users chat

Logged-in landing **شروع مشاوره** → `/team-chat/:slug` (trainer/finance/vet) or `/support/chat` (ساناز). Each agent introduces themselves with the roster name above. Replies go through `generateAiConsultAdvice` (LLM when keyed, else offline topic KB).
