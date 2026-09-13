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
Public list: `GET /api/consultations/team-agents` (4 agents; `grokBot.id` + `linked`).

Ids are baked into `TEAM_AGENTS.grokBotId`. Public `grokBot.id` always equals `grokBotId` (stale `GROK_BOT_*_ID` remaps are ignored). Optional URL on `/opt/petdate/.env`:

```bash
GROK_BOT_FARANAK_AHMADI_URL=https://x.ai/…
GROK_BOT_AGENT_MAP={"sanaz_ghaffari":{"url":"…"}}
XAI_API_KEY=xai-…   # live answers via ai-consult (not offline stubs)
```

## How users chat

Logged-in landing **شروع مشاوره** → `/team-chat/:slug` (trainer/finance/vet) or `/support/chat` (ساناز). Each agent introduces themselves with the roster name above.
