/**
 * Admin RBAC CRUD + custom role login — SQLite selftest.
 * Run: cd packages/api && npx tsx src/hr-rbac.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-hr-rbac-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.ADMIN_SUPPORT_PASSWORD = '';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const {
    actorHasPermission,
    createAdminAccount,
    createAdminRole,
    deleteAdminAccount,
    deleteAdminRole,
    ensureHrSchema,
    listAdminAccounts,
    listAdminRoles,
    resolveAdminActor,
    updateAdminAccount,
    updateAdminRole,
  } = await import('./hr-service');

  ensureHrSchema();

  const seeded = listAdminRoles({ includeInactive: true });
  assert(seeded.some((r) => r.key === 'admin'), 'admin role seeded');
  assert(seeded.some((r) => r.key === 'support'), 'support role seeded');

  // Seed must not overwrite UI edits
  const support = seeded.find((r) => r.key === 'support')!;
  updateAdminRole(support.id, {
    nameFa: 'پشتیبانی سفارشی',
    permissions: ['support.inbox', 'platform.read'],
  });
  ensureHrSchema();
  const supportAfter = listAdminRoles({ includeInactive: true }).find((r) => r.key === 'support')!;
  assert(supportAfter.nameFa === 'پشتیبانی سفارشی', 'seed must not overwrite role edits');
  assert(
    supportAfter.permissions.join(',') === 'support.inbox,platform.read',
    'seed must keep custom permissions'
  );

  const custom = createAdminRole({
    key: 'Content_Ops',
    nameFa: 'اپراتور محتوا',
    description: 'اعلان و محتوا',
    permissions: ['platform.read', 'platform.write'],
  });
  assert(custom.key === 'content_ops', 'role key normalized');
  assert(custom.permissions.includes('platform.write'), 'permissions saved');

  const account = createAdminAccount({
    username: 'ContentUser',
    password: 'secret12',
    roleKey: 'content_ops',
    displayName: 'اپراتور',
  });
  assert(account.username === 'contentuser', 'username lowercased');
  assert(account.roleKey === 'content_ops', 'role assigned');

  const actor = resolveAdminActor({ username: 'contentuser', password: 'secret12' });
  assert(actor, 'custom account login works');
  assert(actor!.role === 'content_ops', 'custom role in session');
  assert(actorHasPermission(actor!, 'platform.write'), 'DB permissions honored');
  assert(!actorHasPermission(actor!, 'hr.write'), 'missing permission denied');

  const envAdmin = resolveAdminActor({ password: 'super-admin-bootstrap' });
  assert(envAdmin?.role === 'admin', 'ADMIN_PASSWORD bootstrap');
  assert(actorHasPermission(envAdmin!, 'admin.full'), 'bootstrap has full access');

  updateAdminAccount(account.id, { isActive: false });
  assert(
    resolveAdminActor({ username: 'contentuser', password: 'secret12' }) === null,
    'inactive account blocked'
  );
  updateAdminAccount(account.id, { isActive: true, password: 'newpass99' });
  assert(
    resolveAdminActor({ username: 'contentuser', password: 'newpass99' })?.role === 'content_ops',
    'password update works'
  );

  // Soft-deactivate when accounts still reference the role
  deleteAdminRole(custom.id);
  const deactivated = listAdminRoles({ includeInactive: true }).find((r) => r.key === 'content_ops');
  assert(deactivated && !deactivated.isActive, 'role soft-deactivated when in use');

  deleteAdminAccount(account.id);
  assert(!listAdminAccounts().some((a) => a.id === account.id), 'account deleted');
  deleteAdminRole(custom.id);
  assert(
    !listAdminRoles({ includeInactive: true }).some((r) => r.key === 'content_ops'),
    'unused inactive role hard-deleted'
  );

  let blocked = false;
  try {
    deleteAdminRole(listAdminRoles().find((r) => r.key === 'admin')!.id);
  } catch {
    blocked = true;
  }
  assert(blocked, 'system admin role cannot be deleted');

  console.log('hr-rbac.selftest: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
