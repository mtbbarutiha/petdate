/**
 * HR onboard + colleague create upgrades selftest.
 * Run: npm run test:self:hr-onboard
 * Or: cd packages/api && npx tsx src/hr-onboard-colleague.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-hr-onboard-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.ADMIN_SUPPORT_PASSWORD = '';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const {
    ensureHrSchema,
    createEmployee,
    createContract,
    getEmployee,
    enforceExpiredContractAccess,
    listEmployeeLogs,
  } = await import('./hr-service');
  const hrMod = await import('./hr-modules');
  const { HR_MILITARY_STATUSES, makeDefaultOnboardingAccessItems } = await import('@petdate/shared');

  ensureHrSchema();

  // 1) create employee with username → org email autogen
  const emp = createEmployee({
    firstName: 'رضا',
    lastName: 'همکار',
    gender: 'آقا',
    militaryStatus: 'پایان خدمت',
    username: 'reza.colleague',
    mobile: '09121112233',
  });
  assert(emp.username === 'reza.colleague', 'username honored');
  assert(emp.orgEmail === 'reza.colleague@petdate.ir', 'org email autogen from username');
  assert(emp.mobile === '09121112233', 'mobile persisted');
  assert(HR_MILITARY_STATUSES.includes(emp.militaryStatus as (typeof HR_MILITARY_STATUSES)[number]), 'military status valid');

  // military only relevant for male — female clears conceptually (unit-level)
  const female = createEmployee({
    firstName: 'سارا',
    lastName: 'همکار',
    gender: 'خانم',
    militaryStatus: '',
    username: 'sara.colleague',
  });
  assert(female.militaryStatus === '', 'female has empty military');
  assert(female.orgEmail === 'sara.colleague@petdate.ir', 'female org email');

  // 2) create contract with end date in past → enforceExpiredContractAccess disables access
  createContract(emp.id, {
    startDate: '1400/01/01',
    endDate: '1400/06/31',
    salary: 50_000_000,
  });
  const logsAfterContract = listEmployeeLogs(emp.id);
  assert(
    logsAfterContract.some((l) => l.field === 'شروع قرارداد'),
    'contract start logged'
  );
  assert(
    logsAfterContract.some((l) => l.field === 'پایان قرارداد'),
    'contract end logged'
  );

  const disabledCount = enforceExpiredContractAccess();
  assert(disabledCount >= 1, 'at least one expired access disabled');
  const after = getEmployee(emp.id)!;
  assert(after.accessStatus === 'غیر فعال', 'accessStatus inactive after expiry');
  assert(
    listEmployeeLogs(emp.id).some((l) => l.field === 'accessStatus' && l.newValue === 'غیر فعال'),
    'access disable logged once'
  );

  // 3) onboarding access/equipment update with assetNo persists
  const onboard = hrMod.createOnboarding({
    employeeId: emp.id,
    name: `${emp.firstName} ${emp.lastName}`,
    jobTitle: 'کارشناس فروش',
    startDate: '1403/01/01',
  });
  assert(onboard.accessItems.length >= makeDefaultOnboardingAccessItems().length, 'default access items');
  assert(onboard.equipmentItems.length >= 1, 'default equipment items');

  const accessItems = onboard.accessItems.map((a, i) =>
    i === 0 ? { ...a, done: true } : a
  );
  const equipmentItems = onboard.equipmentItems.map((e, i) =>
    i === 0 ? { ...e, done: true, assetNo: 'AST-1001' } : e
  );
  const updated = hrMod.updateOnboardingChecklists(onboard.id, { accessItems, equipmentItems });
  assert(updated, 'onboarding update ok');
  assert(updated!.accessItems[0].done === true, 'access done persisted');
  assert(updated!.equipmentItems[0].assetNo === 'AST-1001', 'assetNo persisted');
  assert(updated!.equipmentItems[0].done === true, 'equipment done persisted');

  const listed = hrMod.listOnboarding();
  const found = listed.find((r) => r.id === onboard.id);
  assert(found?.equipmentItems[0].assetNo === 'AST-1001', 'list returns assetNo');

  console.log('hr-onboard-colleague.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
