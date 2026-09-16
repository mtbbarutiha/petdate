/**
 * Launch wipe keeps catalog; clears users + finance when applied.
 * Run: cd packages/api && npx tsx src/launch-panel-wipe.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-launch-wipe-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.NODE_ENV = 'development';
process.env.ALLOW_DEMO_SEEDS = '1';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { getDb, dbService } = await import('./db');
  const { seedHrSalesDemoIfNeeded } = await import('./hr-sales-demo-seed');
  const { ensureHrSchema } = await import('./hr-service');
  const { ensureFinanceOsSchema } = await import('./finance-os-service');
  const { previewLaunchPanelWipe, applyLaunchPanelWipe, LAUNCH_PANEL_WIPE_CONFIRM } =
    await import('./launch-panel-wipe');

  ensureHrSchema();
  seedHrSalesDemoIfNeeded();
  ensureFinanceOsSchema();

  // Force a fake shop order + product so wipe has something to clear while keeping catalog
  const d = getDb();
  d.prepare(
    `INSERT OR IGNORE INTO shop_brands (id, label_fa, sort_order, featured, active)
     VALUES ('b-test', 'برند تست', 1, 0, 1)`
  ).run();
  d.prepare(
    `INSERT OR IGNORE INTO shop_categories (slug, label_fa, pet_type, description, emoji, sort_order)
     VALUES ('dog-food', 'غذای سگ', 'dog', '', '🦴', 10)`
  ).run();
  d.prepare(
    `INSERT OR REPLACE INTO shop_products (
      id, slug, title, brand_id, category_slug, pet_types, price_toman, cost_toman,
      in_stock, stock_qty, description, featured, updated_at
    ) VALUES ('p-test', 'p-test', 'محصول تست', 'b-test', 'dog-food', '["dog"]', 1000, 500, 1, 7, '', 0, datetime('now'))`
  ).run();
  d.prepare(
    `INSERT INTO shop_orders (user_id, status, total_toman, items_json, customer_name, customer_phone)
     VALUES (NULL, 'paid', 1000, '[]', 'سارا م.', '09100000001')`
  ).run();

  const { user: u } = dbService.findOrCreateUser({
    telegramId: `wipe_test_${process.pid}`,
    name: 'کاربر تست',
  });
  assert(u?.id, 'test user created');

  const preview = previewLaunchPanelWipe();
  assert(preview.dryRun === true, 'preview dry-run');
  assert(preview.confirm === LAUNCH_PANEL_WIPE_CONFIRM, 'confirm token');
  assert(preview.counts.shop_orders >= 1, 'preview sees shop orders');
  assert(preview.counts._keep_shop_products >= 1, 'preview keeps products listed');

  const stillOrder = Number(
    (d.prepare('SELECT COUNT(*) as c FROM shop_orders').get() as { c: number }).c
  );
  assert(stillOrder >= 1, 'dry-run must not delete orders');

  const applied = applyLaunchPanelWipe();
  assert(applied.dryRun === false, 'apply destructive');

  const afterOrders = Number(
    (d.prepare('SELECT COUNT(*) as c FROM shop_orders').get() as { c: number }).c
  );
  const afterProducts = Number(
    (d.prepare('SELECT COUNT(*) as c FROM shop_products WHERE id = ?').get('p-test') as { c: number })
      .c
  );
  const afterBrands = Number(
    (d.prepare('SELECT COUNT(*) as c FROM shop_brands WHERE id = ?').get('b-test') as { c: number }).c
  );
  const afterStock = Number(
    (d.prepare('SELECT stock_qty as s FROM shop_products WHERE id = ?').get('p-test') as { s: number })
      .s
  );
  const afterUser = dbService.getUserByTelegramId(`wipe_test_${process.pid}`);
  assert(afterOrders === 0, 'shop orders wiped');
  assert(afterProducts === 1, 'product kept');
  assert(afterBrands === 1, 'brand kept');
  assert(afterStock === 7, 'stock_qty kept');
  assert(!afterUser || String(afterUser.name || '').startsWith('[حذف‌شده'), 'user wiped/anonymized');

  console.log('launch-panel-wipe.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
