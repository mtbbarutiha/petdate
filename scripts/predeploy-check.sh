#!/usr/bin/env bash
# Refuse incomplete-tree VPS deploys (logo/feature overwrites).
# Controlled deploy path: GitHub Actions .github/workflows/deploy.yml
# Feature branches must not ad-hoc rsync dist. See docs/DEPLOY.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail() {
  echo "predeploy-check FAIL: $*" >&2
  exit 1
}
ok() { echo "predeploy-check OK: $*"; }

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"

# Only integration / release lines may deploy (override: ALLOW_DEPLOY=1).
# CI sets ALLOW_DEPLOY=1 after build; humans should merge to main first.
case "$BRANCH" in
  main|master|production|\
  cursor/stabilize-deploy-logos-6c89|cursor/predeploy-guard-6c89|\
  cursor/mother-logo-everywhere-6c89|cursor/pwa-mark-no-type-6c89|\
  cursor/setup-cicd-6c89) ;;
  *)
    if [[ "${ALLOW_DEPLOY:-}" != "1" ]]; then
      fail "branch '$BRANCH' cannot deploy. Merge into main (or ALLOW_DEPLOY=1 for break-glass)."
    fi
    echo "predeploy-check WARN: ALLOW_DEPLOY=1 on non-integration branch $BRANCH"
    ;;
esac
ok "branch $BRANCH"

check_md5() {
  local file="$1" expect="$2" got
  [[ -f "$file" ]] || fail "missing $file"
  got="$(md5sum "$file" | awk '{print $1}')"
  [[ "$got" == "$expect" ]] || fail "$file md5=$got expected=$expect"
  ok "$file"
}

# لوگو مادر full wordmark for header; PWA = mark-only crop (no type) — see generate-brand-assets.py
check_md5 packages/web/public/pepito/img/logo.png beda5e5ccdd11c32dd06a4f1bce2c6bf
# Rx PDF/HTML brand copy must stay identical to لوگو مادر
check_md5 packages/api/assets/brand/petdate-dr-logo.png beda5e5ccdd11c32dd06a4f1bce2c6bf
check_md5 packages/web/public/pwa-192.png 16a1f783d32a55f7a2c948b6951da303
check_md5 packages/web/public/favicon.png ab82dcfaeed55aad89b4ba8ec16726cb

if [[ -f packages/web/src/pages/ExplorePage.tsx ]]; then
  fail "ExplorePage.tsx must stay deleted"
fi
ok "ExplorePage absent"

grep -q 'هم بازی' packages/web/src/lib/siteNav.ts packages/web/src/components/Layout.tsx \
  || fail "owner nav «هم بازی» missing"
ok "هم بازی nav"

grep -qE 'login-start|createTelegramLoginPending' packages/api/src/routes/auth.ts \
  || fail "Telegram login-start missing in auth routes"
grep -q 'createTelegramLoginPending' packages/api/src/services/telegram-web-link.ts \
  || fail "createTelegramLoginPending missing"
ok "telegram pending login"

grep -q "newsletterEmail: 'news@petdate.ir'" packages/shared/src/brand.ts \
  || fail "SITE.newsletterEmail news@petdate.ir missing"
[[ -f packages/api/src/routes/newsletter.ts ]] || fail "newsletter route missing"
ok "newsletter news@"

grep -q 'یک گفتگو را انتخاب کن' packages/web/src/pages/ChatPage.tsx \
  || fail "desktop chat empty-state missing"
ok "desktop chat empty-state"

# --- Features previously wiped by incomplete agent rsyncs ---

grep -q "WEB_CTA_ONCE_MARKER = 'web-cta-once-v2'" packages/api/src/services/web-chat-cta-once.ts \
  || fail "api web-cta-once-v2 marker missing"
grep -q "WEB_CTA_ONCE_MARKER = 'web-cta-once-v2'" packages/bot/src/web-chat-cta-once.ts \
  || fail "bot web-cta-once-v2 marker missing"
ok "web-cta-once-v2"

grep -q "REMOVED_USER_ROLES = \\['community_seeker'\\]" packages/shared/src/petdate.ts \
  || fail "REMOVED_USER_ROLES (community_seeker only) missing"
# pet_sitter + trainer are live roles again (PR #83 marketplace)
grep -q "'pet_sitter'" packages/shared/src/petdate.ts \
  || fail "pet_sitter missing from shared roles"
grep -q "'trainer'" packages/shared/src/petdate.ts \
  || fail "trainer missing from shared roles"
grep -q "pet_sitter" packages/shared/src/petdate.ts \
  && grep -q "USER_ROLES" packages/shared/src/petdate.ts \
  || fail "USER_ROLES / pet_sitter markers missing"
ok "marketplace roles (trainer + pet_sitter live; community_seeker removed)"

grep -q 'DATABASE_PATH' ecosystem.config.cjs \
  || fail "ecosystem.config.cjs must define single DATABASE_PATH"
ok "single DATABASE_PATH"

# Wallet / transactions surface (api + web) — soft markers
if [[ -d packages/api/src/routes ]]; then
  grep -R -q -E 'transaction|withdraw|wallet' packages/api/src/routes \
    || fail "wallet/transactions routes seem missing"
  ok "wallet/transactions api markers"
fi

# --- Shop full UI (wiped when thin feature-branch dist was rsynced with --delete) ---
[[ -f packages/web/src/pages/shop/ShopOrdersPage.tsx ]] \
  || fail "ShopOrdersPage.tsx missing — incomplete shop tree"
grep -q 'ShopOrdersPage' packages/web/src/App.tsx \
  || fail "ShopOrdersPage route missing from App.tsx"
grep -qE 'افزودن به سبد' packages/web/src/components/shop/ShopProductCard.tsx \
  || fail "shop add-to-cart CTA missing on ShopProductCard"
grep -qE "PayMethod = .*'toman'|paymentCurrency: 'toman'|ریال / تومان" \
  packages/web/src/pages/shop/ShopCartPage.tsx \
  || fail "shop toman/rial checkout missing from ShopCartPage"
grep -qE "payMethod === 'card'|ShopCardPayPage|/shop/card-pay" \
  packages/web/src/pages/shop/ShopCartPage.tsx \
  || fail "shop card-to-card checkout missing from ShopCartPage"
[[ -f packages/web/src/pages/shop/ShopCardPayPage.tsx ]] \
  || fail "ShopCardPayPage.tsx missing"
ok "shop orders + toman/card checkout markers"

# Admin Tag Manager direct URL (must not be analytics-tab-only)
[[ -f packages/web/src/admin/pages/AdminTagManagerPage.tsx ]] \
  || fail "AdminTagManagerPage.tsx missing"
grep -q 'path="tag-manager"' packages/web/src/App.tsx \
  || fail "/admin/tag-manager route missing from App.tsx"
grep -q "/admin/tag-manager" packages/web/src/admin/AdminLayout.tsx \
  || fail "sidebar link /admin/tag-manager missing"
ok "admin tag-manager route + sidebar"

# Profile / My Pets same API source (regression when partial web deploy shipped stale Profile)
grep -q 'useMyPets' packages/web/src/pages/ProfilePage.tsx \
  || fail "ProfilePage must use useMyPets (same source as My Pets)"
[[ -f packages/web/src/hooks/useMyPets.ts ]] || fail "useMyPets hook missing"
ok "profile/my-pets same source"

# Playdate accept → chat (bot+api) — soft presence check
if [[ -d packages/bot/src ]]; then
  grep -R -q -E 'auto-enter|playdate:enterchat' packages/bot/src \
    || fail "playdate auto-enter chat markers look missing in bot"
  ok "playdate enter-chat bot markers"
fi


# Sticky keyboard must remain non-destructive (PR #9) — no send+delete carrier
if [[ -f packages/bot/src/sticky-reply-keyboard.ts ]]; then
  if grep -qE 'deleteMessage|api\.delete' packages/bot/src/sticky-reply-keyboard.ts; then
    fail "sticky-reply-keyboard must not deleteMessage (clears ReplyKeyboard)"
  fi
  ok "sticky keyboard no-delete"
fi
[[ -f packages/bot/src/sticky-reply-keyboard.selftest.ts ]] \
  || fail "sticky-reply-keyboard.selftest.ts missing (regression guard)"
ok "sticky keyboard selftest present"

# Telegram IPv4 HTTP client (ops speed on this VPS)
if [[ -d packages/bot/src ]]; then
  grep -q 'telegramFetch\|grammyClientOptions\|family: 4' packages/bot/src/telegram-http.ts \
    || fail "bot telegram-http IPv4 client missing"
  grep -q 'TELEGRAM_API_ROOT' packages/bot/src/telegram-http.ts \
    || fail "bot telegram-http TELEGRAM_API_ROOT missing"
  grep -q '"undici"' packages/bot/package.json \
    || fail "bot package.json must declare undici (partial dist deploy crash)"
  ok "bot telegram-http IPv4"
fi
if [[ -d packages/api/src/services ]]; then
  grep -q 'telegramFetch\|family: 4' packages/api/src/services/telegram-http.ts \
    || fail "api telegram-http IPv4 client missing"
  grep -q 'TELEGRAM_API_ROOT\|telegramBotApiUrl' packages/api/src/services/telegram-http.ts \
    || fail "api telegram-http TELEGRAM_API_ROOT helpers missing"
  grep -q '"undici"' packages/api/package.json \
    || fail "api package.json must declare undici"
  ok "api telegram-http IPv4"
fi

[[ -f docs/AGENT_SPEED.md ]] || fail "docs/AGENT_SPEED.md missing"
ok "AGENT_SPEED.md"

# Ops helpers agents reinvent otherwise (slow / broken quoting)
[[ -f scripts/force-main-menu.sh ]] || fail "scripts/force-main-menu.sh missing"
[[ -f scripts/redis-cli.sh ]] || fail "scripts/redis-cli.sh missing"
[[ -f scripts/lib/load-env.sh ]] || fail "scripts/lib/load-env.sh missing"
[[ -f scripts/tg-api.sh ]] || fail "scripts/tg-api.sh missing"
ok "ops helper scripts"

echo "predeploy-check passed — this tree may deploy."
