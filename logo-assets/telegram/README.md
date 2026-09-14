# Telegram profile logos (from لوگو مادر)

Source: `packages/web/public/pepito/img/logo.png`  
Regenerate: `python3 packages/web/scripts/generate-brand-assets.py`

| Asset | Content | Upload target |
|-------|---------|---------------|
| `bot-profile-640.jpg` (also 512 / 1024) | Mark only (dog+cat) | BotFather → `@Petdatebot` profile photo |
| `panel-profile-640.jpg` (also 512 / 1024) | Full mother wordmark | Channel `@petdating` / panel profile photo |

Runtime copies (bot package):

- `packages/bot/assets/bot-profile.jpg` ← `bot-profile-640.jpg`
- `packages/bot/assets/welcome-logo.jpg` ← `bot-profile-1024.jpg`

## Upload (manual — Mohammad)

Telegram does **not** auto-update these from git. Upload by hand:

1. **Bot avatar:** open [@BotFather](https://t.me/BotFather) → `/mybots` → `@Petdatebot` → Edit Bot → Edit Botpic → send `bot-profile-640.jpg` (or 1024).
2. **Channel / panel avatar:** open `@petdating` (or the panel chat) → Edit → set photo → send `panel-profile-640.jpg` (or 1024).

Square JPG, circular crop safe. Prefer **640** or **1024**.
