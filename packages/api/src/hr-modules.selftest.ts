/**
 * HR full modules selftest — dashboards, onboarding hire, cost, requests, armita.
 * Run: cd packages/api && npx tsx src/hr-modules.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-hr-modules-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.ADMIN_SUPPORT_PASSWORD = '';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { ensureHrSchema, createEmployee, createJobOpening, createCandidate, createContract } =
    await import('./hr-service');
  const hrMod = await import('./hr-modules');

  ensureHrSchema();

  const emp = createEmployee({
    firstName: 'علی',
    lastName: 'تستی',
    jobTitle: 'کارشناس فروش',
    department: 'فروش',
    benefits: {
      eidi: true,
      sanavat: true,
      insurance: true,
      bonus: true,
      commission: true,
      training: false,
    },
  });
  createContract(emp.id, {
    startDate: '2026-01-01',
    salary: 100_000_000,
    eidi: 12_000_000,
    sanavat: 6_000_000,
    commissionPercent: 2,
  });

  hrMod.upsertCostEntry({
    employeeId: emp.id,
    year: 2026,
    month: 9,
    insurance: 1_000_000,
    tax: 2_000_000,
    bonus: 500_000,
    sales: 50_000_000,
  });

  const cost = hrMod.monthlyCostForPerson(emp.id, 2026, 9);
  assert(cost.salary >= 100_000_000, 'salary includes contract');
  assert(cost.insurance === 1_000_000, 'insurance applied');
  assert(cost.tax === 2_000_000, 'tax always applied');
  assert(cost.total > cost.salary, 'total > salary');

  hrMod.createServiceEntry({
    employeeId: emp.id,
    year: 2026,
    month: 9,
    hours: 8,
    note: 'پروژه تست',
  });
  assert(hrMod.totalServiceHours(2026, 9) >= 8, 'service hours');

  const req = hrMod.createRequest({ employeeId: emp.id, type: 'مرخصی', days: 2 });
  assert(hrMod.advanceRequest(req.id)!.status === 'بررسی مدیر', 'request advance');
  assert(hrMod.advanceRequest(req.id)!.status === 'بررسی HR', 'request to HR');
  assert(hrMod.advanceRequest(req.id)!.status === 'تایید شده', 'request approved');
  const bal = hrMod.leaveBalance(emp.id);
  assert(bal.used === 2 && bal.remaining === 24, 'leave balance');

  const opening = createJobOpening({ title: 'کارشناس پشتیبانی', department: 'عملیات' });
  const { candidate } = createCandidate({
    firstName: 'سارا',
    lastName: 'جدید',
    mobile: '09120000000',
    jobOpeningId: opening.id,
  });
  const hired = hrMod.hireCandidate(candidate.id);
  assert(hired?.candidate?.stage === 'استخدام‌شده', 'hire stage');
  assert(hired?.onboarding?.tasks.length === 5, 'default onboarding tasks');
  assert(hrMod.listNotifications().length >= 2, 'notifications created');

  const dash = hrMod.getHrOverviewDashboard();
  assert(dash.kpis.personnel >= 2, 'overview personnel');
  assert(hrMod.getRecruitmentDashboard().kpis.candidates >= 1, 'recruitment candidates');
  assert(/نفر/.test(hrMod.armitaAnswer('تعداد پرسنل چقدر است؟')), 'armita personnel answer');

  const { getDb } = await import('./db');
  const cols = getDb()
    .prepare(`PRAGMA table_info(hr_employees)`)
    .all() as Array<{ name: string }>;
  assert(!cols.some((c) => /business/i.test(c.name)), 'no businessLine column');
  assert(cols.some((c) => c.name === 'avatar_url'), 'avatar_url column present');

  console.log('hr-modules.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
