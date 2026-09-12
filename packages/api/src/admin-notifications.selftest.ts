/**
 * Admin header notifications selftest — schema, seed, RBAC filter, mark read.
 * Run: cd packages/api && npx tsx src/admin-notifications.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-admin-notif-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.ADMIN_SUPPORT_PASSWORD = '';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { ensureHrSchema } = await import('./hr-service');
  const hrMod = await import('./hr-modules');
  const {
    ensureAdminNotificationsSchema,
    listAdminHeaderNotifications,
    markAdminHeaderNotificationRead,
    markAllAdminHeaderNotificationsRead,
    seedAdminNotificationsIfEmpty,
  } = await import('./admin-notifications');

  ensureHrSchema();
  ensureAdminNotificationsSchema();

  const adminActor = {
    kind: 'env_admin' as const,
    role: 'admin',
    permissions: ['admin.full'],
    displayName: 'مدیر',
    username: 'admin',
  };

  const supportActor = {
    kind: 'env_support' as const,
    role: 'support',
    permissions: ['support.inbox', 'platform.read', 'hr.read'],
    displayName: 'پشتیبانی',
    username: 'support1',
  };

  seedAdminNotificationsIfEmpty();
  seedAdminNotificationsIfEmpty(); // idempotent

  const first = await listAdminHeaderNotifications(adminActor);
  assert(first.items.length >= 6, 'seeded header notifications present');
  assert(first.unreadCount >= 1, 'unread count > 0');

  const support = await listAdminHeaderNotifications(supportActor);
  assert(
    support.items.every((i) => i.module !== 'sales' || i.id.startsWith('live:')),
    'support does not see sales-module db seeds'
  );
  assert(
    !support.items.some((i) => i.href === '/admin/sales/tickets' && i.id.startsWith('db:')),
    'sales seed hidden from support'
  );

  const crm = await import('./crm-service');
  crm.ensureCrmSchema();
  const customer = crm.findOrCreateCustomerByMobile(
    { mobile: '09120001100', first: 'اعلان', last: 'تیکت' },
    adminActor
  );
  const ticket = crm.createTicket(
    { customerId: customer.id, title: 'تیکت اعلان تست', description: 'بدنه' },
    adminActor
  );
  const withTicket = await listAdminHeaderNotifications(adminActor);
  assert(
    withTicket.items.some((i) => i.href === `/admin/crm/ticketing?view=detail&id=${ticket.id}`),
    'new CRM ticket pushed to header اعلانات'
  );

  hrMod.pushNotification('اعلان تست هدر', 'info');
  const withHr = await listAdminHeaderNotifications(adminActor);
  assert(
    withHr.items.some((i) => i.id.startsWith('hr:') && i.title.includes('اعلان تست')),
    'HR live notification aggregated'
  );

  const hrItem = withHr.items.find((i) => i.id.startsWith('hr:'));
  assert(hrItem, 'hr item exists');
  const marked = markAdminHeaderNotificationRead(adminActor, hrItem!.id);
  assert(marked.ok, 'mark hr read ok');

  const dbItem = withHr.items.find((i) => i.id.startsWith('db:') && !i.read);
  if (dbItem) {
    assert(markAdminHeaderNotificationRead(adminActor, dbItem.id).ok, 'mark db read');
  }

  markAllAdminHeaderNotificationsRead(adminActor);
  const afterAll = await listAdminHeaderNotifications(adminActor);
  assert(
    afterAll.items.filter((i) => !i.read).length === 0,
    'mark-all clears unread (no live sales/mail in temp db)'
  );

  console.log('admin-notifications.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
