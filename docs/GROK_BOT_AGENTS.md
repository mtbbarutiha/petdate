# Grok Bot (گراک بات) ↔ Petdate team agents

Mohammad’s **Grok Bot** roster (Persian: گراگ/گراک بات) is the same site personas — not a second chat system.

| Grok Bot key | Site slug | Role | Domain | Grok agent id | Chat |
|---|---|---|---|---|---|
| `faranak_ahmadi` | `faranak-ahmadi` | مربی | trainer | `b6e496b5-0b15-4c9b-852d-644d3f5e411a` | `/team-chat/faranak-ahmadi` |
| `leila_kiani` | `leila-kiani` | مدیر مالی | finance | `2410554d-9496-4a60-9b15-4248dcc6e725` | `/team-chat/leila-kiani` |
| `sanaz_ghaffari` | `sanaz-ghaffari` | پشتیبانی | support | `18a4d76a-1900-49dc-964c-27d23abb31e9` | `/team-chat/sanaz-ghaffari` |
| `sara_noori` | `sara-noori` | دامپزشک | vet | `0140b645-f844-45c1-b6d8-3f06514529de` | `/team-chat/sara-noori` |
| `yalda_shabani` | `yalda-shabani` | پشتیبانی | support | `18a4d76a-1900-49dc-964c-27d23abb31e9` | `/support/chat` |

Code: `packages/shared/src/team-agents.ts` + `packages/api/src/services/grok-bot-bridge.ts`.  
Public list: `GET /api/consultations/team-agents` (includes `kind`, `role`, `grokBotKey`, `grokBotId`, `grokBot.id`, `linked`).

Baked-in ids mean each persona is linked without VPS env. Optional override on `/opt/petdate/.env`:

```bash
GROK_BOT_FARANAK_AHMADI_ID=…
GROK_BOT_FARANAK_AHMADI_URL=https://x.ai/…
GROK_BOT_AGENT_MAP={"faranak_ahmadi":{"id":"…","url":"…"},"yalda_shabani":{"url":"…"}}
```

Then `pm2 restart petdate-api`.

## How users chat

Landing `#team` → «شروع مشاوره» → `/team-chat/:slug` → `POST /api/consultations/team-agent` → existing `ai-consult` engine with that persona’s kind + name/role intro. Grok Bot ids identify the live agent roster; replies use the matching domain prompt (not offline stubs of the wrong role).
