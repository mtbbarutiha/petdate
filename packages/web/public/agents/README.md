# Team chat persona avatars

Canonical URLs used by `TEAM_AGENTS` (`packages/shared/src/team-agents.ts`).
Chat + landing append `?v=persona-v4` and prefer `-480.webp` (with `-240.webp` in `srcset`) so Lighthouse stops downloading 1024² JPEGs for ~240 CSS px cards.

| File | Persona | Route | Look |
|------|---------|-------|------|
| `faranak-ahmadi.jpg` (+ `-240.webp` / `-480.webp`) | فرانک احمدی (مربی) | `/team-chat/faranak-ahmadi` | Short copper bob, terracotta polo |
| `leila-kiani.jpg` (+ `-240.webp` / `-480.webp`) | لیلا کیانی (مدیر مالی) | `/team-chat/leila-kiani` | Long highlighted hair, dusty rose shirt |
| `sanaz-ghaffari.jpg` (+ `-240.webp` / `-480.webp`) | ساناز غفاری (پشتیبانی) | `/support/chat` | Older, bun, freckles, teal scrubs |
| `sara-noori.jpg` (+ `-240.webp` / `-480.webp`) | سارا نوری (دامپزشک) | `/team-chat/sara-noori` | Young, bangs, big smile, navy + lab coat |
| `yalda-shabani.jpg` | یلدا شعبانی (staff only) | — | Beige blazer; not a public TEAM_AGENTS row |
| `staff-designer.jpg` | گرافیست (ops) | admin / HR roster | 720² circle, curls, peach, black sweater |
| `staff-social.jpg` | سوشال (ops) | admin / HR roster | 720² circle, bob, yellow blazer, mint |
| `staff-shop.jpg` | مدیر تامین فروشگاه (ops) | admin / HR roster | 720² circle, olive shirt (man) |
| `staff-content.jpg` | تولید محتوا (ops) | admin / HR roster | 720² circle, gold glasses, blue shirt |

Do not rename the master `.jpg` files; chat UI, support header, and synthetic user avatars resolve `/agents/<slug>-480.webp` (JPG kept as source / fallback).
Ops-only staff portraits are used by `STAFF_AGENTS` + HR personnel seed (`avatar_url`), not landing cards.
