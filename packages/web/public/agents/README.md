# Team chat persona avatars

Canonical URLs used by `TEAM_AGENTS` (`packages/shared/src/team-agents.ts`):

| File | Persona | Notes |
|------|---------|--------|
| `faranak-ahmadi.jpg` | فرانک احمدی (مربی) | Same portrait as landing `/pepito/uploads/01-3.jpg` |
| `leila-kiani.jpg` | لیلا کیانی (مربی) | Same as `/pepito/uploads/02-3.jpg` |
| `sanaz-ghaffari.jpg` | دکتر ساناز غفاری (دامپزشک) | Same as `/pepito/uploads/03-3.jpg` |
| `sara-noori.jpg` | دکتر سارا نوری (دامپزشک) | Same as `/pepito/uploads/04-3.jpg` |
| `yalda-shabani.jpg` | یلدا شعبانی (پشتیبانی) | Warm professional headshot (beige blazer). Chat + landing use `?v=yalda-v1` to bust the old YS placeholder. |

Do not rename these files; chat UI, support header, and synthetic user avatars resolve `/agents/<slug>.jpg`.
