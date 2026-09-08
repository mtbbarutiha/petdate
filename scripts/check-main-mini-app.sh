#!/usr/bin/env bash
# Verify Telegram Main Mini App (profile "Open App") status. Never prints the token.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  set -a
  # Prefer TELEGRAM_BOT_TOKEN only
  TOKEN="$(grep -E '^TELEGRAM_BOT_TOKEN=' "$ROOT/.env" | head -1 | cut -d= -f2-)"
  set +a
fi
TOKEN="${TELEGRAM_BOT_TOKEN:-${TOKEN:-}}"
if [[ -z "${TOKEN}" ]]; then
  echo "error: TELEGRAM_BOT_TOKEN not set" >&2
  exit 2
fi

ME="$(curl -sS "https://api.telegram.org/bot${TOKEN}/getMe")"
MENU="$(curl -sS "https://api.telegram.org/bot${TOKEN}/getChatMenuButton")"

python3 - "$ME" "$MENU" <<'PY'
import json, sys
me = json.loads(sys.argv[1])
menu = json.loads(sys.argv[2])
if not me.get("ok"):
    print("getMe failed:", me.get("description", me))
    sys.exit(1)
r = me["result"]
has_main = bool(r.get("has_main_web_app"))
print(f"bot: @{r.get('username')} ({r.get('first_name')})")
print(f"has_main_web_app: {has_main}")
print(f"direct_link_mini_app: https://t.me/{r.get('username')}/Petdate")
print(f"main_app_deep_link: https://t.me/{r.get('username')}?startapp")
if menu.get("ok"):
    mb = menu["result"]
    print(f"chat_menu_button: type={mb.get('type')} text={mb.get('text')!r} url={(mb.get('web_app') or {}).get('url')}")
else:
    print("chat_menu_button: (unavailable)")

if has_main:
    print("OK: Main Mini App enabled — profile should show Open App (refresh Telegram client).")
    sys.exit(0)

print("MISSING: Main Mini App not enabled.")
print("Mohammad must enable it in @BotFather → /mybots → @Petdatebot → Bot Settings")
print("→ Configure Mini App → Enable Mini App → URL: https://petdate.ir/")
print("See docs/MAIN_MINI_APP.md")
sys.exit(1)
PY
