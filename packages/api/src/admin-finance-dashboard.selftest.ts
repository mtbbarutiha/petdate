/**
 * Finance dashboard charts selftest — dashboard embeds sales + P&L series.
 * Run: cd packages/api && npx tsx src/admin-finance-dashboard.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-finance-dash-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.ADMIN_SEED_PASSWORD = 'petdate-seed';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { getDb } = await import('./db');
  const { adminFinance } = await import('./admin-finance');
  const { adminPlatform } = await import('./admin-platform');

  // Touch schema via settings / platform helpers
  void adminPlatform.getSettings();

  const empty = adminFinance.getDashboard('month');
  assert(empty.kpis && typeof empty.kpis.revenue === 'number', 'kpis.revenue');
  assert(Array.isArray(empty.charts?.salesTrend), 'charts.salesTrend');
  assert(empty.charts!.salesTrend.length >= 1, 'salesTrend has day buckets even when empty');
  assert(Array.isArray(empty.charts?.pnlCompare) && empty.charts!.pnlCompare.length === 3, 'pnlCompare');
  assert(Array.isArray(empty.charts?.categories), 'charts.categories');
  assert(Array.isArray(empty.charts?.paymentMix), 'charts.paymentMix');
  assert(Array.isArray(empty.charts?.revenueMix), 'charts.revenueMix');

  const d = getDb();
  // Seed a paid shop order so trend / category charts are non-trivial when possible
  try {
    d.prepare(
      `INSERT INTO shop_orders (
         user_id, status, total_toman, items_json, payment_currency, created_at
       ) VALUES (1, 'paid', 250000, ?, 'toman', datetime('now'))`
    ).run(JSON.stringify([{ title: 'غذا', qty: 1, priceToman: 250000, categorySlug: 'food' }]));
  } catch {
    try {
      d.prepare(
        `INSERT INTO shop_orders (status, total_toman, items_json, created_at)
         VALUES ('paid', 250000, ?, datetime('now'))`
      ).run(JSON.stringify([{ title: 'غذا', qty: 1, priceToman: 250000, categorySlug: 'food' }]));
    } catch {
      /* schema variants — charts still must exist as empty-safe series */
    }
  }

  const seeded = adminFinance.getDashboard('month');
  assert(seeded.charts!.salesTrend.some((p) => typeof p.value === 'number'), 'salesTrend numeric');
  assert(seeded.charts!.pnlCompare.every((p) => typeof p.value === 'number'), 'pnl numeric');
  const sales = adminFinance.getSalesCharts('month');
  assert(Array.isArray(sales.dailyOrMonthly) && sales.dailyOrMonthly.length >= 1, 'getSalesCharts series');

  const pnl = adminFinance.getPnL('month');
  assert(typeof pnl.revenue === 'number' && Array.isArray(pnl.lines), 'pnl shape');

  console.log('admin-finance-dashboard.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
