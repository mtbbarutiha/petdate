# Team chat persona avatars

Canonical URLs used by `TEAM_AGENTS` (`packages/shared/src/team-agents.ts`).
Chat + landing append `?v=persona-v2` so clients drop pepito lookalikes and the YS / yalda-v1 files.

| File | Persona | Route | v2 look |
|------|---------|-------|---------|
| `faranak-ahmadi.jpg` | فرانک احمدی (مربی) | `/team-chat/faranak-ahmadi` | Short copper bob, terracotta polo |
| `leila-kiani.jpg` | لیلا کیانی (مدیر مالی) | `/team-chat/leila-kiani` | Long highlighted hair, dusty rose shirt |
| `sanaz-ghaffari.jpg` | ساناز غفاری (پشتیبانی) | `/team-chat/sanaz-ghaffari` | Older, bun, freckles, teal scrubs |
| `sara-noori.jpg` | دکتر سارا نوری (دامپزشک) | `/team-chat/sara-noori` | Young, bangs, big smile, navy + lab coat |
| `yalda-shabani.jpg` | یلدا شعبانی (پشتیبانی) | `/support/chat` | Beige blazer, cream studio background |

Do not rename these files; chat UI, support header, and synthetic user avatars resolve `/agents/<slug>.jpg`.
