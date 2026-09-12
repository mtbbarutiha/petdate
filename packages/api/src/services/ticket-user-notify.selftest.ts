/**
 * Public ticket reply delivery — web inbox + Telegram payload + UUID lookup.
 * Run: cd packages/api && npx tsx src/services/ticket-user-notify.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-ticket-user-notify-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.TELEGRAM_BOT_TOKEN = '';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { ensureHrSchema, resolveAdminActor } = await import('../hr-service');
  const { dbService } = await import('../db');
  const crm = await import('../crm-service');
  const {
    PETDATE_TICKET_REF_UUID,
    isRfcUuid,
    formatTicketReplyForUser,
    deliverTicketPublicReply,
  } = await import('./ticket-user-notify');
  const { listAdminHeaderNotifications } = await import('../admin-notifications');

  assert(isRfcUuid(PETDATE_TICKET_REF_UUID), 'known petdate ref is RFC UUID');
  assert(
    PETDATE_TICKET_REF_UUID === 'b98ef5d7-2e30-4fca-9854-4cadb3160aee',
    'fixture UUID matches user-supplied ticket/user id'
  );

  const formatted = formatTicketReplyForUser({
    ticketPublicId: 'TK-TEST01',
    ticketTitle: 'ورود',
    replyText: 'کد را دوباره بزن',
    agentName: 'آوا',
  });
  assert(formatted.includes('TK-TEST01'), 'formatted includes ticket code');
  assert(formatted.includes('کد را دوباره بزن'), 'formatted includes reply');
  assert(formatted.includes('آوا'), 'formatted includes agent');

  ensureHrSchema();
  crm.ensureCrmSchema();
  const admin = resolveAdminActor({ password: 'super-admin-bootstrap' });
  assert(admin, 'admin');

  const { user: created } = dbService.findOrCreateUser({
    telegramId: `tg_ticket_reply_${process.pid}`,
    name: 'کاربر UUID',
  });
  assert(created?.id, 'user');
  dbService.updateUserProfile(created.id, { phone: '09121112233' });
  const user = dbService.getUserById(created.id)!;

  const ticket = crm.createUserSupportTicket(user, {
    title: 'تیکت UUID',
    description: 'شناسه ارجاع',
    channel: 'web',
    uuid: PETDATE_TICKET_REF_UUID,
  });
  assert(ticket.uuid === PETDATE_TICKET_REF_UUID, 'ticket stored supplied UUID');
  assert(crm.getTicketByUuid(PETDATE_TICKET_REF_UUID)?.id === ticket.id, 'lookup by uuid');
  assert(crm.getTicketByRef(PETDATE_TICKET_REF_UUID)?.id === ticket.id, 'lookup by ref uuid');
  assert(crm.getTicketByRef(String(ticket.id))?.id === ticket.id, 'lookup by numeric id');
  assert(crm.getTicketByRef(ticket.publicId)?.id === ticket.id, 'lookup by TK- public id');

  const header = await listAdminHeaderNotifications(admin!);
  assert(
    header.items.some((i) => i.href.includes(`/admin/crm/ticketing?view=detail&id=${ticket.id}`)),
    'new ticket appears in admin اعلانات'
  );

  const replied = crm.patchTicket(
    ticket.id,
    {
      activityText: 'سلام — مشکل ورود را این‌طور حل کن',
      activityKind: 'public_reply',
      activityVisibility: 'public',
    },
    admin!
  );
  assert(replied.id === ticket.id, 'patched');

  const delivery = await deliverTicketPublicReply({
    ticketPublicId: ticket.publicId,
    ticketTitle: ticket.title,
    replyText: 'سلام — مشکل ورود را این‌طور حل کن',
    agentName: 'پشتیبانی',
    platformUserId: user.id,
    customerMobile: user.phone,
  });
  assert(delivery.webInbox, 'web support inbox received reply');
  assert(delivery.userId === user.id, 'resolved platform user');
  assert(delivery.telegram === false, 'telegram skipped without bot token / usable id');
  assert(delivery.text.includes(ticket.publicId), 'delivery text names ticket');

  const inbox = dbService.listSupportMessages(user.id);
  assert(
    inbox.some((m) => m.role === 'assistant' && m.text.includes('سلام — مشکل ورود را این‌طور حل کن')),
    'support_messages has public reply'
  );

  const publicActs = crm.listPublicTicketActivities(ticket.id);
  assert(publicActs.some((a) => a.kind === 'public_reply'), 'public_reply on timeline');

  dbService.deleteUserByTelegramId(user.telegramId!);
  console.log('ticket-user-notify.selftest: ok');
  console.log(`resolved UUID ${PETDATE_TICKET_REF_UUID} → crm ticket #${ticket.id} ${ticket.publicId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
