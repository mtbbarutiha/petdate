#!/usr/bin/env bash
# Lightweight API selftests safe for GitHub Actions (no VPS, no live SMS).
# Does not touch production DATABASE_PATH.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> scripts: bash -n + verify-prod-env (no secret leak)"
bash -n "$ROOT/scripts/backup-postgres.sh"
bash -n "$ROOT/scripts/verify-prod-env.sh"
bash -n "$ROOT/scripts/monitor-health.sh"
bash -n "$ROOT/scripts/deploy-vps.sh"
bash -n "$ROOT/infra/mail/ensure-mail-le-cert.sh"
bash -n "$ROOT/infra/mail/setup-mail.sh"
grep -q 'ensure-mail-le-cert.sh' "$ROOT/scripts/deploy-vps.sh" || {
  echo "ci-selftest FAIL: deploy-vps.sh must call ensure-mail-le-cert.sh" >&2
  exit 1
}
tmpenv="$(mktemp)"
trap 'rm -f "$tmpenv"' EXIT
cat >"$tmpenv" <<'ENV'
ADMIN_PASSWORD=not-the-default
ADMIN_SEED_PASSWORD=unique-seed
BOT_WEBHOOK_URL=
DATABASE_URL=postgresql://example
REDIS_URL=redis://localhost
TELEGRAM_BOT_TOKEN=example-token
SMTP_HOST=127.0.0.1
SMTP_FROM=no-reply@petdate.ir
CANDOO_API_KEY=example-key
CANDOO_SRC_NUMBERS=989999176033
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=example-access
S3_SECRET_KEY=example-secret
PAYMENT_CARD_NUMBER=4242424242424242
PAYMENT_CARD_HOLDER=PetDate
ENV
verify_out="$("$ROOT/scripts/verify-prod-env.sh" "$tmpenv")"
printf '%s\n' "$verify_out"
echo "$verify_out" | grep -q 'verify-prod-env: OK='
if echo "$verify_out" | grep -Eq 'not-the-default|unique-seed|example-token|example-key|example-secret|postgresql://'; then
  echo "ci-selftest FAIL: verify-prod-env leaked a value" >&2
  exit 1
fi

cd "$ROOT/packages/api"

run() {
  local file="$1"
  echo "==> selftest: $file"
  npx tsx "$file"
}

# Shared pure selftests
echo "==> selftest: shared payment-card + admin-password + peer-profile + ids"
npx tsx "$ROOT/packages/shared/src/peer-profile.selftest.ts"
npx tsx "$ROOT/packages/shared/src/photo-moderation.selftest.ts"
npx tsx "$ROOT/packages/shared/src/profile-avatar.selftest.ts"
npx tsx "$ROOT/packages/shared/src/profile-gap-fill.selftest.ts"
npx tsx "$ROOT/packages/shared/src/error-catalog.selftest.ts"
npx tsx "$ROOT/packages/shared/src/demo-seed-markers.selftest.ts"
npx tsx "$ROOT/packages/shared/src/user-command-id.selftest.ts"
npx tsx "$ROOT/packages/shared/src/pet-public-id.selftest.ts"
npx tsx "$ROOT/packages/shared/src/order-public-id.selftest.ts"
npx tsx "$ROOT/packages/shared/src/entity-public-id.selftest.ts"
npx tsx "$ROOT/packages/shared/src/gtm-contract.selftest.ts"
npx tsx "$ROOT/packages/shared/src/referral.selftest.ts"
npx tsx "$ROOT/packages/shared/src/fanout-reject.selftest.ts"
npx tsx "$ROOT/packages/shared/src/pet-slug.selftest.ts"
npx tsx "$ROOT/packages/shared/src/sanitize-roles.selftest.ts"
npx tsx "$ROOT/packages/shared/src/catalog-breed-search.selftest.ts"
npx tsx "$ROOT/packages/shared/src/help.selftest.ts"
npx tsx "$ROOT/packages/shared/src/auto-messages.selftest.ts"
npx tsx "$ROOT/packages/shared/src/payment-card.selftest.ts"
npx tsx "$ROOT/packages/shared/src/admin-password.selftest.ts"

echo "==> selftest: web face-verify approve toast + profile copy"
npx tsx "$ROOT/packages/web/src/components/faceVerifyRewardToast.selftest.ts"

echo "==> selftest: web profile photo change confirm + 100-coin fee"
npx tsx "$ROOT/packages/web/src/components/profilePhotoChange.selftest.ts"

echo "==> selftest: web inbox title (no public id)"
npx tsx "$ROOT/packages/web/src/lib/inboxTitle.selftest.ts"

echo "==> selftest: web fan-out reject hidden from requester"
npx tsx "$ROOT/packages/web/src/lib/playdateMap.fanoutReject.selftest.ts"

echo "==> selftest: web inbox consult agent avatars"
npx tsx "$ROOT/packages/web/src/lib/inboxConversations.avatars.selftest.ts"

echo "==> selftest: web share helper (Web Share / clipboard)"
npx tsx "$ROOT/packages/web/src/lib/share.selftest.ts"

echo "==> selftest: web admin Jalali date helpers"
npx tsx "$ROOT/packages/web/src/admin/JalaliDateSelect.selftest.ts"

echo "==> selftest: admin wordmark uses لوگو مادر (not PD initials)"
npx tsx "$ROOT/packages/web/src/admin/adminWordmark.selftest.ts"

echo "==> selftest: admin login icon fields keep RTL text gutter"
npx tsx "$ROOT/packages/web/src/admin/adminLoginInputIcon.selftest.ts"

echo "==> selftest: admin KPI cards show full value (no ellipsis)"
npx tsx "$ROOT/packages/web/src/admin/dash/adminKpiNoEllipsis.selftest.ts"

echo "==> selftest: admin thumb never invents stock pet photo"
npx tsx "$ROOT/packages/web/src/admin/AdminThumb.selftest.ts"

echo "==> selftest: web admin analytics path labels"
npx tsx "$ROOT/packages/web/src/admin/analyticsPathLabel.selftest.ts"

echo "==> selftest: web admin error-log Persian messages"
npx tsx "$ROOT/packages/web/src/admin/adminLogMessageFa.selftest.ts"

echo "==> selftest: web admin error-log duplicate grouping"
npx tsx "$ROOT/packages/web/src/admin/adminLogGroups.selftest.ts"

echo "==> selftest: web admin monitoring tone mapping"
npx tsx "$ROOT/packages/web/src/admin/AdminMonitoringPage.selftest.ts"

echo "==> selftest: admin demo-seed hide/flag toggle"
npx tsx "$ROOT/packages/web/src/admin/demoSeedVisibility.selftest.ts"

echo "==> selftest: admin /admin/tag-manager route + sidebar"
npx tsx "$ROOT/packages/web/src/admin/adminTagManagerRoute.selftest.ts"

echo "==> selftest: admin /admin/magazine route + TipTap + public /magazine"
npx tsx "$ROOT/packages/web/src/admin/adminMagazineRoute.selftest.ts"

echo "==> selftest: admin mobile hamburger / drawer (RTL)"
npx tsx "$ROOT/packages/web/src/admin/adminMobileNav.selftest.ts"

echo "==> selftest: admin responsive shell (phone / tablet / laptop / wide)"
npx tsx "$ROOT/packages/web/src/admin/adminResponsive.selftest.ts"

echo "==> selftest: admin sidebar fixed to viewport (no empty chrome under logout)"
npx tsx "$ROOT/packages/web/src/admin/adminSidebarSticky.selftest.ts"

echo "==> selftest: sales inbound-call simulator docks via body portal"
npx tsx "$ROOT/packages/web/src/admin/pages/sales/salesCallSim.selftest.ts"

echo "==> selftest: admin route-transition loading (no stale tab flash)"
npx tsx "$ROOT/packages/web/src/admin/adminRouteLoading.selftest.ts"

echo "==> selftest: admin sidebar ops-priority order"
npx tsx "$ROOT/packages/web/src/admin/adminNavOrder.selftest.ts"

echo "==> selftest: admin finance payments under مالی + nav notifs"
npx tsx "$ROOT/packages/web/src/admin/adminFinanceNavNotifs.selftest.ts"

echo "==> selftest: admin finance allocation edit mode unlocks section fields"
npx tsx "$ROOT/packages/web/src/admin/pages/finance/adminFinanceAllocationEdit.selftest.ts"

echo "==> selftest: admin runtime flags / coin-sell / support wiring"
npx tsx "$ROOT/packages/web/src/admin/adminRuntimeWiring.selftest.ts"
npx tsx "$ROOT/packages/web/src/pages/supportSplit.selftest.ts"

echo "==> selftest: admin deposit receipt preview in details/attachments"
npx tsx "$ROOT/packages/web/src/admin/pages/adminPaymentReceipt.selftest.ts"

echo "==> selftest: admin KYC verification video (not bare img) + media mime sniff"
npx tsx "$ROOT/packages/web/src/admin/pages/adminVerificationMedia.selftest.ts"
npx tsx "$ROOT/packages/api/src/services/telegram-media.selftest.ts"

echo "==> selftest: admin docs/photo moderation review grid UX"
npx tsx "$ROOT/packages/web/src/admin/pages/adminMarketplaceModeration.selftest.ts"

# Guard: admin soft-delete user (حذف کاربر) wired in UI + API
echo "==> selftest: admin delete user route + UI"
npx tsx "$ROOT/packages/web/src/admin/adminDeleteUser.selftest.ts"

# Guard: admin users table stays compact (less horizontal scroll)
echo "==> selftest: admin users table compact layout"
npx tsx "$ROOT/packages/web/src/admin/adminUsersTableCompact.selftest.ts"

# Guard: admin shop order expand panel is clean RTL (not raw JSON dump)
echo "==> selftest: admin shop order detail panel"
npx tsx "$ROOT/packages/web/src/admin/adminShopOrderDetail.selftest.ts"

echo "==> selftest: web admin chart layout (size + grid + labels)"
npx tsx "$ROOT/packages/web/src/admin/adminChartLayout.selftest.ts"

echo "==> selftest: web admin widget dashboard (layout + drill)"
npx tsx "$ROOT/packages/web/src/admin/widgets/widgetDashboard.selftest.ts"

echo "==> selftest: web sitemap public routes"
npx tsx "$ROOT/packages/web/src/lib/sitemap.selftest.ts"

echo "==> selftest: web page SEO / canonical helpers"
npx tsx "$ROOT/packages/web/src/lib/pageSeo.selftest.ts"

echo "==> selftest: web public marketing routes (vet-consult / adoption / magazine)"
npx tsx "$ROOT/packages/web/src/lib/publicRoutes.selftest.ts"

echo "==> selftest: web invite referral persist + card wiring"
npx tsx "$ROOT/packages/web/src/lib/referral.selftest.ts"
npx tsx "$ROOT/packages/web/src/components/inviteFriends.selftest.ts"

echo "==> selftest: web mobile dock keeps wallet + chats (Games not a replacement)"
npx tsx "$ROOT/packages/web/src/lib/siteNav.selftest.ts"

echo "==> selftest: web desktop header grouping (no marketing+pill clash)"
npx tsx "$ROOT/packages/web/src/components/siteHeader.selftest.ts"

echo "==> selftest: web SW cache generation (guest vet landing bust)"
npx tsx "$ROOT/packages/web/src/lib/swCache.selftest.ts"

echo "==> selftest: web authRedirect next=/vet-consult"
npx tsx "$ROOT/packages/web/src/lib/authRedirect.selftest.ts"

echo "==> selftest: web shared AppToast card (success/error/warning/info)"
npx tsx "$ROOT/packages/web/src/hooks/useAppToast.selftest.ts"

echo "==> selftest: web shared AppDialog (no native prompt/confirm/alert)"
  npx tsx "$ROOT/packages/web/src/components/appDialog.selftest.ts"

echo "==> selftest: web dialog focus trap (once on open, not on keystroke)"
  npx tsx "$ROOT/packages/web/src/lib/dialogFocus.selftest.ts"

echo "==> selftest: web playmate fee ConfirmModal (no window.confirm)"
npx tsx "$ROOT/packages/web/src/components/playmateFeeConfirm.selftest.ts"

echo "==> selftest: web silent-chat mute ConfirmModal + desktop header layout"
npx tsx "$ROOT/packages/web/src/components/silentChatConfirm.selftest.ts"

echo "==> selftest: web chat inbox dismiss ConfirmModal + same-row trash"
npx tsx "$ROOT/packages/web/src/components/chatDismissConfirm.selftest.ts"

echo "==> selftest: web find-playmate empty mobile layout"
npx tsx "$ROOT/packages/web/src/components/playmateEmptyMobile.selftest.ts"

echo "==> selftest: web breed FA/EN autocomplete + pet/user photo split"
npx tsx "$ROOT/packages/web/src/components/breedPhotoSplit.selftest.ts"

echo "==> selftest: web owner consult (مشورت با صاحبین) CTA + reg dark CSS"
npx tsx "$ROOT/packages/web/src/components/ownerConsult.selftest.ts"

echo "==> selftest: web owner panel pet diary (دفتر خاطرات)"
npx tsx "$ROOT/packages/web/src/pages/ownerPetDiary.selftest.ts"

echo "==> selftest: web pending-photo banner + unlock"
npx tsx "$ROOT/packages/web/src/components/photoPendingBanner.selftest.ts"

echo "==> selftest: web dark-mode theme tokens + toggle wiring"
npx tsx "$ROOT/packages/web/src/lib/theme.selftest.ts"

echo "==> selftest: profile manage actions in rail / avatar menu"
npx tsx "$ROOT/packages/web/src/lib/profileManageNav.selftest.ts"

echo "==> selftest: own-profile stats strip placement (not on contact profile)"
npx tsx "$ROOT/packages/web/src/components/profileStatsStrip.selftest.ts"

echo "==> selftest: web i18n FA/EN + default dark theme"
npx tsx "$ROOT/packages/web/src/i18n/i18n.selftest.ts"

echo "==> selftest: web site chrome FA/EN nav + badge keys"
npx tsx "$ROOT/packages/web/src/i18n/siteChrome.selftest.ts"

echo "==> selftest: web EN chrome has no leftover Persian UI strings"
npx tsx "$ROOT/packages/web/src/i18n/enChrome.selftest.ts"

echo "==> selftest: admin English i18n coverage (FA→EN map + keys)"
npx tsx "$ROOT/packages/web/src/i18n/adminEn.selftest.ts"

echo "==> selftest: admin FA/EN chrome parity (analytics + catalog)"
npx tsx "$ROOT/packages/web/src/i18n/adminFa.selftest.ts"

echo "==> selftest: nginx apex HTTPS + WCDN docs"
npx tsx "$ROOT/packages/web/src/lib/wcdnNginx.selftest.ts"

echo "==> selftest: web API error message (WCDN HTML → Persian)"
npx tsx "$ROOT/packages/web/src/lib/apiErrorMessage.selftest.ts"

echo "==> selftest: web listGames never blanks SPA"
npx tsx "$ROOT/packages/web/src/lib/listGames.selftest.ts"

echo "==> selftest: admin games route + badge"
npx tsx "$ROOT/packages/web/src/admin/adminGamesRoute.selftest.ts"

echo "==> selftest: api admin games moderation"
npx tsx "$ROOT/packages/api/src/routes/admin-games.selftest.ts"

echo "==> selftest: shop product gallery assets"
npx tsx "$ROOT/packages/web/src/data/shopGallery.selftest.ts"

echo "==> selftest: web shop cart sync (badge + merge-then-persist)"
npx tsx "$ROOT/packages/web/src/hooks/useShopCart.selftest.ts"

echo "==> selftest: bot shop cart shared API"
npx tsx "$ROOT/packages/bot/src/handlers/shop-cart.selftest.ts"

echo "==> selftest: web GTM dataLayer / link helpers"
npx tsx "$ROOT/packages/web/src/lib/siteAnalytics.selftest.ts"

echo "==> selftest: web UI font (self-hosted Vazirmatn OFL)"
npx tsx "$ROOT/packages/web/src/lib/fonts.selftest.ts"

echo "==> selftest: web Lighthouse perf + agentic guards"
npx tsx "$ROOT/packages/web/src/lib/webPerf.selftest.ts"

echo "==> selftest: web Tag Assistant query-param helpers"
npx tsx "$ROOT/packages/web/src/lib/tagAssistantParams.selftest.ts"

echo "==> selftest: web chat media recorder helpers"
npx tsx "$ROOT/packages/web/src/lib/chatMediaRecorder.selftest.ts"
npx tsx "$ROOT/packages/web/src/components/chatGiftVoice.selftest.ts"

# Pure / memory-path tests first
run src/services/web-chat-cta-once.selftest.ts
run src/services/app-logger.selftest.ts
run src/routes/parse-positive-int-id.selftest.ts
run src/routes/games.selftest.ts
run src/routes/sections-games.selftest.ts
run src/routes/games-http.selftest.ts
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
run src/services/pending-photo-placeholder.selftest.ts
run src/services/face-verify-avatar.selftest.ts
run src/services/seeker-advice-early-refund.selftest.ts
run src/services/seeker-advice-owner-notify.selftest.ts
run src/services/telegram-face-verify-notify.selftest.ts
run src/face-verify-approve.selftest.ts
run src/profile-photo-change.selftest.ts
run src/services/chat-upload-store.selftest.ts
run src/services/chat-inbox-gift.selftest.ts
run src/services/image-normalize.selftest.ts
run src/services/pet-owner-breed-photo.selftest.ts
run src/services/pasha-user-tone.selftest.ts
run src/services/speech-to-text.selftest.ts
run src/services/ai-consult.selftest.ts
run src/services/team-agents.selftest.ts
run src/services/consult-idle-close.selftest.ts
run src/db/pg-compat.selftest.ts

# Bot guards (sticky keyboard + IPv4 Telegram HTTP) — no network / no DB
echo "==> selftest: bot sticky + telegram-http + quick-connect-parse + nearby-radius + nearby-inline-list + pet-search-menu + invite-friends + urls + profile-gap-fill"
npx tsx "$ROOT/packages/bot/src/sticky-reply-keyboard.selftest.ts"
npx tsx "$ROOT/packages/bot/src/telegram-http.selftest.ts"
npx tsx "$ROOT/packages/bot/src/quick-connect-parse.selftest.ts"
npx tsx "$ROOT/packages/bot/src/api-client-bot-headers.selftest.ts"
npx tsx "$ROOT/packages/bot/src/handlers/supportSplit.selftest.ts"
npx tsx "$ROOT/packages/bot/src/urls.selftest.ts"
npx tsx "$ROOT/packages/bot/src/handlers/nearby-radius.selftest.ts"
npx tsx "$ROOT/packages/bot/src/handlers/nearby-inline-list.selftest.ts"
npx tsx "$ROOT/packages/bot/src/handlers/pet-search-menu.selftest.ts"
npx tsx "$ROOT/packages/bot/src/handlers/invite-friends.selftest.ts"
npx tsx "$ROOT/packages/bot/src/roleMenuOrder.selftest.ts"
npx tsx "$ROOT/packages/bot/src/handlers/help.selftest.ts"
npx tsx "$ROOT/packages/bot/src/handlers/profile-gap-fill.selftest.ts"
npx tsx "$ROOT/packages/bot/src/bot-update-mode.selftest.ts"

# SQLite cascade (uses temp/local DB via API helpers — not production path)
run src/services/user-delete-cascade.selftest.ts
run src/hr-rbac.selftest.ts
run src/admin-header-avatar.selftest.ts
run src/hr-modules.selftest.ts
run src/sales-crm.selftest.ts
run src/pet-purchase-leads.selftest.ts
run src/hr-sales-demo-seed.selftest.ts
run src/demo-seeds-guard.selftest.ts
run src/demo-seeds-cleanup.selftest.ts
run src/health-ready.selftest.ts
run src/services/web-otp.selftest.ts
run src/crm.selftest.ts
run src/auto-messages.selftest.ts
run src/crm-ticketing.selftest.ts
run src/support-tickets.selftest.ts
run src/services/ticket-user-notify.selftest.ts
run src/admin-notifications.selftest.ts
run src/coin-sell-notifications.selftest.ts
run src/admin-daily-notes.selftest.ts
run src/admin-user-prefs.selftest.ts
run src/admin-platform-nav.selftest.ts
run src/admin-users-geo.selftest.ts
run src/admin-users-list-pets.selftest.ts
run src/admin-monitoring.selftest.ts
run src/admin-aggregate-dashboard.selftest.ts
run src/admin-dashboard-activity.selftest.ts
run src/hr-ats-followup.selftest.ts
run src/finance-os.selftest.ts
run src/services/card2card-wallet.selftest.ts
run src/admin-finance-dashboard.selftest.ts
run src/platform-settings.selftest.ts
run src/runtime-settings.selftest.ts
run src/magazine.selftest.ts
run src/magazine-editorial-seed.selftest.ts
run src/routes/games-list.selftest.ts
run src/routes/pets-id-guard.selftest.ts
run src/routes/shop-cart.selftest.ts
run src/services/shop-cart.selftest.ts
run src/routes/pets-slug-diary.selftest.ts
run src/routes/pets-public-list.selftest.ts
run src/routes/playdates-auth.selftest.ts
run src/routes/users-staff-auth.selftest.ts
run src/routes/consultations-quick-connect-auth.selftest.ts
run src/services/playdate-fee.selftest.ts
run src/services/fanout-reject-notify.selftest.ts
run src/site-analytics.selftest.ts
run src/referral.selftest.ts

echo "ci-selftest: all passed"
