/**
 * ATS follow-up workflow selftest — calls escalate, interview, reject-no-contact.
 * Run: cd packages/api && npx tsx src/hr-ats-followup.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-hr-ats-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const {
    ensureHrSchema,
    createEmployee,
    createJobOpening,
    createCandidate,
    recordCandidateCall,
    scheduleCandidateInterview,
    setCandidateDecision,
    getCandidate,
    listPersonnelJobTitles,
  } = await import('./hr-service');
  const { HR_CALL_CONNECTED, HR_REJECTED_NO_CONTACT } = await import('@petdate/shared');
  const hrMod = await import('./hr-modules');

  ensureHrSchema();

  createEmployee({
    firstName: 'مریم',
    lastName: 'مصاحبه‌گر',
    jobTitle: 'کارشناس منابع انسانی',
    department: 'منابع انسانی',
  });
  const titles = listPersonnelJobTitles();
  assert(titles.includes('کارشناس منابع انسانی'), 'personnel job titles');
  // Case-insensitive duplicate should collapse; query must stay PG-safe (no COLLATE NOCASE).
  createEmployee({
    firstName: 'نرگس',
    lastName: 'دوم',
    jobTitle: 'کارشناس منابع انسانی',
    department: 'منابع انسانی',
  });
  const titles2 = listPersonnelJobTitles();
  assert(
    titles2.filter((t) => t === 'کارشناس منابع انسانی').length === 1,
    'distinct job titles'
  );

  const opening = createJobOpening({ title: 'کارشناس فروش', department: 'فروش' });
  const { candidate } = createCandidate({
    firstName: 'رضا',
    lastName: 'متقاضی',
    mobile: '09121112233',
    email: 'reza@gmail.com',
    jobBoard: 'جابینجا',
    jobTitle: 'کارشناس فروش',
    jobOpeningId: opening.id,
  });
  assert(candidate.jobBoard === 'جابینجا', 'jobBoard saved');
  assert(candidate.jobTitle === 'کارشناس فروش', 'jobTitle saved');
  assert(candidate.followup.callRound === 1, 'starts at call 1');

  const { isHrCallNoContact, HR_CALL_NO_CONTACT_OUTCOMES } = await import('@petdate/shared');
  assert(HR_CALL_NO_CONTACT_OUTCOMES.length === 3, 'three no-contact cases');
  assert(isHrCallNoContact('نبود') && isHrCallNoContact('عدم دسترسی') && isHrCallNoContact('موکول به آینده'), 'no-contact helper');
  assert(!isHrCallNoContact(HR_CALL_CONNECTED), 'connected is not no-contact');

  let c = recordCandidateCall(candidate.id, {
    outcome: 'نبود',
    note: 'زنگ اول بی‌پاسخ',
  });
  assert(c?.followup.callRound === 2, 'escalate to call 2');
  assert(c?.followup.calls[0]?.note === 'زنگ اول بی‌پاسخ', 'call note persisted');
  c = recordCandidateCall(candidate.id, {
    outcome: 'عدم دسترسی',
    note: 'شماره در دسترس نیست',
    at: '2026-09-08',
  });
  assert(c?.followup.callRound === 3, 'escalate to call 3');
  assert(c?.followup.calls[1]?.at.startsWith('2026-09-08'), 'call 2 custom date');
  c = recordCandidateCall(candidate.id, { outcome: 'موکول به آینده', at: '2026-09-09' });
  assert(c?.stage === HR_REJECTED_NO_CONTACT, 'reject after 3 fails');

  const { candidate: c2 } = createCandidate({
    firstName: 'سارا',
    lastName: 'وصل',
    mobile: '09123334455',
    email: 'sara@gmail.com',
    jobBoard: 'لینکدین',
    jobTitle: 'کارشناس فروش',
    jobOpeningId: opening.id,
  });
  c = recordCandidateCall(c2.id, { outcome: HR_CALL_CONNECTED, note: 'علاقه‌مند' });
  assert(c?.stage === 'غربالگری تلفنی', 'connected → screening');
  c = scheduleCandidateInterview(c2.id, {
    interviewAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    interviewerEmployeeId: 1,
    interviewerName: 'مریم مصاحبه‌گر',
    interviewNote: 'مصاحبه حضوری سعادت‌آباد',
  });
  assert(c?.stage === 'مصاحبه', 'interview stage');
  assert(c?.followup.interviewAt, 'interviewAt set');
  assert(c?.followup.interviewNote === 'مصاحبه حضوری سعادت‌آباد', 'interview note');

  const tasks = hrMod.cockpitTasks();
  const interviewTask = tasks.find((t) => t.refType === 'candidate' && t.refId === c2.id);
  assert(interviewTask, 'cockpit interview task');
  assert(interviewTask?.employeeId === 1, 'task assigned to interviewer');
  assert(interviewTask?.detail.includes('مصاحبه حضوری'), 'task includes interview note');

  c = setCandidateDecision(c2.id, { decision: 'approve', startDate: '2026-10-01' });
  assert(c?.followup.decision === 'approve', 'approve decision');
  assert(c?.stage === 'پیشنهاد شغلی', 'offer stage after approve');

  const reports = hrMod.getReportsSummary();
  assert(!reports.byGender.some((r) => r.name === 'نامشخص'), 'no نامشخص gender');
  assert(!reports.byMarital.some((r) => r.name === 'نامشخص'), 'no نامشخص marital');
  assert(Array.isArray(reports.byJobTitle), 'byJobTitle present');
  assert(reports.ageStats && typeof reports.ageStats.sample === 'number', 'ageStats');

  // Fresh reject path
  const { candidate: c3 } = createCandidate({
    firstName: 'علی',
    lastName: 'رد',
    mobile: '09125556677',
    jobOpeningId: opening.id,
  });
  setCandidateDecision(c3.id, { decision: 'reject' });
  assert(getCandidate(c3.id)?.stage === 'رد شده', 'reject stage');

  console.log('hr-ats-followup.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
