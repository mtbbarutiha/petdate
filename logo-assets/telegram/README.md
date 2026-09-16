# Telegram profile logos (from لوگو مادر)

Source: `packages/web/public/pepito/img/logo.png`  
Regenerate: `python3 packages/web/scripts/generate-brand-assets.py`

| Asset | Content | Background | Upload target |
|-------|---------|------------|---------------|
| `bot-profile-640.jpg` (also 512 / 1024) | Mark only (dog+cat heart) | Soft pink wash | BotFather → `@Petdatebot` |
| `panel-profile-640.jpg` (also 512 / 1024) | Stacked mark + «Pet Date» | Soft lavender wash | Channel `@petdating` / panel |

Runtime copies (bot package):

- `packages/bot/assets/bot-profile.jpg` ← `bot-profile-640.jpg`
- `packages/bot/assets/welcome-logo.jpg` ← `bot-profile-1024.jpg`

## Upload

1. **Bot avatar:** BotFather → `/mybots` → `@Petdatebot` → Edit Botpic → send `bot-profile-640.jpg` (or API `setMyProfilePhoto` when available).
2. **Channel / panel avatar:** `@petdating` → Edit → Photo → send `panel-profile-640.jpg` (or bot admin `setChatPhoto`).

Square JPG, circular crop safe. Prefer **640** or **1024**.
