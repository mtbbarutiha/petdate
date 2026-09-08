#!/usr/bin/env bash
# Clear owner_chat bot sessions + push main menu (no fragile SSH heredoc / node one-shots).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/load-env.sh
source "$ROOT/scripts/lib/load-env.sh"
ENV_FILE=""
if [[ -f "$ROOT/.env" ]]; then ENV_FILE="$ROOT/.env"
elif [[ -f /opt/petdate/.env ]]; then ENV_FILE=/opt/petdate/.env; ROOT=/opt/petdate
fi
[[ -n "$ENV_FILE" ]] || { echo "force-main-menu: .env not found" >&2; exit 1; }
load_env "$ENV_FILE"
TOKEN="${TELEGRAM_BOT_TOKEN:-}"
[[ -n "$TOKEN" ]] || { echo "force-main-menu: TELEGRAM_BOT_TOKEN missing" >&2; exit 1; }
REDIS_SH="$ROOT/scripts/redis-cli.sh"
chmod +x "$REDIS_SH" 2>/dev/null || true

collect_ids() {
  local raw ids=()
  if [[ "$#" -gt 0 ]]; then ids=("$@")
  elif [[ -n "${CHAT_IDS:-}" ]]; then IFS=',; ' read -r -a ids <<<"$CHAT_IDS"
  else raw="${TELEGRAM_ADMIN_IDS:-},${ADMIN_TELEGRAM_IDS:-}"; IFS=',; ' read -r -a ids <<<"$raw"
  fi
  local id
  for id in "${ids[@]}"; do
    id="$(echo "$id" | tr -d '[:space:]')"
    [[ -z "$id" ]] && continue
    [[ "$id" =~ ^[0-9]+$ ]] || continue
    echo "$id"
  done | awk 'NF && !seen[$0]++'
}

IDS=()
while IFS= read -r line; do [[ -n "$line" ]] && IDS+=("$line"); done < <(collect_ids "$@")
[[ "${#IDS[@]}" -gt 0 ]] || { echo "force-main-menu: no chat ids" >&2; exit 1; }

curl_tg() { curl -4 -sS --connect-timeout 8 --max-time 30 "$@"; }

clear_session() {
  local tid="$1" key="petdate:bot:session:${tid}"
  if [[ -f "$REDIS_SH" ]]; then
    if "$REDIS_SH" EXISTS "$key" 2>/dev/null | grep -q 1; then
      local raw PATCHED
      raw="$("$REDIS_SH" GET "$key" 2>/dev/null || true)"
      if [[ -n "$raw" ]]; then
        PATCHED="$(TELEGRAM_ID="$tid" SESSION_JSON="$raw" node -e 'const s=JSON.parse(process.env.SESSION_JSON||"{}");const tid=process.env.TELEGRAM_ID;process.stdout.write(JSON.stringify({telegramId:tid,userId:s.userId,role:s.role,draftRoles:s.draftRoles,step:"ready",locale:s.locale||"fa",updatedAt:new Date().toISOString()}));')"
        "$REDIS_SH" SET "$key" "$PATCHED" EX 604800 >/dev/null
        echo "  session reset → ready ($key)"
      fi
    else echo "  no redis session ($key)"
    fi
  else echo "  redis helper missing — skip session clear"
  fi
}

MENU_JSON='{"keyboard":[["🔍 پیدا کردن همبازی"],["📍 پت‌های نزدیک","🔎 جستجوی پت"],["👤 پروفایل","🐾 پت‌های من"],["➕ ثبت پت","⚡ مشاوره سریع پزشک"],["🪙 سکه","🛒 پت‌شاپ"],["🎁 دعوت دوستان","❓ راهنما"],["📋 منو"]],"resize_keyboard":true,"is_persistent":true}'

send_menu() {
  local tid="$1" payload resp
  payload="$(CHAT_ID="$tid" MENU="$MENU_JSON" node -e 'process.stdout.write(JSON.stringify({chat_id:process.env.CHAT_ID,text:"⌨️ منوی اصلی",reply_markup:JSON.parse(process.env.MENU)}));')"
  resp="$(curl_tg -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" -H 'Content-Type: application/json' -d "$payload")"
  if echo "$resp" | grep -q '"ok":true'; then echo "  menu sent → $tid"
  else echo "  menu FAILED → $tid: $resp" >&2; return 1; fi
}

echo "==> force-main-menu (${#IDS[@]} chat(s))"
fail=0
for tid in "${IDS[@]}"; do
  echo "-- chat $tid"
  clear_session "$tid" || true
  send_menu "$tid" || fail=1
done
[[ "$fail" -eq 0 ]] || { echo "force-main-menu: some sends failed" >&2; exit 1; }
echo "force-main-menu: done"
