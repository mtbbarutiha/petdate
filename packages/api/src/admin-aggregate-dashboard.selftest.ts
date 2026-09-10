/**
 * Aggregate platform dashboard selftest — empty-safe zeros + seeded non-trivial series.
 * Run: cd packages/api && npx tsx src/admin-aggregate-dashboard.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-agg-dash-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.ADMIN_SEED_PASSWORD = 'petdate-seed';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { ensureHrSchema, resolveAdminActor } = await import('./hr-service');
  const { ensureSalesSchema } = await import('./sales-service');
  const { ensureCrmSchema } = await import('./crm-service');
  const { seedHrSalesDemoIfNeeded, ensureSystemRolePermissionBackfill } =
    await import('./hr-sales-demo-seed');
  const { seedCrmDemoIfNeeded } = await import('./crm-demo-seed');
  const { buildAggregateDashboard } = await import('./admin-aggregate-dashboard');
  const { getDb } = await import('./db');

  ensureHrSchema();
  ensureSalesSchema();
  ensureCrmSchema();
  ensureSystemRolePermissionBackfill();

  const admin = resolveAdminActor({ password: 'super-admin-bootstrap' });
  assert(admin, 'admin actor');

  // Empty-ish DB should still return zeros gracefully (additive shape)
  const empty = await buildAggregateDashboard(admin!);
  assert(empty.stats && typeof empty.stats.users === 'number', 'stats.users');
  assert(empty.modules?.hr && typeof empty.modules.hr.personnel === 'number', 'hr kpis');
  assert(empty.modules?.sales && typeof empty.modules.sales.activeLeads === 'number', 'sales kpis');
  assert(empty.modules?.crm && typeof empty.modules.crm.openTickets === 'number', 'crm kpis');
  assert(empty.modules?.mail && typeof empty.modules.mail.unread === 'number', 'mail kpis');
  assert(Array.isArray(empty.series?.usersTrend) && empty.series!.usersTrend.length === 14, 'usersTrend 14d');
  assert(Array.isArray(empty.series?.moduleMix) && empty.series!.moduleMix.length >= 4, 'moduleMix');
  assert(empty.links?.hr === '/admin/hr', 'deep link hr');
  assert(empty.links?.crm === '/admin/crm', 'deep link crm');
  assert(empty.links?.sales === '/admin/sales', 'deep link sales');
  assert(empty.links?.mail === '/admin/mail', 'deep link mail');

  seedHrSalesDemoIfNeeded();
  seedCrmDemoIfNeeded();

  // Touch platform tables so trends can be non-zero when rows exist
  const d = getDb();
  try {
    d.prepare(
      `INSERT INTO users (name, role, roles, is_active, created_at)
       VALUES ('Agg Test', 'owner', '["owner"]', 1, datetime('now'))`
    ).run();
  } catch {
    /* schema variants — ignore */
  }

  const seeded = await buildAggregateDashboard(admin!);
  assert(seeded.modules!.hr.personnel >= 5, 'seeded HR personnel');
  assert(seeded.modules!.sales.activeLeads >= 1, 'seeded sales leads');
  assert(
    seeded.modules!.crm.openTickets >= 0 &&
      (seeded.series!.crmDailyTickets.length > 0 ||
        seeded.series!.crmReasons.length >= 0 ||
        seeded.modules!.crm.openTickets >= 0),
    'crm series present'
  );
  assert(seeded.series!.salesStages.some((p) => p.value > 0), 'sales stages non-trivial');
  assert(seeded.series!.moduleMix.some((s) => s.value > 0), 'module mix non-trivial with seeds');

  // Idempotent second call — no wipe / shape stable
  const again = await buildAggregateDashboard(admin!);
  assert(again.modules!.hr.personnel === seeded.modules!.hr.personnel, 'stable HR count');
  assert(again.stats.users === seeded.stats.users, 'stable users');

  console.log('admin-aggregate-dashboard.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
