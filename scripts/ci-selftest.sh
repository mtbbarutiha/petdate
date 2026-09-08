#!/usr/bin/env bash
# Lightweight API selftests safe for GitHub Actions (no VPS, no live SMS).
# Does not touch production DATABASE_PATH.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/packages/api"

run() {
  local file="$1"
  echo "==> selftest: $file"
  npx tsx "$file"
}

# Pure / memory-path tests first
run src/services/web-chat-cta-once.selftest.ts
run src/services/otp-sms-copy.selftest.ts
run src/services/otp-email-html.selftest.ts
run src/services/prescription-sms.selftest.ts
run src/services/prescription-html.selftest.ts
run src/services/prescription-chat.selftest.ts
run src/services/candoo.selftest.ts
run src/services/telegram-profile-sync.selftest.ts
run src/services/telegram-playdate-notify.selftest.ts
run src/services/nearby-cards.selftest.ts

# Bot guards (sticky keyboard + IPv4 Telegram HTTP) — no network / no DB
echo "==> selftest: bot sticky + telegram-http"
npx tsx "$ROOT/packages/bot/src/sticky-reply-keyboard.selftest.ts"
npx tsx "$ROOT/packages/bot/src/telegram-http.selftest.ts"

# SQLite cascade (uses temp/local DB via API helpers — not production path)
run src/services/user-delete-cascade.selftest.ts

echo "ci-selftest: all passed"
