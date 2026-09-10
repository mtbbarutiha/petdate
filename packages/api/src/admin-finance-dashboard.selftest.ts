/**
 * Finance dashboard charts selftest — dashboard embeds sales + P&L series.
 * Also verifies consult commission = percent × invoice (fee_coins → toman).
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
  const { COIN_PRICE_TOMAN } = await import('@petdate/shared');
  const { getDb } = await import('./db');
  const { adminFinance } = await import('./admin-finance');
  const { adminPlatform } = await import('./admin-platform');

  // Touch schema via settings / platform helpers
  void adminPlatform.getSettings();
  // Ensure percent setting (migration path ignores legacy toman)
  adminPlatform.setSettings({
    vetConsultFeePercent: '20',
    vetConsultFeeToman: '250000', // legacy — must be ignored by finance calc
  });

  const empty = adminFinance.getDashboard('month');
  assert(empty.kpis && typeof empty.kpis.revenue === 'number', 'kpis.revenue');
  assert(Array.isArray(empty.charts?.salesTrend), 'charts.salesTrend');
  assert(empty.charts!.salesTrend.length >= 1, 'salesTrend has day buckets even when empty');
  assert(Array.isArray(empty.charts?.pnlCompare) && empty.charts!.pnlCompare.length === 3, 'pnlCompare');
  assert(Array.isArray(empty.charts?.categories), 'charts.categories');
  assert(Array.isArray(empty.charts?.paymentMix), 'charts.paymentMix');
  assert(Array.isArray(empty.charts?.revenueMix), 'charts.revenueMix');
  assert(empty.settings.vetConsultFeePercent === 20, 'dashboard exposes percent setting');
  assert(
    (empty.settings as Record<string, number>).vetConsultFeeToman == null,
    'legacy toman setting not exposed'
  );

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

  // Consult invoice: 50 coins → 50 * COIN_PRICE_TOMAN toman; 20% commission
  try {
    d.prepare(
      `INSERT INTO users (id, telegram_id, name, role, coins, created_at)
       VALUES (9001, 'finance-dash-vet', 'Vet', 'vet', 0, datetime('now')),
              (9002, 'finance-dash-pat', 'Pat', 'user', 0, datetime('now'))`
    ).run();
  } catch {
    /* users may already exist / schema differs */
  }
  try {
    d.prepare(
      `INSERT INTO vet_consultations (
         vet_user_id, patient_user_id, status, fee_coins, service_kind, created_at
       ) VALUES (9001, 9002, 'completed', 50, 'vet', datetime('now'))`
    ).run();
  } catch (err) {
    throw new Error(`failed to seed vet consult for fee percent test: ${(err as Error).message}`);
  }

  const seeded = adminFinance.getDashboard('month');
  assert(seeded.charts!.salesTrend.some((p) => typeof p.value === 'number'), 'salesTrend numeric');
  assert(seeded.charts!.pnlCompare.every((p) => typeof p.value === 'number'), 'pnl numeric');
  const expectedVet = Math.round(50 * COIN_PRICE_TOMAN * 0.2);
  assert(
    seeded.breakdown.vetFees === expectedVet,
    `vetFees percent×invoice: got ${seeded.breakdown.vetFees}, want ${expectedVet}`
  );
  assert(seeded.breakdown.vetConsults >= 1, 'vetConsults counted');

  const sales = adminFinance.getSalesCharts('month');
  assert(Array.isArray(sales.dailyOrMonthly) && sales.dailyOrMonthly.length >= 1, 'getSalesCharts series');

  const pnl = adminFinance.getPnL('month');
  assert(typeof pnl.revenue === 'number' && Array.isArray(pnl.lines), 'pnl shape');
  const vetLine = pnl.lines.find((l) => l.key === 'vet');
  assert(vetLine?.amount === expectedVet, 'pnl vet line uses percent×invoice');

  console.log('admin-finance-dashboard.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
