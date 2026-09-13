/**
 * Production gate for HR/CRM demo seeds (SEED-HR-01 / 09120006001).
 * Run: cd packages/api && npx tsx src/demo-seeds-guard.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-demo-seed-gate-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.ADMIN_SEED_PASSWORD = 'petdate-seed';
process.env.NODE_ENV = 'production';
delete process.env.ALLOW_DEMO_SEEDS;
delete process.env.ALLOW_DEMO_SEED;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { allowDemoSeeds } = await import('./demo-seeds-guard');
  assert(allowDemoSeeds() === false, 'production without flag skips demo seeds');

  process.env.ALLOW_DEMO_SEEDS = '1';
  assert(allowDemoSeeds() === true, 'ALLOW_DEMO_SEEDS=1 enables demo seeds in production');
  delete process.env.ALLOW_DEMO_SEEDS;
  process.env.ALLOW_DEMO_SEED = '1';
  assert(allowDemoSeeds() === true, 'ALLOW_DEMO_SEED=1 alias works');
  delete process.env.ALLOW_DEMO_SEED;

  const { ensureHrSchema } = await import('./hr-service');
  const { ensureSalesSchema } = await import('./sales-service');
  const crm = await import('./crm-service');
  const { seedHrSalesDemoIfNeeded } = await import('./hr-sales-demo-seed');
  const { seedCrmDemoIfNeeded } = await import('./crm-demo-seed');
  const { getDb } = await import('./db');

  ensureHrSchema();
  ensureSalesSchema();
  crm.ensureCrmSchema();

  seedHrSalesDemoIfNeeded();
  seedCrmDemoIfNeeded();

  const d = getDb();
  const hr = Number(
    (d.prepare(`SELECT COUNT(*) as c FROM hr_employees WHERE personnel_code = 'SEED-HR-01'`).get() as {
      c: number;
    }).c
  );
  const crmRow = Number(
    (d.prepare(`SELECT COUNT(*) as c FROM crm_customers WHERE mobile = '09120006001'`).get() as {
      c: number;
    }).c
  );
  assert(hr === 0, 'production boot must not insert SEED-HR-01');
  assert(crmRow === 0, 'production boot must not insert CRM 09120006001');

  process.env.ALLOW_DEMO_SEEDS = '1';
  seedHrSalesDemoIfNeeded();
  seedCrmDemoIfNeeded();
  const hrOn = Number(
    (d.prepare(`SELECT COUNT(*) as c FROM hr_employees WHERE personnel_code = 'SEED-HR-01'`).get() as {
      c: number;
    }).c
  );
  const crmOn = Number(
    (d.prepare(`SELECT COUNT(*) as c FROM crm_customers WHERE mobile = '09120006001'`).get() as {
      c: number;
    }).c
  );
  assert(hrOn === 1, 'explicit ALLOW_DEMO_SEEDS=1 seeds HR marker');
  assert(crmOn === 1, 'explicit ALLOW_DEMO_SEEDS=1 seeds CRM marker');

  console.log('demo-seeds-guard.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
