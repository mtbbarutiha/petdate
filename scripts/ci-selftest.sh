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
echo "==> selftest: shared peer-profile + user-command-id + pet/order-public-id"
npx tsx "$ROOT/packages/shared/src/peer-profile.selftest.ts"
npx tsx "$ROOT/packages/shared/src/user-command-id.selftest.ts"
npx tsx "$ROOT/packages/shared/src/pet-public-id.selftest.ts"
npx tsx "$ROOT/packages/shared/src/order-public-id.selftest.ts"
npx tsx "$ROOT/packages/shared/src/entity-public-id.selftest.ts"

echo "==> selftest: web inbox title (no public id)"
npx tsx "$ROOT/packages/web/src/lib/inboxTitle.selftest.ts"

echo "==> selftest: web share helper (Web Share / clipboard)"
npx tsx "$ROOT/packages/web/src/lib/share.selftest.ts"

echo "==> selftest: web sitemap public routes"
npx tsx "$ROOT/packages/web/src/lib/sitemap.selftest.ts"

echo "==> selftest: web chat media recorder helpers"
npx tsx "$ROOT/packages/web/src/lib/chatMediaRecorder.selftest.ts"

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
run src/services/vet-online.selftest.ts
run src/services/marketplace-roles.selftest.ts
run src/services/chat-upload-store.selftest.ts
run src/services/pasha-user-tone.selftest.ts
run src/services/speech-to-text.selftest.ts
run src/services/ai-consult.selftest.ts

# Bot guards (sticky keyboard + IPv4 Telegram HTTP) — no network / no DB
echo "==> selftest: bot sticky + telegram-http + quick-connect-parse + nearby-radius + nearby-inline-list + pet-search-menu + invite-friends + urls"
npx tsx "$ROOT/packages/bot/src/sticky-reply-keyboard.selftest.ts"
npx tsx "$ROOT/packages/bot/src/telegram-http.selftest.ts"
npx tsx "$ROOT/packages/bot/src/quick-connect-parse.selftest.ts"
npx tsx "$ROOT/packages/bot/src/urls.selftest.ts"
npx tsx "$ROOT/packages/bot/src/handlers/nearby-radius.selftest.ts"
npx tsx "$ROOT/packages/bot/src/handlers/nearby-inline-list.selftest.ts"
npx tsx "$ROOT/packages/bot/src/handlers/pet-search-menu.selftest.ts"
npx tsx "$ROOT/packages/bot/src/handlers/invite-friends.selftest.ts"

# SQLite cascade (uses temp/local DB via API helpers — not production path)
run src/services/user-delete-cascade.selftest.ts
run src/hr-rbac.selftest.ts
run src/hr-modules.selftest.ts
run src/sales-crm.selftest.ts
run src/hr-sales-demo-seed.selftest.ts
run src/crm.selftest.ts
run src/crm-ticketing.selftest.ts
run src/admin-notifications.selftest.ts
run src/admin-aggregate-dashboard.selftest.ts
run src/admin-dashboard-activity.selftest.ts
run src/hr-ats-followup.selftest.ts
run src/finance-os.selftest.ts
run src/admin-finance-dashboard.selftest.ts

echo "ci-selftest: all passed"
