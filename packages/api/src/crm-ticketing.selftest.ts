/**
 * Ticketing module selftest — schema, relations, SLA, escalate/macro.
 * Run: cd packages/api && npx tsx src/crm-ticketing.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-ticketing-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { ensureHrSchema, resolveAdminActor } = await import('./hr-service');
  const crm = await import('./crm-service');
  ensureHrSchema();
  crm.ensureCrmSchema();

  const admin = resolveAdminActor({ password: 'super-admin-bootstrap' });
  assert(admin, 'admin');

  const customer = crm.findOrCreateCustomerByMobile(
    { mobile: '09120001122', first: 'نیکا', last: 'تیکت' },
    admin!
  );

  const ticket = crm.createTicket(
    {
      customerId: customer.id,
      title: 'مشکل ورود به پنل',
      description: 'رمز را فراموش کردم',
      type: 'دسترسی',
      category: 'رمز عبور',
      subCategory: 'فراموشی رمز',
      priority: 'بالا',
      channel: 'chat',
      queueId: 'q_support',
    },
    admin!
  );
  assert(ticket.publicId, 'publicId');
  assert(ticket.queueId === 'q_support', 'queue');
  assert(ticket.channel === 'chat', 'channel');
  assert(ticket.firstResponseDueAt, 'first response due');
  assert(ticket.teamId, 'team from queue');

  let orphanFail = false;
  try {
    crm.createTicket({ customerId: 999999, title: 'bad' }, admin!);
  } catch (e) {
    orphanFail = /مشتری/.test((e as Error).message);
  }
  assert(orphanFail, 'create rejects missing customer');

  const assigned = crm.patchTicket(
    ticket.id,
    { agentId: 'agent-1', agentName: 'آوا', status: 'تخصیص‌یافته' },
    admin!
  );
  assert(assigned.agentId === 'agent-1', 'assigned');

  const { referral } = crm.escalateTicket(
    ticket.id,
    { type: 'finance', reason: 'کیف پول', requestedAction: 'بررسی تراکنش', amount: 1000 },
    admin!
  );
  assert(referral.ticketId === ticket.id, 'referral linked');
  const waiting = crm.getTicket(ticket.id)!;
  assert(waiting.status === 'در انتظار داخلی', 'waiting internal');
  assert(waiting.pendingReason === 'در انتظار مالی', 'pending reason');

  crm.respondReferral(referral.id, { approve: true, response: 'تایید شد', status: 'تایید' }, admin!);
  const after = crm.getTicket(ticket.id)!;
  assert(after.status === 'در حال بررسی', 'back to in-progress after referral');

  const vip = crm.runTicketMacro(ticket.id, 'vip', admin!);
  assert(vip.queueId === 'q_vip', 'vip queue');
  assert(vip.tags.includes('vip'), 'vip tag');

  const overview = crm.getTicketingOverview(admin!);
  assert(overview.tickets.length >= 1, 'overview tickets');
  assert(typeof overview.stats.open === 'number', 'stats');
  assert(Array.isArray(overview.agents), 'agents');

  const acts = crm.listTicketActivities(ticket.id);
  assert(acts.length >= 2, 'timeline activities');
  assert(acts.some((a) => a.kind === 'created' || a.kind === 'escalation' || a.kind === 'assigned'), 'kinds');

  const publicReply = crm.patchTicket(
    ticket.id,
    {
      activityText: 'پاسخ تست برای مشتری',
      activityKind: 'public_reply',
      activityVisibility: 'public',
    },
    admin!
  );
  assert(publicReply.id === ticket.id, 'public reply patch');
  assert(
    crm.listPublicTicketActivities(ticket.id).some((a) => a.text.includes('پاسخ تست')),
    'public activities include reply'
  );

  const repaired = crm.repairOrphanTicketRelations();
  assert(repaired.orphanTickets === 0, 'no orphans after clean create');

  const detail = crm.getCustomerDetail(customer.id)!;
  assert(detail.tickets.some((t) => t.id === ticket.id), 'customer detail includes ticket');
  assert(detail.tickets[0].customerName, 'customer name joined on tickets');

  console.log('crm-ticketing.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
