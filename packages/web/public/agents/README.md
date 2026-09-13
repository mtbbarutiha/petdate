# Team chat persona avatars

Canonical URLs used by `TEAM_AGENTS` (`packages/shared/src/team-agents.ts`).
Chat + landing append `?v=persona-v3` so clients drop older persona layouts.

| File | Persona | Route | Look |
|------|---------|-------|------|
| `faranak-ahmadi.jpg` | فرانک احمدی (مربی) | `/team-chat/faranak-ahmadi` | Short copper bob, terracotta polo |
| `leila-kiani.jpg` | لیلا کیانی (مدیر مالی) | `/team-chat/leila-kiani` | Long highlighted hair, dusty rose shirt |
| `sanaz-ghaffari.jpg` | ساناز غفاری (پشتیبانی) | `/support/chat` | Older, bun, freckles, teal scrubs |
| `sara-noori.jpg` | سارا نوری (دامپزشک) | `/team-chat/sara-noori` | Young, bangs, big smile, navy + lab coat |
| `yalda-shabani.jpg` | یلدا شعبانی (staff only) | — | Beige blazer; not a public TEAM_AGENTS row |
| `staff-designer.jpg` | گرافیست (ops) | admin / HR roster | 720² circle, curls, peach, black sweater |
| `staff-social.jpg` | سوشال (ops) | admin / HR roster | 720² circle, bob, yellow blazer, mint |
| `staff-shop.jpg` | مدیر تامین فروشگاه (ops) | admin / HR roster | 720² circle, olive shirt (man) |
| `staff-content.jpg` | تولید محتوا (ops) | admin / HR roster | 720² circle, gold glasses, blue shirt |

Do not rename these files; chat UI, support header, and synthetic user avatars resolve `/agents/<slug>.jpg`.
Ops-only staff portraits are used by `STAFF_AGENTS` + HR personnel seed (`avatar_url`), not landing cards.
