/**
 * User portal support tickets — CRM create + list by platform user.
 * Run: cd packages/api && npx tsx src/support-tickets.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-support-tickets-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { ensureHrSchema } = await import('./hr-service');
  const { dbService } = await import('./db');
  const crm = await import('./crm-service');
  ensureHrSchema();
  crm.ensureCrmSchema();

  const { user: created } = dbService.findOrCreateUser({
    telegramId: `tg_support_ticket_${process.pid}`,
    name: 'کاربر تیکت',
  });
  assert(created?.id, 'user created');
  dbService.updateUserProfile(created.id, { phone: '09123334455' });
  const user = dbService.getUserById(created.id)!;

  const ticket = crm.createUserSupportTicket(user, {
    title: 'OTP نیومد',
    description: 'چند بار درخواست دادم',
    channel: 'web',
  });
  assert(ticket.id > 0, 'ticket id');
  assert(ticket.title === 'OTP نیومد', 'title');
  assert(ticket.channel === 'web', 'channel web');
  assert(ticket.type === 'پشتیبانی', 'type');
  assert(ticket.queueId === 'q_support', 'queue');

  const listed = crm.listTicketsForPlatformUser(user.id);
  assert(listed.some((t) => t.id === ticket.id), 'listed for platform user');

  const again = crm.findOrCreateCustomerForPlatformUser(user, crm.portalTicketActor());
  assert(again.platformUserId === user.id, 'customer linked');

  dbService.deleteUserByTelegramId(user.telegramId!);
  console.log('support-tickets.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
