/**
 * Runtime flags + announcements + coin-sell admin review must actually persist
 * and be readable by the public config used by site/bot.
 * Run: cd packages/api && npx tsx src/runtime-settings.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-runtime-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { getDb, dbService } = await import('./db');
  const { adminPlatform } = await import('./admin-platform');
  const {
    getPublicPlatformConfig,
    getRuntimeFlags,
    isRuntimeFlagOn,
    featureDisabledPayload,
  } = await import('./runtime-settings');
  const { COIN_SELL_PRICE_TOMAN, MIN_SELL_COINS } = await import('@petdate/shared');

  getDb();

  const defaults = getRuntimeFlags();
  assert(defaults.shopEnabled === true, 'shop on by default');
  assert(defaults.maintenanceMode === false, 'maintenance off by default');
  assert(defaults.botForceJoin === true, 'force-join on by default');

  adminPlatform.setSettings({
    shopEnabled: '0',
    playdatesEnabled: '0',
    vetConsultEnabled: '0',
    botForceJoin: '0',
    paymentCardEnabled: '0',
    paymentStarsEnabled: '0',
    maintenanceMode: '1',
  });

  const flags = getRuntimeFlags();
  assert(flags.shopEnabled === false, 'shop flag off');
  assert(flags.playdatesEnabled === false, 'playdates flag off');
  assert(flags.vetConsultEnabled === false, 'vet flag off');
  assert(flags.botForceJoin === false, 'force-join flag off');
  assert(flags.paymentCardEnabled === false, 'card flag off');
  assert(flags.paymentStarsEnabled === false, 'stars flag off');
  assert(flags.maintenanceMode === true, 'maintenance on');
  assert(isRuntimeFlagOn('shopEnabled') === false, 'isRuntimeFlagOn shop');

  const payload = featureDisabledPayload('shopEnabled');
  assert(payload.reason === 'feature_disabled', 'disabled payload reason');
  assert(payload.flag === 'shopEnabled', 'disabled payload flag');

  const ann = adminPlatform.upsertAnnouncement({
    title: 'اعلان تست سیم‌کشی',
    body: 'بدنه اعلان',
    active: true,
    placement: 'bot',
  });
  assert(ann.active, 'announcement active');

  const hidden = adminPlatform.upsertAnnouncement({
    title: 'خاموش',
    body: 'نباید دیده شود',
    active: false,
    placement: 'landing',
  });
  assert(hidden.active === false, 'inactive announcement');

  const pub = getPublicPlatformConfig();
  assert(pub.shopEnabled === false, 'public config shop');
  assert(pub.maintenanceMode === true, 'public config maintenance');
  assert(pub.announcements.some((a) => a.title === 'اعلان تست سیم‌کشی'), 'active announcement public');
  assert(!pub.announcements.some((a) => a.title === 'خاموش'), 'inactive announcement hidden');

  const { user } = dbService.findOrCreateUser({
    telegramId: `runtime-sell-${process.pid}`,
    name: 'فروشنده تست',
    username: 'runtime_sell',
  });
  getDb().prepare('UPDATE users SET coins = ? WHERE id = ?').run(200, user.id);

  const submitted = dbService.submitCoinSell({
    userId: user.id,
    coins: MIN_SELL_COINS,
    rateToman: COIN_SELL_PRICE_TOMAN,
    cardNumber: '6037991122334455',
    minCoins: MIN_SELL_COINS,
  });
  assert(submitted.ok, 'coin sell submitted');
  if (!submitted.ok) return;
  assert(dbService.countOpenCoinSellRequests() >= 1, 'open sell counted');

  const listed = dbService.listCoinSellRequestsAdmin({ status: 'open' });
  const row = listed.find((r) => r.id === submitted.requestId);
  assert(row, 'admin list includes request');
  assert(row!.cardNumber.replace(/\D/g, '').length === 16, 'admin sees full card');
  assert(row!.cardMasked.includes('****'), 'masked still present');

  const paid = dbService.reviewCoinSellRequest(submitted.requestId, { action: 'paid', note: 'واریز تست' });
  assert(paid.ok, 'paid review');
  assert(paid.ok && paid.request.status === 'paid', 'status paid');
  assert(dbService.countOpenCoinSellRequests() === 0, 'queue emptied after pay');

  const submitted2 = dbService.submitCoinSell({
    userId: user.id,
    coins: MIN_SELL_COINS,
    rateToman: COIN_SELL_PRICE_TOMAN,
    cardNumber: '6037991122334455',
    minCoins: MIN_SELL_COINS,
  });
  assert(submitted2.ok, 'second sell submitted');
  if (!submitted2.ok) return;
  const coinsBefore = dbService.getUserById(user.id)?.coins ?? 0;
  const rejected = dbService.reviewCoinSellRequest(submitted2.requestId, {
    action: 'rejected',
    note: 'کارت نامعتبر',
  });
  assert(rejected.ok && rejected.refundedCoins === MIN_SELL_COINS, 'reject refunds coins');
  const coinsAfter = dbService.getUserById(user.id)?.coins ?? 0;
  assert(coinsAfter === coinsBefore + MIN_SELL_COINS, 'balance restored');

  dbService.addSupportMessage(user.id, 'user', 'سلام پشتیبانی تست');
  dbService.addSupportMessage(user.id, 'assistant', 'پاسخ تست');
  const threads = dbService.listSupportThreadsAdmin(20);
  assert(threads.some((t) => t.userId === user.id && t.messageCount >= 2), 'support thread listed');

  console.log('runtime-settings.selftest: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
