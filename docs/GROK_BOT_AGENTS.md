# Grok Bot (گراک بات) ↔ Petdate team agents

Mohammad’s **Grok Bot** roster (Persian: گراگ/گراک بات) maps onto **four** site personas — not a second chat system.

| Grok Bot key | Site slug | Domain | Chat | VPS bot id (known) |
|---|---|---|---|---|
| `faranak_ahmadi` | `faranak-ahmadi` | trainer | `/team-chat/faranak-ahmadi` | `b6e496b5-0b15-4c9b-852d-644d3f5e411a` |
| `leila_kiani` | `leila-kiani` | finance | `/team-chat/leila-kiani` | *(missing — set `GROK_BOT_LEILA_KIANI_ID` when provisioned; site still serves لیلا via xAI + finance system prompt)* |
| `sanaz_ghaffari` | `sanaz-ghaffari` | support | `/support/chat` | `18a4d76a-1900-49dc-964c-27d23abb31e9` |
| `sara_noori` | `sara-noori` | vet | `/team-chat/sara-noori` | `0140b645-f844-45c1-b6d8-3f06514529de` |

**Not public:** یلدا شعبانی — old support URLs (`/team-chat/yalda-shabani`) redirect to ساناز. There is **no second vet**; ساناز is support only.

Code: `packages/shared/src/team-agents.ts` + `packages/api/src/services/grok-bot-bridge.ts`.  
Public list: `GET /api/consultations/team-agents` (includes `grokBotKey` + optional link status).

## VPS env (recommended)

On `/opt/petdate/.env`:

```bash
# Domain Grok Bot IDs (role remapped)
GROK_BOT_FARANAK_AHMADI_ID=b6e496b5-0b15-4c9b-852d-644d3f5e411a
GROK_BOT_SARA_NOORI_ID=0140b645-f844-45c1-b6d8-3f06514529de
GROK_BOT_SANAZ_GHAFFARI_ID=18a4d76a-1900-49dc-964c-27d23abb31e9
# Finance bot — paste when available (لیلا still chats via XAI_API_KEY + finance prompt):
# GROK_BOT_LEILA_KIANI_ID=

# Or JSON map
# GROK_BOT_AGENT_MAP={"faranak_ahmadi":{"id":"b6e496b5-…"},"sara_noori":{"id":"0140b645-…"},"sanaz_ghaffari":{"id":"18a4d76a-…"}}

# Live answers (required for non-stub replies)
XAI_API_KEY=xai-…
# defaults: base https://api.x.ai/v1 , model grok-4-fast-non-reasoning
```

Then `pm2 restart petdate-api`. Linked flags appear in `/api/consultations/team-agents`.

## How users chat

Logged-in landing **شروع مشاوره** on each card → trainer/vet/finance `/team-chat/:slug` or support `/support/chat`. Each agent introduces themselves with the roster name above.
