/**
 * Customer Affairs CRM selftest — SQLite temp DB.
 * Run: cd packages/api && npx tsx src/crm.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-crm-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { ensureHrSchema, resolveAdminActor } = await import('./hr-service');
  const crm = await import('./crm-service');
  const { seedCrmDemoIfNeeded } = await import('./crm-demo-seed');
  ensureHrSchema();
  crm.ensureCrmSchema();

  const admin = resolveAdminActor({ password: 'super-admin-bootstrap' });
  assert(admin, 'admin actor');
  assert(crm.isCrmAdmin(admin!), 'admin is crm admin');

  // unknown caller → customer
  const { customer, interaction } = crm.simulateInboundCall(
    { mobile: '09123334455', first: 'آوا', last: 'تست' },
    admin!
  );
  assert(customer.mobile === '09123334455', 'customer mobile');
  assert(interaction.wrapDone === false, 'wrap pending');

  // wrapup requires reason+summary
  const partial = crm.wrapUpInteraction(interaction.id, { reason: 'سایر', outcome: 'حل‌شده' }, admin!);
  assert(partial.wrapDone === false, 'incomplete wrap');

  const done = crm.wrapUpInteraction(
    interaction.id,
    {
      reason: 'اطلاعات محصول',
      subReason: 'ویژگی‌ها',
      outcome: 'تیکت ایجاد شد',
      summary: 'سوال قیمت اشتراک',
      createTicket: true,
      priority: 'بالا',
    },
    admin!
  );
  assert(done.wrapDone === true, 'wrap done');
  assert(done.ticketId, 'ticket created');

  const ticket = crm.getTicket(done.ticketId!)!;
  const oldSla = ticket.slaDue;
  const bumped = crm.patchTicket(ticket.id, { priority: 'بحرانی' }, admin!);
  assert(bumped.slaDue !== oldSla, 'priority change recalculates sla');

  let resolveFail = false;
  try {
    crm.patchTicket(ticket.id, { status: 'حل‌شده' }, admin!);
  } catch (e) {
    resolveFail = (e as Error & { status?: number }).status === 422 || /کد راه‌حل/.test((e as Error).message);
  }
  assert(resolveFail, 'resolve without code fails');

  const resolved = crm.patchTicket(
    ticket.id,
    { status: 'حل‌شده', resolutionCode: 'OK', resolutionNote: 'انجام شد' },
    admin!
  );
  assert(resolved.resolvedAt, 'resolved_at set');

  const reopened = crm.patchTicket(ticket.id, { status: 'بازگشایی‌شده' }, admin!);
  assert(reopened.reopenedCount >= 1, 'reopen increments');
  assert(reopened.resolvedAt == null, 'resolved_at cleared');

  // referral reject escalates
  const refCall = crm.simulateInboundCall({ mobile: '09126667788' }, admin!);
  const wrappedRef = crm.wrapUpInteraction(
    refCall.interaction.id,
    {
      reason: 'استفاده',
      subReason: 'فنی',
      outcome: 'ارجاع به مالی',
      summary: 'درخواست استرداد وجه',
      requestedAction: 'بررسی استرداد',
      createTicket: true,
      amount: 100000,
    },
    admin!
  );
  assert(wrappedRef.referralId, 'referral created');
  const afterReject = crm.respondReferral(wrappedRef.referralId!, { approve: false, response: 'رد' }, admin!);
  assert(afterReject.status === 'رد شد', 'rejected');
  if (afterReject.ticketId) {
    const esc = crm.getTicket(afterReject.ticketId)!;
    assert(esc.status === 'ارجاع به سطح بالاتر', 'escalated');
  }

  // QA critical zeroes score + coaching task
  const qaCall = crm.simulateInboundCall({ mobile: '09127778899' }, admin!);
  crm.wrapUpInteraction(
    qaCall.interaction.id,
    {
      reason: 'سایر',
      subReason: 'عمومی',
      outcome: 'حل‌شده',
      summary: 'پاسخ عمومی کوتاه',
    },
    admin!
  );
  const review = crm.createQaReview(
    {
      interactionId: qaCall.interaction.id,
      scores: { greeting: 90, listening: 90, knowledge: 90, resolution: 90, closing: 90, tone: 90 },
      critical: ['توهین به مشتری'],
      coaching: true,
      improvement: 'لحن',
    },
    admin!
  );
  assert(review.total === 0, 'critical zeroes score');
  const tasks = crm.listTasks({ status: 'باز' });
  assert(tasks.some((t) => t.kind === 'کوچینگ'), 'coaching task');

  // survey mean
  const survey = crm.createSurvey(
    {
      customerId: customer.id,
      answers: { q1: 5, q2: 4, q3: 3, q4: 5, q5: 3 },
    },
    admin!
  );
  assert(survey.rating === 4, `survey mean got ${survey.rating}`);

  // SMS pattern render
  const patterns = crm.listSmsPatterns();
  assert(patterns.length >= 1, 'patterns');
  const sent = crm.sendSmsPattern(patterns[0].id, customer.id, admin!, { ticketPublicId: 'TK-TEST' });
  assert(sent.text.includes('آوا') || sent.text.includes('مشتری'), 'sms renders name');

  // agent without reports_team (crm.admin) cannot see others
  const agentActor = {
    kind: 'account' as const,
    role: 'crm_agent',
    permissions: ['crm.read', 'crm.write'],
    displayName: 'کارشناس',
    username: 'agent1',
  };
  let denied = false;
  try {
    crm.getCrmReportSummary(agentActor, { agentId: 'someone_else' });
  } catch (e) {
    denied = (e as Error & { status?: number }).status === 403;
  }
  assert(denied, 'agent cannot see others reports');

  // inbox border for breached
  const inbox = crm.listInbox({ limit: 50 });
  assert(inbox.rows.length >= 1, 'inbox rows');

  seedCrmDemoIfNeeded();
  seedCrmDemoIfNeeded(); // idempotent
  const dash = crm.getCrmDashboard(admin!);
  assert(dash.openTickets >= 1 || dash.callsToday >= 0, 'dashboard');
  assert(crm.listCustomers().total >= 5, 'seed customers');

  console.log('crm.selftest: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
