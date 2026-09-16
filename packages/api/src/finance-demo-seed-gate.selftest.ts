/**
 * Production must not auto-inject fake shop orders / Finance OS CoA.
 * Run: cd packages/api && npx tsx src/finance-demo-seed-gate.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-finance-demo-gate-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.NODE_ENV = 'production';
delete process.env.ALLOW_DEMO_SEEDS;
delete process.env.ALLOW_DEMO_SEED;
delete process.env.SEED_DEMO_DATA;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { getDb } = await import('./db');
  const { ensureFinanceOsSchema } = await import('./finance-os-service');

  const d = getDb();
  // Boot already ran seedFinanceDefaults under production gate.
  const orders = Number(
    (d.prepare('SELECT COUNT(*) as c FROM shop_orders').get() as { c: number }).c
  );
  const seedLedger = Number(
    (d.prepare(`SELECT COUNT(*) as c FROM wallet_ledger WHERE ref_type = 'seed'`).get() as {
      c: number;
    }).c
  );
  assert(orders === 0, `production must not seed fake shop_orders (got ${orders})`);
  assert(seedLedger === 0, `production must not seed wallet_ledger seed rows (got ${seedLedger})`);

  ensureFinanceOsSchema();
  const biz = Number(
    (d.prepare('SELECT COUNT(*) as c FROM finance_os_businesses').get() as { c: number }).c
  );
  assert(biz === 0, `production must not seed Finance OS businesses (got ${biz})`);

  console.log('finance-demo-seed-gate.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
