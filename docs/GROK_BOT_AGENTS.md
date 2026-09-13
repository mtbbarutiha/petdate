# Grok Bot (گراک بات) ↔ Petdate team agents

Mohammad’s **Grok Bot** roster (Persian: گراگ/گراک بات) is the same five site personas — not a second chat system.

| Grok Bot key | Site slug | Domain | Chat |
|---|---|---|---|
| `faranak_ahmadi` | `faranak-ahmadi` | trainer | `/team-chat/faranak-ahmadi` |
| `leila_kiani` | `leila-kiani` | trainer | `/team-chat/leila-kiani` |
| `sanaz_ghaffari` | `sanaz-ghaffari` | vet | `/team-chat/sanaz-ghaffari` |
| `sara_noori` | `sara-noori` | vet | `/team-chat/sara-noori` |
| `yalda_shabani` | `yalda-shabani` | support | `/support/chat` |

Code: `packages/shared/src/team-agents.ts` + `packages/api/src/services/grok-bot-bridge.ts`.  
Public list: `GET /api/consultations/team-agents` (includes `grokBotKey` + optional link status).

## Optional: paste Grok Bot share id/URL

On the VPS `/opt/petdate/.env`:

```bash
# One agent
GROK_BOT_FARANAK_AHMADI_ID=…
GROK_BOT_FARANAK_AHMADI_URL=https://x.ai/…

# Or JSON map (keys = grokBotKey)
GROK_BOT_AGENT_MAP={"faranak_ahmadi":{"id":"…","url":"…"},"yalda_shabani":{"url":"…"}}
```

Then `pm2 restart petdate-api`. Linked flags appear in `/api/consultations/team-agents`.

## Optional: run site chat on xAI (Grok models)

Same OpenAI-compatible consult path:

```bash
XAI_API_KEY=xai-…
# defaults: base https://api.x.ai/v1 , model grok-4-fast-non-reasoning
# or set explicitly:
# AI_CONSULT_BASE_URL=https://api.x.ai/v1
# AI_CONSULT_MODEL=grok-4-fast-non-reasoning
```

Aliases also work: `AI_CONSULT_API_KEY` / `OPENAI_*`. Whisper STT still expects an OpenAI-compatible STT endpoint.

## How users chat

Landing team cards / `/team-chat/:slug` / support hub — unchanged. Grok Bot ops agents and site personas share the same names, domains, and slugs.

## Staff / admin logins

The same five public faces (plus four ops-only agents) get `admin_accounts` + HR rows from `STAFF_AGENTS` (`packages/shared/src/staff-agents.ts`). Seed is idempotent on `ensureHrSchema()`.

| Username | Role key | Notes |
|---|---|---|
| `sanaz` / `sara` | `veterinarian` | consults + magazine medical |
| `yalda` | `support` | tickets / inbox / CRM (existing support pack) |
| `faranak` / `leila` | `trainer` | consult list |
| `staff.designer` | `designer` | hero + magazine media |
| `staff.social` | `social` | notices + magazine |
| `staff.shop` | `shop_procurement` | products / prices / stock |
| `staff.content` | `content_editor` | magazine CMS |

Password: `ADMIN_STAFF_PASSWORD` or `ADMIN_SEED_PASSWORD`. Existing hashes are never overwritten — reset from `/admin/hr/employees` → reset password.
