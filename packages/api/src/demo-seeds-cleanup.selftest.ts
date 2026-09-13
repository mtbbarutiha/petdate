/**
 * Demo-seed cleanup is dry-run by default and only matches known markers.
 * Run: cd packages/api && npx tsx src/demo-seeds-cleanup.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-demo-cleanup-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.ADMIN_SEED_PASSWORD = 'petdate-seed';
process.env.NODE_ENV = 'production';
process.env.ALLOW_DEMO_SEEDS = '1';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { ensureHrSchema } = await import('./hr-service');
  const { ensureSalesSchema } = await import('./sales-service');
  const crm = await import('./crm-service');
  const { seedHrSalesDemoIfNeeded } = await import('./hr-sales-demo-seed');
  const { seedCrmDemoIfNeeded } = await import('./crm-demo-seed');
  const { getDb } = await import('./db');
  const { previewDemoSeedCleanup, applyDemoSeedCleanup, DEMO_SEED_PURGE_CONFIRM } =
    await import('./demo-seeds-cleanup');

  ensureHrSchema();
  ensureSalesSchema();
  crm.ensureCrmSchema();
  seedHrSalesDemoIfNeeded();
  seedCrmDemoIfNeeded();

  const d = getDb();
  const beforeHr = Number(
    (d.prepare(`SELECT COUNT(*) as c FROM hr_employees WHERE personnel_code = 'SEED-HR-01'`).get() as {
      c: number;
    }).c
  );
  assert(beforeHr === 1, 'seed present before cleanup');

  const preview = previewDemoSeedCleanup();
  assert(preview.dryRun === true, 'preview is dry-run');
  assert(preview.counts.hrEmployees >= 1, 'preview counts seed employees');
  assert(preview.counts.crmCustomers >= 1, 'preview counts CRM seed mobiles');
  const stillHr = Number(
    (d.prepare(`SELECT COUNT(*) as c FROM hr_employees WHERE personnel_code = 'SEED-HR-01'`).get() as {
      c: number;
    }).c
  );
  assert(stillHr === 1, 'dry-run must not delete');

  const applied = applyDemoSeedCleanup();
  assert(applied.dryRun === false, 'apply is destructive');
  const afterHr = Number(
    (d.prepare(`SELECT COUNT(*) as c FROM hr_employees WHERE personnel_code = 'SEED-HR-01'`).get() as {
      c: number;
    }).c
  );
  const afterCrm = Number(
    (d.prepare(`SELECT COUNT(*) as c FROM crm_customers WHERE mobile = '09120006001'`).get() as {
      c: number;
    }).c
  );
  const afterAcct = Number(
    (d.prepare(`SELECT COUNT(*) as c FROM admin_accounts WHERE username LIKE 'seed.%'`).get() as {
      c: number;
    }).c
  );
  assert(afterHr === 0, 'apply deletes SEED-HR-01');
  assert(afterCrm === 0, 'apply deletes CRM 09120006001');
  assert(afterAcct === 0, 'apply deletes seed.* accounts');
  assert(DEMO_SEED_PURGE_CONFIRM === 'DELETE_DEMO_SEEDS', 'explicit confirm token');

  const roles = Number((d.prepare(`SELECT COUNT(*) as c FROM admin_roles`).get() as { c: number }).c);
  assert(roles > 0, 'system roles remain');

  console.log('demo-seeds-cleanup.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
