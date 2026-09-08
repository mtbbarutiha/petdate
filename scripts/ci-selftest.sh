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

# Shared pure selftests
echo "==> selftest: shared peer-profile + user-command-id"
npx tsx "$ROOT/packages/shared/src/peer-profile.selftest.ts"
npx tsx "$ROOT/packages/shared/src/user-command-id.selftest.ts"

# Pure / memory-path tests first
run src/services/web-chat-cta-once.selftest.ts
run src/services/otp-sms-copy.selftest.ts
run src/services/otp-email-html.selftest.ts
run src/services/prescription-sms.selftest.ts
run src/services/prescription-html.selftest.ts
run src/services/prescription-pdf.selftest.ts
run src/services/prescription-chat.selftest.ts
run src/services/candoo.selftest.ts
run src/services/telegram-profile-sync.selftest.ts
run src/services/telegram-playdate-notify.selftest.ts
run src/services/nearby-cards.selftest.ts

# Bot guards (sticky keyboard + IPv4 Telegram HTTP) — no network / no DB
echo "==> selftest: bot sticky + telegram-http + nearby-radius + nearby-inline-list + pet-search-menu + invite-friends + urls"
npx tsx "$ROOT/packages/bot/src/sticky-reply-keyboard.selftest.ts"
npx tsx "$ROOT/packages/bot/src/telegram-http.selftest.ts"
npx tsx "$ROOT/packages/bot/src/urls.selftest.ts"
npx tsx "$ROOT/packages/bot/src/handlers/nearby-radius.selftest.ts"
npx tsx "$ROOT/packages/bot/src/handlers/nearby-inline-list.selftest.ts"
npx tsx "$ROOT/packages/bot/src/handlers/pet-search-menu.selftest.ts"
npx tsx "$ROOT/packages/bot/src/handlers/invite-friends.selftest.ts"

# SQLite cascade (uses temp/local DB via API helpers — not production path)
run src/services/user-delete-cascade.selftest.ts

echo "ci-selftest: all passed"
