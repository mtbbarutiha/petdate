# Team chat personas → domain AI agents

## FA

چهار چهرهٔ عمومی لندینگ. یلدا عمومی نیست و به ساناز هدایت می‌شود.

| شخصیت | نقش | دامنه | مسیر چت | Grok agent id |
|--------|------|--------|----------|----------------|
| فرانک احمدی | مربی | trainer | `/team-chat/faranak-ahmadi` | `b6e496b5-0b15-4c9b-852d-644d3f5e411a` |
| لیلا کیانی | مدیر مالی | finance | `/team-chat/leila-kiani` | `2410554d-9496-4a60-9b15-4248dcc6e725` |
| ساناز غفاری | پشتیبانی | support | `/support/chat` | `18a4d76a-1900-49dc-964c-27d23abb31e9` |
| سارا نوری | دامپزشک | vet | `/team-chat/sara-noori` | `0140b645-f844-45c1-b6d8-3f06514529de` |

فقط **یک** دامپزشک: سارا. ساناز دامپزشک نیست. لیلا مربی نیست.

## EN

Public `TEAM_AGENTS` length is 4. `GET /api/consultations/team-agents` exposes those four with baked Grok ids. Support hub and landing support CTA use ساناز غفاری.
