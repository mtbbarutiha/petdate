/**
 * HR↔Sales demo seed selftest — idempotent, non-zero dashboards, owner cross-links.
 * Run: cd packages/api && npx tsx src/hr-sales-demo-seed.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-hr-sales-seed-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.ADMIN_SEED_PASSWORD = 'petdate-seed';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { ensureHrSchema, resolveAdminActor } = await import('./hr-service');
  const { ensureSalesSchema, getSalesDashboard, listSalesItems, listSalesCustomers } =
    await import('./sales-service');
  const hrMod = await import('./hr-modules');
  const { seedHrSalesDemoIfNeeded, ensureSystemRolePermissionBackfill } =
    await import('./hr-sales-demo-seed');

  ensureHrSchema();
  ensureSalesSchema();
  ensureSystemRolePermissionBackfill();
  seedHrSalesDemoIfNeeded();
  seedHrSalesDemoIfNeeded();

  const { getDb } = await import('./db');
  const d = getDb();
  const empCount = Number(
    (d.prepare(`SELECT COUNT(*) as c FROM hr_employees WHERE personnel_code LIKE 'SEED-%'`).get() as {
      c: number;
    }).c
  );
  assert(empCount >= 7, `expected ≥7 SEED employees, got ${empCount}`);

  const contracts = Number(
    (d.prepare('SELECT COUNT(*) as c FROM hr_contracts').get() as { c: number }).c
  );
  assert(contracts >= 7, 'contracts linked to employees');

  const dash = hrMod.getHrOverviewDashboard();
  assert(dash.kpis.personnel >= 7, 'HR dashboard personnel');
  assert(dash.kpis.orgCostMonth > 0, 'HR org cost non-zero');
  assert(dash.kpis.serviceHoursMonth > 0, 'HR service hours non-zero');
  assert(dash.kpis.unreadNotifications > 0 || dash.kpis.openRequests > 0, 'HR cockpit signals');
  assert(Array.isArray(dash.charts?.byDepartment) && dash.charts.byDepartment.length >= 1, 'charts.byDepartment');
  assert(Array.isArray(dash.charts?.costByDepartment) && dash.charts.costByDepartment.length >= 1, 'charts.costByDepartment');
  assert(
    Math.abs(
      dash.charts.costByDepartment.reduce((s, r) => s + r.total, 0) - dash.kpis.orgCostMonth
    ) < 1,
    'costByDepartment matches orgCostMonth'
  );
  assert(Array.isArray(dash.charts?.byContractStatus), 'charts.byContractStatus');
  assert(Array.isArray(dash.recentLogs) && dash.recentLogs.length >= 1, 'recentLogs seeded');
  assert(dash.recentLogs[0]?.personName, 'recentLogs have personName');

  const rec = hrMod.getRecruitmentDashboard();
  assert(rec.kpis.candidates >= 4, 'recruitment candidates');
  assert(rec.kpis.openJobs >= 1, 'open jobs');
  assert(Array.isArray(rec.stageChart) && rec.stageChart.length >= 1, 'stageChart');

  const reports = hrMod.getReportsSummary();
  assert(Array.isArray(reports.byDept) && reports.byDept.length >= 1, 'reports.byDept');
  assert(Array.isArray(reports.byStatus), 'reports.byStatus');
  assert(Array.isArray(reports.byLocation), 'reports.byLocation');

  const admin = resolveAdminActor({ password: 'super-admin-bootstrap' });
  assert(admin, 'admin actor');
  assert(admin!.permissions.includes('sales.read'), 'admin has sales.read after backfill');

  const salesDash = getSalesDashboard(admin!);
  assert(salesDash.activeLeads >= 1, 'active leads');
  assert(salesDash.callsToday >= 1, 'calls today');
  assert(salesDash.totalWonValue > 0 || salesDash.salesTodayCount >= 1, 'won value/sales today');

  const items = listSalesItems({ limit: 100 });
  assert(items.total >= 8, 'sales items seeded');
  const owned = items.items.filter(
    (i) => i.ownerId && String(i.ownerId).toUpperCase().startsWith('SEED-')
  );
  assert(owned.length >= 3, 'sales owners linked to HR personnel codes');

  const withAvatar = Number(
    (
      d
        .prepare(
          `SELECT COUNT(*) as c FROM hr_employees
           WHERE personnel_code LIKE 'SEED-%' AND avatar_url IS NOT NULL AND avatar_url != ''`
        )
        .get() as { c: number }
    ).c
  );
  assert(withAvatar === 5, `expected 5 SEED avatars, got ${withAvatar}`);

  const customers = listSalesCustomers();
  assert(customers.total >= 1, 'customers seeded');

  console.log('hr-sales-demo-seed.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
