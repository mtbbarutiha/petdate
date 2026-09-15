/**
 * P0 money/auth hardening — would fail on main ~fcb1497e:
 * 1) stars/complete anonymous mint
 * 2) client-supplied coins on create/approve/complete
 * 3) telegramId-only sell + checkout-*-telegram
 * 4) client-chosen daily amount
 * 5) shop cancel does not refund wallet
 * 6) P&L double-counts shopcard
 *
 * Run: cd packages/api && npx tsx src/finance-p0-hardening.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-finance-p0-${process.pid}.db`;
process.env.TELEGRAM_BOT_TOKEN = 'selftest-bot-token-finance-p0';
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.NODE_ENV = 'production';
delete process.env.ALLOW_DEMO_SEEDS;
delete process.env.ALLOW_DEMO_SEED;

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function request(
  app: Express,
  method: string,
  path: string,
  opts?: { body?: unknown; headers?: Record<string, string> }
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      const payload = opts?.body != null ? JSON.stringify(opts.body) : undefined;
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: {
            'content-type': 'application/json',
            ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}),
            ...(opts?.headers ?? {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c as Buffer));
          res.on('end', () => {
            server.close();
            const raw = Buffer.concat(chunks).toString('utf8');
            let body: Record<string, unknown> = {};
            try {
              body = JSON.parse(raw) as Record<string, unknown>;
            } catch {
              body = { error: raw };
            }
            resolve({ status: res.statusCode || 0, body });
          });
        }
      );
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

async function main() {
  const usersSrc = readFileSync(join(process.cwd(), 'src/routes/users.ts'), 'utf8');
  const shopSrc = readFileSync(join(process.cwd(), 'src/routes/shop.ts'), 'utf8');
  const financeSrc = readFileSync(join(process.cwd(), 'src/admin-finance.ts'), 'utf8');

  assert.match(
    usersSrc,
    /payments\/:id\/stars\/complete',\s*requireTrustedStaff/,
    'stars/complete requires bot or admin'
  );
  assert.match(usersSrc, /requireBotOrMatchingTelegram/, 'telegram money routes gated');
  assert.match(usersSrc, /catalogPaymentAmounts/, 'create payment uses catalog');
  assert.match(usersSrc, /claimDailyCoins\(user\.id\)/, 'daily claim ignores client amount');
  assert.match(shopSrc, /requireTelegramCheckoutUser/, 'telegram checkout gated');
  assert.match(shopSrc, /checkout\/coins-telegram[\s\S]{0,200}requireTelegramCheckoutUser/, 'coins-telegram gated');
  assert.match(shopSrc, /checkout\/toman-telegram[\s\S]{0,200}requireTelegramCheckoutUser/, 'toman-telegram gated');
  assert.match(shopSrc, /checkout\/wallet-stars-telegram[\s\S]{0,200}requireTelegramCheckoutUser/, 'wallet-stars-telegram gated');
  assert.match(financeSrc, /package_id NOT LIKE 'shop%'/, 'P&L topups exclude shopcard');

  const {
    catalogPaymentAmounts,
    DAILY_COIN_REWARD,
    MIN_SELL_COINS,
  } = await import('@petdate/shared');
  const { getDb, dbService } = await import('./db');
  getDb();

  const express = (await import('express')).default;
  const { usersRouter } = await import('./routes/users.ts');
  const { shopRouter } = await import('./routes/shop.ts');
  const app = express();
  app.use(express.json());
  app.use('/api/users', usersRouter);
  app.use('/api/shop', shopRouter);

  const stamp = `${process.pid}-${Date.now()}`;
  const { user } = dbService.findOrCreateUser({
    telegramId: `p0-mint-${stamp}`,
    name: 'P0 Mint',
  });
  const startCoins = dbService.getUserById(user.id)!.coins ?? 0;

  // --- 1) stars/complete without bot/admin header must not mint ---
  const created = await request(app, 'POST', `/api/users/telegram/${user.telegramId}/payments`, {
    headers: { 'x-petdate-bot-token': BOT_TOKEN! },
    body: { packageId: 'p50', coins: 999999, amountToman: 1, method: 'stars' },
  });
  assert.equal(created.status, 201, `create payment 201 got ${created.status}`);
  const order = created.body.order as { id: number; coins: number; amountToman: number; packageId: string };
  assert.equal(order.packageId, 'p50', 'catalog package id');
  assert.equal(order.coins, 50, 'create ignores client coins 999999');
  assert.equal(order.amountToman, catalogPaymentAmounts('p50')!.toman, 'create ignores client toman');

  const anonComplete = await request(app, 'POST', `/api/users/payments/${order.id}/stars/complete`, {
    body: { telegramPaymentChargeId: 'charge-anon' },
  });
  assert.equal(anonComplete.status, 401, 'anonymous stars/complete is 401');
  assert.equal(dbService.getUserById(user.id)!.coins, startCoins, 'anon complete does not mint');

  const botComplete = await request(app, 'POST', `/api/users/payments/${order.id}/stars/complete`, {
    headers: { 'x-petdate-bot-token': BOT_TOKEN! },
    body: { telegramPaymentChargeId: 'charge-bot' },
  });
  assert.equal(botComplete.status, 200, `bot stars/complete 200 got ${botComplete.status} ${JSON.stringify(botComplete.body)}`);
  assert.equal(
    dbService.getUserById(user.id)!.coins,
    startCoins + 50,
    'bot complete credits catalog 50 not client 999999'
  );

  // Poisoned row: package p50 but coins column 999999 — credit still 50
  const { user: poisonedUser } = dbService.findOrCreateUser({
    telegramId: `p0-poison-${stamp}`,
    name: 'P0 Poison',
  });
  const poisonBefore = dbService.getUserById(poisonedUser.id)!.coins ?? 0;
  const poisonOrder = dbService.createPaymentOrder({
    userId: poisonedUser.id,
    packageId: 'p50',
    coins: 999999,
    amountToman: 1,
    amountStars: 1,
    method: 'stars',
    status: 'awaiting_stars',
  });
  const poisonResult = dbService.completeStarsPayment({
    orderId: poisonOrder.id,
    telegramPaymentChargeId: 'poison-charge',
  });
  assert.equal(poisonResult.ok, true, 'poisoned complete still ok');
  assert.equal(
    dbService.getUserById(poisonedUser.id)!.coins,
    poisonBefore + 50,
    'completeStarsPayment ignores stored coins 999999'
  );

  const cardPoison = dbService.createPaymentOrder({
    userId: poisonedUser.id,
    packageId: 'p50',
    coins: 999999,
    amountToman: 1,
    method: 'card',
    status: 'awaiting_receipt',
  });
  assert.equal(dbService.attachPaymentReceipt(cardPoison.id, 'file-poison').ok, true, 'receipt');
  const beforeCard = dbService.getUserById(poisonedUser.id)!.coins ?? 0;
  const approved = dbService.approveCardPayment(cardPoison.id);
  assert.equal(approved.ok, true, 'approve poisoned card');
  assert.equal(
    dbService.getUserById(poisonedUser.id)!.coins,
    beforeCard + 50,
    'approveCardPayment ignores stored coins 999999'
  );

  // --- 3) sell / checkout without bot token ---
  getDb().prepare('UPDATE users SET coins = ? WHERE id = ?').run(startCoins + 200, user.id);
  const beforeSell = dbService.getUserById(user.id)!.coins ?? 0;
  const anonSell = await request(app, 'POST', `/api/users/telegram/${user.telegramId}/coins/sell`, {
    body: { coins: MIN_SELL_COINS, cardNumber: '6037991122334455' },
  });
  assert.equal(anonSell.status, 401, 'anon sell is 401');
  assert.equal(dbService.getUserById(user.id)!.coins, beforeSell, 'anon sell does not debit');

  const { adminPlatform } = await import('./admin-platform');
  const sku = `p0-sku-${stamp}`;
  adminPlatform.upsertShopProduct({
    id: sku,
    slug: sku,
    title: 'P0 Test Food',
    brandId: 'selftest',
    categorySlug: 'food',
    priceToman: 2000,
    costToman: 1000,
    inStock: true,
    stockQty: 10,
  });

  const beforeCheckout = dbService.getUserById(user.id)!.coins ?? 0;
  const anonCheckout = await request(app, 'POST', '/api/shop/checkout/coins-telegram', {
    body: {
      telegramId: user.telegramId,
      items: [{ productId: sku, qty: 1 }],
      customerName: 'Ali',
      customerPhone: '09120000000',
      address: 'Tehran',
    },
  });
  assert.equal(anonCheckout.status, 401, `anon coins-telegram 401 got ${anonCheckout.status}`);
  assert.equal(dbService.getUserById(user.id)!.coins, beforeCheckout, 'anon checkout does not debit');

  const paidCheckout = await request(app, 'POST', '/api/shop/checkout/coins-telegram', {
    headers: { 'x-petdate-bot-token': BOT_TOKEN! },
    body: {
      telegramId: user.telegramId,
      items: [{ productId: sku, qty: 1 }],
      customerName: 'Ali',
      customerPhone: '09120000000',
      address: 'Tehran',
    },
  });
  assert.equal(paidCheckout.status, 201, `bot coins-telegram 201 got ${paidCheckout.status} ${JSON.stringify(paidCheckout.body)}`);
  const shopOrder = paidCheckout.body.order as { id: number; paymentAmount?: number };
  const afterPay = dbService.getUserById(user.id)!.coins ?? 0;
  assert.ok(afterPay < beforeCheckout, 'checkout deducted coins');

  // --- 5) cancel refunds wallet, idempotent ---
  const cancelled = adminPlatform.updateShopOrderStatus(shopOrder.id, 'cancelled');
  assert.equal(cancelled?.status, 'cancelled', 'status cancelled');
  const afterRefund = dbService.getUserById(user.id)!.coins ?? 0;
  assert.equal(afterRefund, beforeCheckout, 'cancel restores coins');
  adminPlatform.updateShopOrderStatus(shopOrder.id, 'cancelled');
  assert.equal(dbService.getUserById(user.id)!.coins, beforeCheckout, 'second cancel is idempotent');

  const tomanBefore = dbService.getWallet(user.id)!.toman;
  dbService.creditWallet(user.id, 'toman', 50_000, { reason: 'selftest_toman', skipLedger: true });
  const tomanFunded = dbService.getWallet(user.id)!.toman;
  const tomanCheckout = await request(app, 'POST', '/api/shop/checkout/toman-telegram', {
    headers: { 'x-petdate-bot-token': BOT_TOKEN! },
    body: {
      telegramId: user.telegramId,
      items: [{ productId: sku, qty: 1 }],
      customerName: 'Ali',
      customerPhone: '09120000000',
      address: 'Tehran',
    },
  });
  assert.equal(tomanCheckout.status, 201, 'toman checkout');
  const tomanOrder = tomanCheckout.body.order as { id: number };
  assert.ok((dbService.getWallet(user.id)!.toman) < tomanFunded, 'toman deducted');
  adminPlatform.updateShopOrderStatus(tomanOrder.id, 'cancelled');
  assert.equal(dbService.getWallet(user.id)!.toman, tomanFunded, 'toman cancel refunds');
  adminPlatform.updateShopOrderStatus(tomanOrder.id, 'cancelled');
  assert.equal(dbService.getWallet(user.id)!.toman, tomanFunded, 'toman refund idempotent');
  void tomanBefore;

  // --- 4) daily coins: ignore client amount, once-per-day ---
  const { user: dailyUser } = dbService.findOrCreateUser({
    telegramId: `p0-daily-${stamp}`,
    name: 'P0 Daily',
  });
  const dailyBefore = dbService.getUserById(dailyUser.id)!.coins ?? 0;
  const anonDaily = await request(app, 'POST', `/api/users/telegram/${dailyUser.telegramId}/coins/daily`, {
    body: { amount: 999999 },
  });
  assert.equal(anonDaily.status, 401, 'anon daily is 401');
  assert.equal(dbService.getUserById(dailyUser.id)!.coins, dailyBefore, 'anon daily does not mint');

  const daily = await request(app, 'POST', `/api/users/telegram/${dailyUser.telegramId}/coins/daily`, {
    headers: { 'x-petdate-bot-token': BOT_TOKEN! },
    body: { amount: 999999 },
  });
  assert.equal(daily.status, 200, `daily 200 got ${daily.status}`);
  assert.equal(daily.body.awarded, DAILY_COIN_REWARD, 'daily award is server grant');
  assert.equal(
    dbService.getUserById(dailyUser.id)!.coins,
    dailyBefore + DAILY_COIN_REWARD,
    'daily ignores client 999999'
  );
  const dailyAgain = await request(app, 'POST', `/api/users/telegram/${dailyUser.telegramId}/coins/daily`, {
    headers: { 'x-petdate-bot-token': BOT_TOKEN! },
    body: { amount: 999999 },
  });
  assert.equal(dailyAgain.status, 409, 'second daily claim is once-per-day');
  assert.equal(
    dbService.getUserById(dailyUser.id)!.coins,
    dailyBefore + DAILY_COIN_REWARD,
    'second claim does not mint'
  );

  const dbDaily = dbService.claimDailyCoins(dailyUser.id, 999999);
  assert.equal(dbDaily.ok, false, 'db claimDailyCoins ignores amount and stays once-per-day');

  // --- 6) shopcard counted once in P&L ---
  const { adminFinance } = await import('./admin-finance');
  const beforeDash = adminFinance.getDashboard('month');
  const shopcardToman = 180_000;
  getDb()
    .prepare(
      `INSERT INTO payment_orders (user_id, package_id, coins, amount_toman, method, status, created_at)
       VALUES (?, 'shopcard', 0, ?, 'card', 'approved', datetime('now'))`
    )
    .run(user.id, shopcardToman);
  getDb()
    .prepare(
      `INSERT INTO shop_orders (user_id, status, total_toman, items_json, payment_currency, created_at)
       VALUES (?, 'paid', ?, ?, 'toman_card', datetime('now'))`
    )
    .run(
      user.id,
      shopcardToman,
      JSON.stringify([{ title: 'shopcard', qty: 1, priceToman: shopcardToman, categorySlug: 'food' }])
    );
  const afterDash = adminFinance.getDashboard('month');
  const topupDelta = afterDash.breakdown.paymentTopups - beforeDash.breakdown.paymentTopups;
  const shopDelta = afterDash.breakdown.shopRevenue - beforeDash.breakdown.shopRevenue;
  const revenueDelta = afterDash.kpis.revenue - beforeDash.kpis.revenue;
  assert.equal(topupDelta, 0, `shopcard must not add to topups (got ${topupDelta})`);
  assert.equal(shopDelta, shopcardToman, `shop revenue +${shopcardToman} once`);
  assert.equal(revenueDelta, shopcardToman, `dashboard revenue counts shopcard once not 2×`);

  console.log('finance-p0-hardening.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
