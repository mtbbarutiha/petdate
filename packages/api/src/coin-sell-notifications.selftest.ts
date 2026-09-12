/**
 * Bot/site coin withdrawal → same coin_sell queue + admin اعلانات.
 * Run: cd packages/api && npx tsx src/coin-sell-notifications.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-coin-sell-notif-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.ADMIN_SUPPORT_PASSWORD = '';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COIN_SELL_PRICE_TOMAN,
  MIN_SELL_COINS,
  normalizeCoinSellAdminStatus,
} from '@petdate/shared';

async function main() {
  const usersSrc = readFileSync(join(process.cwd(), 'src/routes/users.ts'), 'utf8');
  assert.match(usersSrc, /channel:\s*['"]bot['"]/, 'bot sell route tags channel=bot');
  assert.match(usersSrc, /validateIranCard/, 'bot sell uses same card rules as site');
  assert.match(usersSrc, /COIN_SELL_PRICE_TOMAN/, 'bot sell uses shared sell rate');
  assert.match(usersSrc, /MIN_SELL_COINS/, 'bot sell uses shared minimum');
  assert.match(usersSrc, /submitCoinSell/, 'bot sell writes coin_sell_requests');

  const authSrc = readFileSync(join(process.cwd(), 'src/routes/auth.ts'), 'utf8');
  assert.match(authSrc, /channel:\s*['"]web['"]/, 'site withdraw tags channel=web');
  assert.match(authSrc, /\/earn\/withdraw/, 'site withdraw path');
  assert.match(authSrc, /submitCoinSell/, 'site withdraw writes same table');

  const notifSrc = readFileSync(join(process.cwd(), 'src/admin-notifications.ts'), 'utf8');
  assert.match(notifSrc, /listCoinSellsLive/, 'header live-aggregates open withdrawals');
  assert.match(notifSrc, /live:coin-sells/, 'live coin-sell notif id');
  assert.match(notifSrc, /notifyCoinSellSubmitted/, 'per-request header push');
  assert.match(notifSrc, /syncOpenCoinSellNotifications/, 'backfill open rows into اعلانات');

  assert.equal(normalizeCoinSellAdminStatus('pending'), 'open', 'pending alias → open');
  assert.equal(normalizeCoinSellAdminStatus('paid'), 'paid', 'paid passthrough');

  const { dbService, getDb } = await import('./db');
  const {
    listAdminHeaderNotifications,
    markAllAdminHeaderNotificationsRead,
    syncOpenCoinSellNotifications,
  } = await import('./admin-notifications');
  getDb();

  const adminActor = {
    kind: 'env_admin' as const,
    role: 'admin',
    permissions: ['admin.full'],
    displayName: 'مدیر',
    username: 'admin',
  };

  const hrOnlyActor = {
    kind: 'account' as const,
    role: 'hr',
    permissions: ['hr.read'],
    displayName: 'منابع انسانی',
    username: 'hr1',
  };

  const { user } = dbService.findOrCreateUser({
    telegramId: `bot-sell-${process.pid}`,
    name: 'برداشت ربات',
    username: 'bot_withdraw',
  });
  getDb().prepare('UPDATE users SET coins = ? WHERE id = ?').run(400, user.id);

  const fromBot = dbService.submitCoinSell({
    userId: user.id,
    coins: MIN_SELL_COINS,
    rateToman: COIN_SELL_PRICE_TOMAN,
    cardNumber: '6037991122334455',
    minCoins: MIN_SELL_COINS,
    channel: 'bot',
  });
  assert(fromBot.ok, 'bot-path submit ok');
  if (!fromBot.ok) return;

  const listed = dbService.listCoinSellRequestsAdmin({ status: 'open' });
  const row = listed.find((r) => r.id === fromBot.requestId);
  assert(row, 'admin coin-sell queue includes bot request');
  assert(row!.channel === 'bot', 'stored channel is bot');
  assert(row!.status === 'open', 'canonical pending status is open');
  assert(dbService.countOpenCoinSellRequests() >= 1, 'finance badge count includes bot request');

  const pendingAlias = dbService.listCoinSellRequestsAdmin({
    status: normalizeCoinSellAdminStatus('pending'),
  });
  assert(
    pendingAlias.some((r) => r.id === fromBot.requestId),
    'status=pending lists the same open queue'
  );

  const header = await listAdminHeaderNotifications(adminActor);
  assert(
    header.items.some((i) => i.id === 'live:coin-sells' && i.href === '/admin/coin-sells'),
    'live اعلانات count includes open withdrawals'
  );
  assert(
    header.items.some(
      (i) =>
        i.href === '/admin/coin-sells' &&
        (i.id.startsWith('db:') || i.id === 'live:coin-sells') &&
        (i.title.includes('برداشت سکه') || i.body.includes('سکه'))
    ),
    'header shows coin withdrawal'
  );
  const perRequest = header.items.find(
    (i) => i.id.startsWith('db:') && i.title === 'درخواست برداشت سکه' && i.body.includes('ربات')
  );
  assert(perRequest, 'per-request header item for bot withdrawal');
  assert(perRequest!.module === 'finance', 'withdrawal notif is finance');

  const hrHeader = await listAdminHeaderNotifications(hrOnlyActor);
  assert(
    !hrHeader.items.some((i) => i.href === '/admin/coin-sells'),
    'hr-only actor does not see withdrawal اعلانات'
  );

  const paid = dbService.reviewCoinSellRequest(fromBot.requestId, { action: 'paid', note: 'تست' });
  assert(paid.ok && paid.request.status === 'paid', 'paid status');
  assert(dbService.countOpenCoinSellRequests() === 0, 'queue empty after payout');

  const afterPay = await listAdminHeaderNotifications(adminActor);
  assert(
    !afterPay.items.some((i) => i.id === 'live:coin-sells'),
    'live badge clears when queue is empty'
  );

  const fromWeb = dbService.submitCoinSell({
    userId: user.id,
    coins: MIN_SELL_COINS,
    rateToman: COIN_SELL_PRICE_TOMAN,
    cardNumber: '6037991122334455',
    minCoins: MIN_SELL_COINS,
    channel: 'web',
  });
  assert(fromWeb.ok, 'web-path submit ok');
  if (!fromWeb.ok) return;
  const webRow = dbService
    .listCoinSellRequestsAdmin({ status: 'open' })
    .find((r) => r.id === fromWeb.requestId);
  assert(webRow?.channel === 'web', 'web request same table + channel');

  const headerWeb = await listAdminHeaderNotifications(adminActor);
  assert(
    headerWeb.items.some((i) => i.id === 'live:coin-sells'),
    'web withdrawal appears in live اعلانات'
  );
  assert(
    headerWeb.items.some((i) => i.title === 'درخواست برداشت سکه' && i.body.includes('وب')),
    'web withdrawal per-request اعلان'
  );

  const rejected = dbService.reviewCoinSellRequest(fromWeb.requestId, {
    action: 'rejected',
    note: 'تست رد',
  });
  assert(rejected.ok && rejected.refundedCoins === MIN_SELL_COINS, 'reject refunds coins');

  const orphan = dbService.submitCoinSell({
    userId: user.id,
    coins: MIN_SELL_COINS,
    rateToman: COIN_SELL_PRICE_TOMAN,
    cardNumber: '6037991122334455',
    minCoins: MIN_SELL_COINS,
    channel: 'bot',
  });
  assert(orphan.ok, 'third request ok');
  if (!orphan.ok) return;
  markAllAdminHeaderNotificationsRead(adminActor);
  syncOpenCoinSellNotifications();
  const backfilled = await listAdminHeaderNotifications(adminActor);
  assert(
    backfilled.items.some((i) => i.title === 'درخواست برداشت سکه'),
    'open bot request stays visible after sync (source_key idempotent)'
  );

  console.log('coin-sell-notifications.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
