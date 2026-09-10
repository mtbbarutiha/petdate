/**
 * Platform dashboard activity + filter selftest.
 * Run: cd packages/api && npx tsx src/admin-dashboard-activity.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-dash-act-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.ADMIN_SEED_PASSWORD = 'petdate-seed';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { ensureHrSchema, resolveAdminActor, createEmployee, createCandidate } =
    await import('./hr-service');
  const { ensureSalesSchema } = await import('./sales-service');
  const { ensureCrmSchema } = await import('./crm-service');
  const { seedHrSalesDemoIfNeeded, ensureSystemRolePermissionBackfill } =
    await import('./hr-sales-demo-seed');
  const { buildAggregateDashboard, getPlatformActivity } =
    await import('./admin-aggregate-dashboard');

  ensureHrSchema();
  ensureSalesSchema();
  ensureCrmSchema();
  ensureSystemRolePermissionBackfill();
  seedHrSalesDemoIfNeeded();

  const admin = resolveAdminActor({ password: 'super-admin-bootstrap' });
  assert(admin, 'admin actor');

  createEmployee({
    firstName: 'تست',
    lastName: 'فیلتر',
    department: 'فروش',
    jobTitle: 'کارشناس فروش',
  });
  createCandidate({ firstName: 'کاندید', lastName: 'فعالیت', mobile: '09120001122' });

  const dash = await buildAggregateDashboard(admin!, {
    team: 'فروش',
  });
  assert(dash.filterOptions?.teams?.length, 'filter teams');
  assert(dash.filterOptions?.people?.length, 'filter people');
  assert(dash.filters?.team === 'فروش', 'team filter echoed');
  assert(Array.isArray(dash.series?.salesStages), 'salesStages');

  const payFiltered = await buildAggregateDashboard(admin!, {
    paymentType: dash.series!.paymentMix[0]?.label || 'x',
  });
  assert(payFiltered.filters?.paymentType, 'paymentType filter');

  const activity = getPlatformActivity({ limit: 50 });
  assert(Array.isArray(activity.rows), 'activity rows');
  assert(
    activity.rows.some((r) => r.source === 'hr_candidates' || r.source === 'hr_employee_logs' || r.source === 'users'),
    'activity has known sources'
  );

  console.log('admin-dashboard-activity.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
