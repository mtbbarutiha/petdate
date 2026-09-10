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
    getEmployeePlainPassword,
    resetEmployeePassword,
    updateEmployee,
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
    nationalId: '0011223344',
    password: 'HrTestPass99',
  });
  assert(emp.username === 'reza.colleague', 'username honored');
  assert(emp.orgEmail === 'reza.colleague@petdate.ir', 'org email autogen from username');
  assert(emp.mobile === '09121112233', 'mobile persisted');
  assert(HR_MILITARY_STATUSES.includes(emp.militaryStatus as (typeof HR_MILITARY_STATUSES)[number]), 'military status valid');
  assert(getEmployeePlainPassword(emp.id) === 'HrTestPass99', 'plain password readable for HR');

  // military only relevant for male — female clears conceptually (unit-level)
  const female = createEmployee({
    firstName: 'سارا',
    lastName: 'همکار',
    gender: 'خانم',
    militaryStatus: '',
    username: 'sara.colleague',
    nationalId: '9988776655',
  });
  assert(female.militaryStatus === '', 'female has empty military');
  assert(female.orgEmail === 'sara.colleague@petdate.ir', 'female org email');

  // 1b) duplicate nationalId → throws Persian error
  let dupThrown = false;
  try {
    createEmployee({
      firstName: 'تکراری',
      lastName: 'کدملی',
      username: 'dup.nid',
      nationalId: ' 0011223344 ',
    });
  } catch (err) {
    dupThrown = err instanceof Error && err.message === 'کد ملی تکراری است';
  }
  assert(dupThrown, 'duplicate nationalId throws کد ملی تکراری است');

  let dupUpdateThrown = false;
  try {
    updateEmployee(female.id, { nationalId: '0011223344' });
  } catch (err) {
    dupUpdateThrown = err instanceof Error && err.message === 'کد ملی تکراری است';
  }
  assert(dupUpdateThrown, 'update to duplicate nationalId throws');

  // same nationalId on self is ok
  const selfOk = updateEmployee(emp.id, { nationalId: '0011223344' });
  assert(selfOk?.nationalId === '0011223344', 'self nationalId update allowed');

  // 1c) reset password returns new plain password
  const resetPwd = resetEmployeePassword(emp.id);
  assert(resetPwd && resetPwd.length >= 6, 'reset password generated');
  assert(getEmployeePlainPassword(emp.id) === resetPwd, 'reset password persisted');

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

  // 4) sample HR tickets + resolve
  const samples = hrMod.ensureSampleHrTickets(emp.id);
  assert(samples.length >= 3, 'at least 3 sample HR tickets');
  const types = new Set(samples.map((s) => s.type));
  assert(types.has('مرخصی'), 'sample مرخصی');
  assert(types.has('تجهیزات'), 'sample تجهیزات');
  assert(types.has('گواهی اشتغال'), 'sample گواهی اشتغال');

  const again = hrMod.ensureSampleHrTickets(emp.id);
  assert(again.length === samples.length, 'ensureSampleHrTickets idempotent');

  const leave = samples.find((s) => s.type === 'مرخصی')!;
  const resolved = hrMod.resolveRequest(leave.id, { result: 'تایید مرخصی نمونه', note: 'selftest' });
  assert(resolved?.status === 'تایید شده', 'resolve sets تایید شده');
  assert(resolved?.result === 'تایید مرخصی نمونه', 'resolve stores result');

  console.log('hr-onboard-colleague.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
