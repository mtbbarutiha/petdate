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
echo "==> selftest: shared peer-profile + user-command-id + pet/order-public-id + gtm-contract + sanitize-roles + breed-search + photo-moderation"
npx tsx "$ROOT/packages/shared/src/peer-profile.selftest.ts"
npx tsx "$ROOT/packages/shared/src/photo-moderation.selftest.ts"
npx tsx "$ROOT/packages/shared/src/user-command-id.selftest.ts"
npx tsx "$ROOT/packages/shared/src/pet-public-id.selftest.ts"
npx tsx "$ROOT/packages/shared/src/order-public-id.selftest.ts"
npx tsx "$ROOT/packages/shared/src/entity-public-id.selftest.ts"
npx tsx "$ROOT/packages/shared/src/gtm-contract.selftest.ts"
npx tsx "$ROOT/packages/shared/src/pet-slug.selftest.ts"
npx tsx "$ROOT/packages/shared/src/sanitize-roles.selftest.ts"
npx tsx "$ROOT/packages/shared/src/catalog-breed-search.selftest.ts"

echo "==> selftest: web face-verify approve toast + profile copy"
npx tsx "$ROOT/packages/web/src/components/faceVerifyRewardToast.selftest.ts"

echo "==> selftest: web inbox title (no public id)"
npx tsx "$ROOT/packages/web/src/lib/inboxTitle.selftest.ts"

echo "==> selftest: web inbox consult agent avatars"
npx tsx "$ROOT/packages/web/src/lib/inboxConversations.avatars.selftest.ts"

echo "==> selftest: web share helper (Web Share / clipboard)"
npx tsx "$ROOT/packages/web/src/lib/share.selftest.ts"

echo "==> selftest: web admin Jalali date helpers"
npx tsx "$ROOT/packages/web/src/admin/JalaliDateSelect.selftest.ts"

echo "==> selftest: admin wordmark uses لوگو مادر (not PD initials)"
npx tsx "$ROOT/packages/web/src/admin/adminWordmark.selftest.ts"

echo "==> selftest: admin KPI cards show full value (no ellipsis)"
npx tsx "$ROOT/packages/web/src/admin/dash/adminKpiNoEllipsis.selftest.ts"

echo "==> selftest: admin thumb never invents stock pet photo"
npx tsx "$ROOT/packages/web/src/admin/AdminThumb.selftest.ts"

echo "==> selftest: web admin analytics path labels"
npx tsx "$ROOT/packages/web/src/admin/analyticsPathLabel.selftest.ts"

echo "==> selftest: web admin error-log Persian messages"
npx tsx "$ROOT/packages/web/src/admin/adminLogMessageFa.selftest.ts"

echo "==> selftest: web admin monitoring tone mapping"
npx tsx "$ROOT/packages/web/src/admin/AdminMonitoringPage.selftest.ts"

echo "==> selftest: admin /admin/tag-manager route + sidebar"
npx tsx "$ROOT/packages/web/src/admin/adminTagManagerRoute.selftest.ts"

echo "==> selftest: admin /admin/magazine route + TipTap + public /magazine"
npx tsx "$ROOT/packages/web/src/admin/adminMagazineRoute.selftest.ts"

echo "==> selftest: admin mobile hamburger / drawer (RTL)"
npx tsx "$ROOT/packages/web/src/admin/adminMobileNav.selftest.ts"

echo "==> selftest: admin route-transition loading (no stale tab flash)"
npx tsx "$ROOT/packages/web/src/admin/adminRouteLoading.selftest.ts"

echo "==> selftest: admin sidebar ops-priority order"
npx tsx "$ROOT/packages/web/src/admin/adminNavOrder.selftest.ts"

echo "==> selftest: admin finance payments under مالی + nav notifs"
npx tsx "$ROOT/packages/web/src/admin/adminFinanceNavNotifs.selftest.ts"

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

echo "==> selftest: web public marketing routes (vet-consult / adoption / magazine)"
npx tsx "$ROOT/packages/web/src/lib/publicRoutes.selftest.ts"

echo "==> selftest: web mobile dock keeps wallet + chats (Games not a replacement)"
npx tsx "$ROOT/packages/web/src/lib/siteNav.selftest.ts"

echo "==> selftest: web SW cache generation (guest vet landing bust)"
npx tsx "$ROOT/packages/web/src/lib/swCache.selftest.ts"

echo "==> selftest: web authRedirect next=/vet-consult"
npx tsx "$ROOT/packages/web/src/lib/authRedirect.selftest.ts"

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

echo "==> selftest: web i18n FA/EN + default dark theme"
npx tsx "$ROOT/packages/web/src/i18n/i18n.selftest.ts"

echo "==> selftest: web EN chrome has no leftover Persian UI strings"
npx tsx "$ROOT/packages/web/src/i18n/enChrome.selftest.ts"

echo "==> selftest: admin English i18n coverage (FA→EN map + keys)"
npx tsx "$ROOT/packages/web/src/i18n/adminEn.selftest.ts"

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

echo "==> selftest: web GTM dataLayer / link helpers"
npx tsx "$ROOT/packages/web/src/lib/siteAnalytics.selftest.ts"

echo "==> selftest: web Tag Assistant query-param helpers"
npx tsx "$ROOT/packages/web/src/lib/tagAssistantParams.selftest.ts"

echo "==> selftest: web chat media recorder helpers"
npx tsx "$ROOT/packages/web/src/lib/chatMediaRecorder.selftest.ts"
npx tsx "$ROOT/packages/web/src/components/chatGiftVoice.selftest.ts"

# Pure / memory-path tests first
run src/services/web-chat-cta-once.selftest.ts
run src/services/app-logger.selftest.ts
run src/routes/games.selftest.ts
run src/routes/sections-games.selftest.ts
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
run src/services/seeker-advice-early-refund.selftest.ts
run src/services/seeker-advice-owner-notify.selftest.ts
run src/services/telegram-face-verify-notify.selftest.ts
run src/face-verify-approve.selftest.ts
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
echo "==> selftest: bot sticky + telegram-http + quick-connect-parse + nearby-radius + nearby-inline-list + pet-search-menu + invite-friends + urls"
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

# SQLite cascade (uses temp/local DB via API helpers — not production path)
run src/services/user-delete-cascade.selftest.ts
run src/hr-rbac.selftest.ts
run src/admin-header-avatar.selftest.ts
run src/hr-modules.selftest.ts
run src/sales-crm.selftest.ts
run src/pet-purchase-leads.selftest.ts
run src/hr-sales-demo-seed.selftest.ts
run src/crm.selftest.ts
run src/crm-ticketing.selftest.ts
run src/support-tickets.selftest.ts
run src/admin-notifications.selftest.ts
run src/coin-sell-notifications.selftest.ts
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
run src/routes/pets-slug-diary.selftest.ts
run src/routes/pets-public-list.selftest.ts
run src/routes/playdates-auth.selftest.ts
run src/routes/users-staff-auth.selftest.ts
run src/routes/consultations-quick-connect-auth.selftest.ts
run src/services/playdate-fee.selftest.ts
run src/site-analytics.selftest.ts

echo "ci-selftest: all passed"
