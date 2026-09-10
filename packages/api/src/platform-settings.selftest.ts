/**
 * Platform settings selftest — dropdown soft-delete + module goals.
 * Run: cd packages/api && npx tsx src/platform-settings.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-platform-settings-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.ADMIN_SUPPORT_PASSWORD = '';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const {
    ensurePlatformSettingsSchema,
    listPlatformModules,
    listDropdownOptions,
    createDropdownOption,
    softDeleteDropdownOption,
    resolveDropdownLabel,
    listActiveDropdownLabels,
    upsertModuleGoals,
    getModuleGoals,
    listDropdownAudit,
  } = await import('./platform-settings-service');
  const { getSalesSettings } = await import('./sales-service');

  ensurePlatformSettingsSchema();

  const modules = listPlatformModules();
  assert(modules.length === 5, 'five modules');
  assert(modules.some((m) => m.key === 'upgrade'), 'upgrade module present');
  assert(modules.some((m) => m.key === 'ats'), 'ats module');

  const stages = listDropdownOptions('sales', 'lead_sources');
  assert(stages.length >= 5, 'lead sources seeded');

  const created = createDropdownOption({
    moduleKey: 'sales',
    fieldKey: 'lead_sources',
    label: 'منبع تست ابری',
    actor: 'selftest',
  });
  assert(created.active, 'created active');
  assert(listActiveDropdownLabels('sales', 'lead_sources').includes('منبع تست ابری'), 'active list has new');

  softDeleteDropdownOption(created.id, 'selftest');
  assert(
    !listActiveDropdownLabels('sales', 'lead_sources').includes('منبع تست ابری'),
    'soft-deleted hidden from active'
  );
  assert(
    resolveDropdownLabel('sales', 'lead_sources', created.value) === 'منبع تست ابری',
    'soft-deleted still resolves for reports'
  );

  const audit = listDropdownAudit({ moduleKey: 'sales', fieldKey: 'lead_sources', limit: 20 });
  assert(audit.some((a) => a.action === 'soft_delete'), 'audit has soft_delete');

  const goals = upsertModuleGoals({
    moduleKey: 'ats',
    targets: {
      weekly_hires: 3,
      ads_resume_screening: 40,
      weekly_calls: 25,
      weekly_interviews: 8,
    },
    actor: 'selftest',
  });
  assert(goals.targets.weekly_hires === 3, 'ats weekly hires');
  assert(getModuleGoals('upgrade').targets.weekly_upgrades === 0, 'upgrade goals default 0');

  upsertModuleGoals({
    moduleKey: 'upgrade',
    targets: { weekly_upgrades: 12, conversion_rate: 18, aov: 900000 },
    actor: 'selftest',
  });
  assert(getModuleGoals('upgrade').targets.weekly_upgrades === 12, 'upgrade goal saved');

  upsertModuleGoals({
    moduleKey: 'hr',
    targets: {
      personnel_info_completion: 95,
      contract_renewal: 4,
      service_delivery: 120,
      cost_allocation: 50_000_000,
    },
    actor: 'selftest',
  });
  assert(getModuleGoals('hr').targets.personnel_info_completion === 95, 'hr goal');

  upsertModuleGoals({
    moduleKey: 'platform',
    targets: { identity_verification_volume: 80, identity_verification_quality: 92 },
    actor: 'selftest',
  });
  assert(getModuleGoals('platform').targets.identity_verification_quality === 92, 'platform goal');

  upsertModuleGoals({
    moduleKey: 'sales',
    targets: { leads: 100, daily_handling: 30, conversion_rate: 12, aov: 500000, total_sales_amount: 20_000_000 },
    actor: 'selftest',
  });
  assert(getModuleGoals('sales').targets.leads === 100, 'sales goal');

  // Sales settings consumer reads platform active labels
  const salesSettings = getSalesSettings();
  assert(Array.isArray(salesSettings.leadSources) && salesSettings.leadSources.length > 0, 'sales leadSources from platform');
  assert(!salesSettings.leadSources.includes('منبع تست ابری'), 'soft-deleted not in sales settings');

  console.log('platform-settings.selftest: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
