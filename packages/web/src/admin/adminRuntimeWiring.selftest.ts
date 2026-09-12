/**
 * Guard: admin flags/content/coin-sell/support are wired to live APIs + public surfaces.
 * Run: npx tsx packages/web/src/admin/adminRuntimeWiring.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = join(webRoot, '../../api/src');
const botRoot = join(webRoot, '../../bot/src');
const sharedRoot = join(webRoot, '../../shared/src');

const read = (p: string) => readFileSync(p, 'utf8');

const settings = read(join(webRoot, 'admin/pages/AdminSettingsPage.tsx'));
assert.match(settings, /shopEnabled/, 'settings still expose shop flag');
assert.doesNotMatch(settings, /hint: 'placeholder درگاه کارت'/, 'card flag is no longer a placeholder hint');
assert.doesNotMatch(settings, /hint: 'بنر نگهداری \(placeholder\)'/, 'maintenance flag is no longer a placeholder hint');

const layout = read(join(webRoot, 'admin/AdminLayout.tsx'));
assert.match(layout, /\/admin\/coin-sells/, 'coin-sell queue in sidebar');
assert.match(layout, /financeBadgeKey:\s*['"]coinSells['"]/, 'coin-sell badge wired');
assert.match(layout, /\/admin\/support/, 'support inbox in sidebar');

const app = read(join(webRoot, 'App.tsx'));
assert.match(app, /AdminCoinSellsPage/, 'coin-sell page registered');
assert.match(app, /path="coin-sells"/, 'coin-sell route');
assert.match(app, /AdminSupportInboxPage/, 'support page registered');
assert.match(app, /path="support"/, 'support route');

const coinPage = read(join(webRoot, 'admin/pages/AdminCoinSellsPage.tsx'));
assert.match(coinPage, /\/api\/admin\/coin-sells/, 'coin-sell page hits admin API');
assert.match(coinPage, /action: 'paid' \| 'reject'/, 'paid/reject actions');
assert.match(coinPage, /coin-sells\/\$\{id\}\/\$\{action\}/, 'decide posts to coin-sells id/action');

const supportPage = read(join(webRoot, 'admin/pages/AdminSupportInboxPage.tsx'));
assert.match(supportPage, /\/api\/admin\/support\/threads/, 'support page hits admin API');
assert.match(supportPage, /\/reply/, 'human reply wired');

const hook = read(join(webRoot, 'hooks/usePlatformConfig.ts'));
assert.match(hook, /\/api\/platform\/config/, 'site fetches public config');

const chrome = read(join(webRoot, 'components/LandingChrome.tsx'));
assert.match(chrome, /PlatformBanners/, 'landing shows platform banners');
assert.match(chrome, /platform\.shopEnabled/, 'landing hides shop when flag off');
assert.match(chrome, /platform\.vetConsultEnabled/, 'landing hides vet when flag off');
assert.match(chrome, /data-testid="nav-games"/, 'landing keeps games nav from main');

const welcome = read(join(webRoot, 'pages/WelcomePage.tsx'));
assert.match(welcome, /PlatformBanners/, 'homepage shows platform banners');

const footer = read(join(webRoot, 'components/SiteFooter.tsx'));
assert.match(footer, /usePlatformConfig/, 'footer honors platform flags');

const appLayout = read(join(webRoot, 'components/Layout.tsx'));
assert.match(appLayout, /shopEnabled/, 'app rail hides shop when flag off');

const siteNav = read(join(webRoot, 'lib/siteNav.ts'));
assert.match(siteNav, /filterNavByPlatformConfig/, 'nav filter helper');

const apiIndex = read(join(apiRoot, 'index.ts'));
assert.match(apiIndex, /\/api\/platform/, 'API mounts public platform router');

const shop = read(join(apiRoot, 'routes/shop.ts'));
assert.match(shop, /shopEnabled/, 'shop router honors shop flag');
assert.match(shop, /paymentCardEnabled/, 'shop checkout honors card flag');

const playdates = read(join(apiRoot, 'routes/playdates.ts'));
assert.match(playdates, /playdatesEnabled/, 'playdate create/find honors flag');

const consults = read(join(apiRoot, 'routes/consultations.ts'));
assert.match(consults, /vetConsultEnabled/, 'vet consult honors flag');

const auth = read(join(apiRoot, 'routes/auth.ts'));
assert.match(auth, /paymentCardEnabled/, 'wallet card buy honors flag');

const users = read(join(apiRoot, 'routes/users.ts'));
assert.match(users, /paymentStarsEnabled/, 'bot stars payments honor flag');

const admin = read(join(apiRoot, 'routes/admin.ts'));
assert.match(admin, /\/coin-sells/, 'admin coin-sell routes');
assert.match(admin, /normalizeCoinSellAdminStatus/, 'admin coin-sell accepts pending alias');
assert.match(admin, /\/support\/threads/, 'admin support routes');

const usersSell = users.split("usersRouter.post('/telegram/:telegramId/coins/sell'")[1] || '';
assert.match(usersSell, /channel:\s*['"]bot['"]/, 'bot sell tagged bot');
assert.match(usersSell, /validateIranCard/, 'bot sell shares site card validation');

const notifs = read(join(apiRoot, 'admin-notifications.ts'));
assert.match(notifs, /listCoinSellsLive/, 'اعلانات live-aggregates coin withdrawals');
assert.match(notifs, /notifyCoinSellSubmitted/, 'submit pushes header notif');

const header = read(join(webRoot, 'admin/AdminHeaderNotifications.tsx'));
assert.match(header, /\/admin\/coin-sells/, 'header inbox links to coin-sell queue');

const financeOs = read(join(apiRoot, 'routes/admin-finance-os.ts'));
assert.match(financeOs, /requirePermission\('finance.write'\)/, 'finance OS writes use finance.write');
assert.doesNotMatch(
  financeOs,
  /requirePermission\('platform.write'\)/,
  'finance OS writes no longer require platform.write only'
);

const forceJoin = read(join(botRoot, 'force-join.ts'));
assert.match(forceJoin, /botForceJoin/, 'bot force-join reads admin flag');

const botStart = read(join(botRoot, 'handlers/start.ts'));
assert.match(botStart, /fetchPublicPlatformConfig/, 'bot /start reads public config');
assert.match(botStart, /maintenanceMode/, 'bot shows maintenance');

const sharedNav = read(join(sharedRoot, 'admin-nav.ts'));
assert.match(sharedNav, /coinSells:\s*number/, 'FinanceNavCounts.coinSells');

console.log('adminRuntimeWiring.selftest: ok');
