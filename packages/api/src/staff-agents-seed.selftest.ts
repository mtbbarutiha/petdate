/**
 * Staff roles + accounts seed is idempotent and does not break team-chat personas.
 * Run: cd packages/api && npx tsx src/staff-agents-seed.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-staff-agents-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.ADMIN_SUPPORT_PASSWORD = '';
process.env.ADMIN_STAFF_PASSWORD = 'staff-temp-12';
process.env.ADMIN_SEED_PASSWORD = '';
process.env.NODE_ENV = 'test';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const {
    actorHasPermission,
    ensureHrSchema,
    getEmployee,
    listAdminAccounts,
    listAdminRoles,
    listEmployees,
    getEmployeePlainPassword,
    resolveAdminActor,
  } = await import('./hr-service');
  const { getDb } = await import('./db');
  const { TEAM_AGENTS, STAFF_AGENTS, staffAgentsForTeamSlug } = await import('@petdate/shared');
  const { ensureAllTeamAgents, ensureTeamAgentBySlug } = await import('./services/team-agents');

  ensureHrSchema();
  ensureHrSchema(); // idempotent

  const roles = listAdminRoles({ includeInactive: true });
  for (const key of [
    'veterinarian',
    'support',
    'trainer',
    'finance',
    'designer',
    'social',
    'shop_procurement',
    'content_editor',
  ]) {
    assert(roles.some((r) => r.key === key && r.isActive), `role ${key} seeded`);
  }

  const accounts = listAdminAccounts({ includeInactive: true });
  const { employees } = listEmployees({ limit: 500 });
  for (const agent of STAFF_AGENTS) {
    const row = accounts.find((a) => a.username === agent.username);
    assert(row, `account ${agent.username} missing`);
    assert(row!.roleKey === agent.roleKey, `${agent.username} role ${row!.roleKey}`);
    assert(row!.displayName === agent.displayName, `${agent.username} display name`);
    assert(row!.isActive, `${agent.username} active`);
    assert(row!.avatarUrl === agent.avatarUrl, `${agent.username} account avatar`);

    const emp = employees.find((e) => e.personnelCode === agent.personnelCode);
    assert(emp, `HR employee ${agent.personnelCode} missing`);
    assert(emp!.username === agent.username, `${agent.username} HR username`);
    assert(emp!.firstName === agent.firstName, `${agent.username} first`);
    assert(emp!.lastName === agent.lastName, `${agent.username} last`);
    assert(emp!.jobTitle === agent.jobTitle, `${agent.username} job`);
    assert(emp!.department === agent.department, `${agent.username} department`);
    assert(emp!.orgEmail === agent.orgEmail, `${agent.username} org email`);
    assert(emp!.avatarUrl === agent.avatarUrl, `${agent.username} HR avatar`);
    assert(!String(emp!.nationalId || '').trim(), `${agent.username} must not invent national id`);
    assert(!String(emp!.mobile || '').trim(), `${agent.username} must not invent phone`);
    assert(emp!.incomeModelId == null, `${agent.username} must not invent salary model`);
  }

  const designerEmp = employees.find((e) => e.personnelCode === 'STAFF-DESIGNER')!;
  getDb()
    .prepare(`UPDATE hr_employees SET avatar_url = '', first_name = '' WHERE id = ?`)
    .run(designerEmp.id);
  getDb()
    .prepare(`UPDATE admin_accounts SET display_name = 'old-label' WHERE username = 'staff.designer'`)
    .run();
  ensureHrSchema();
  const designerAfter = getEmployee(designerEmp.id)!;
  assert(designerAfter.avatarUrl === '/agents/staff-designer.jpg', 're-seed fills ops avatar');
  assert(designerAfter.firstName === 'گرافیست', 're-seed fills first name');
  assert(designerAfter.username === 'staff.designer', 're-seed keeps username');
  assert(!String(designerAfter.nationalId || '').trim(), 're-seed still no national id');
  assert(!String(designerAfter.mobile || '').trim(), 're-seed still no phone');
  const designerAcct = listAdminAccounts({ includeInactive: true }).find(
    (a) => a.username === 'staff.designer'
  );
  assert(designerAcct?.displayName === 'گرافیست', 're-seed restores display name');
  assert(designerAcct?.roleKey === 'designer', 're-seed keeps role');

  const sanaz = resolveAdminActor({ username: 'sanaz', password: 'staff-temp-12' });
  assert(sanaz?.role === 'support', 'sanaz login is support not vet');
  assert(actorHasPermission(sanaz!, 'support.inbox'), 'sanaz inbox');
  assert(!actorHasPermission(sanaz!, 'admin.full'), 'sanaz is not full admin');
  assert(!actorHasPermission(sanaz!, 'hr.write'), 'sanaz has no HR write');

  const sara = resolveAdminActor({ username: 'sara', password: 'staff-temp-12' });
  assert(sara?.role === 'veterinarian', 'sara login');
  assert(actorHasPermission(sara!, 'content.write'), 'vet can edit magazine medical');
  assert(actorHasPermission(sara!, 'platform.read'), 'vet can see consults');
  assert(!actorHasPermission(sara!, 'finance.write'), 'vet has no finance write');

  const leila = resolveAdminActor({ username: 'leila', password: 'staff-temp-12' });
  assert(leila?.role === 'finance', 'leila login is finance not trainer');
  assert(actorHasPermission(leila!, 'finance.write'), 'leila finance write');
  assert(actorHasPermission(leila!, 'finance.read'), 'leila finance read');
  assert(actorHasPermission(leila!, 'shop.read'), 'leila shop read from staff roster');
  assert(!actorHasPermission(leila!, 'admin.full'), 'leila is not full admin');
  assert(!actorHasPermission(leila!, 'hr.write'), 'leila has no HR write');

  // Stale account: leila created before finance existed (wrong role / inactive).
  // Re-seed must repair role_key + isActive and merge finance.* onto admin_roles
  // without touching the password hash.
  getDb()
    .prepare(`UPDATE admin_accounts SET role_key = 'trainer', is_active = 0 WHERE username = 'leila'`)
    .run();
  getDb()
    .prepare(`UPDATE admin_roles SET permissions_json = ? WHERE key = 'finance'`)
    .run(JSON.stringify(['shop.read']));
  ensureHrSchema();
  const leilaRepaired = listAdminAccounts({ includeInactive: true }).find((a) => a.username === 'leila');
  assert(leilaRepaired?.roleKey === 'finance', 're-seed repairs leila.role_key to finance');
  assert(leilaRepaired?.isActive, 're-seed re-activates leila');
  const financeRole = listAdminRoles({ includeInactive: true }).find((r) => r.key === 'finance');
  assert(financeRole?.permissions.includes('finance.read'), 'mergeStaffRolePerms restores finance.read');
  assert(financeRole?.permissions.includes('finance.write'), 'mergeStaffRolePerms restores finance.write');
  const leilaAfterRepair = resolveAdminActor({ username: 'leila', password: 'staff-temp-12' });
  assert(leilaAfterRepair?.role === 'finance', 'leila login after role repair is finance');
  assert(actorHasPermission(leilaAfterRepair!, 'finance.write'), 're-seed leila gets finance.write');
  assert(actorHasPermission(leilaAfterRepair!, 'finance.read'), 're-seed leila gets finance.read');
  assert(
    resolveAdminActor({ username: 'leila', password: 'changed-must-not-apply' }) === null,
    'role repair must not overwrite password hash'
  );

  const yalda = resolveAdminActor({ username: 'yalda', password: 'staff-temp-12' });
  assert(yalda?.role === 'support', 'yalda login');
  assert(actorHasPermission(yalda!, 'support.inbox'), 'yalda inbox');
  assert(actorHasPermission(yalda!, 'crm.write'), 'yalda can send SMS / tickets');

  const shop = resolveAdminActor({ username: 'staff.shop', password: 'staff-temp-12' });
  assert(shop?.role === 'shop_procurement', 'shop login');
  assert(actorHasPermission(shop!, 'shop.write'), 'shop can edit catalog');
  assert(!actorHasPermission(shop!, 'platform.write'), 'shop is not platform admin');

  const designer = resolveAdminActor({ username: 'staff.designer', password: 'staff-temp-12' });
  assert(actorHasPermission(designer!, 'content.write'), 'designer media');
  assert(!actorHasPermission(designer!, 'shop.write'), 'designer no shop write');

  process.env.ADMIN_STAFF_PASSWORD = 'changed-must-not-apply';
  ensureHrSchema();
  assert(
    resolveAdminActor({ username: 'sanaz', password: 'staff-temp-12' })?.role === 'support',
    're-seed must not overwrite password'
  );
  assert(
    resolveAdminActor({ username: 'sanaz', password: 'changed-must-not-apply' }) === null,
    'new env password must not replace existing hash'
  );

  // Missing admin_accounts row + empty env password: recover HR plain password.
  const leilaEmp = listEmployees({ limit: 500 }).employees.find((e) => e.personnelCode === 'STAFF-LEILA')!;
  getDb().prepare(`DELETE FROM admin_accounts WHERE username = 'leila'`).run();
  getDb().prepare(`UPDATE hr_employees SET password = 'recovered-ok' WHERE id = ?`).run(leilaEmp.id);
  const prevStaffPwd = process.env.ADMIN_STAFF_PASSWORD;
  const prevSeedPwd = process.env.ADMIN_SEED_PASSWORD;
  const prevNodeEnv = process.env.NODE_ENV;
  process.env.ADMIN_STAFF_PASSWORD = '';
  process.env.ADMIN_SEED_PASSWORD = '';
  process.env.NODE_ENV = 'production';
  ensureHrSchema();
  process.env.ADMIN_STAFF_PASSWORD = prevStaffPwd;
  process.env.ADMIN_SEED_PASSWORD = prevSeedPwd;
  process.env.NODE_ENV = prevNodeEnv;
  const leilaRecovered = listAdminAccounts({ includeInactive: true }).find((a) => a.username === 'leila');
  assert(leilaRecovered, 're-seed creates missing leila account from HR plain password');
  assert(leilaRecovered!.roleKey === 'finance', 'recovered leila account is finance');
  const leilaFromHr = resolveAdminActor({ username: 'leila', password: 'recovered-ok' });
  assert(leilaFromHr?.role === 'finance', 'leila logs in with recovered HR password');
  assert(actorHasPermission(leilaFromHr!, 'finance.write'), 'recovered leila has finance.write');

  // Missing account + empty HR password: generate once via resetEmployeePassword.
  getDb().prepare(`DELETE FROM admin_accounts WHERE username = 'leila'`).run();
  getDb().prepare(`UPDATE hr_employees SET password = '' WHERE id = ?`).run(leilaEmp.id);
  process.env.ADMIN_STAFF_PASSWORD = '';
  process.env.ADMIN_SEED_PASSWORD = '';
  process.env.NODE_ENV = 'production';
  ensureHrSchema();
  process.env.ADMIN_STAFF_PASSWORD = prevStaffPwd;
  process.env.ADMIN_SEED_PASSWORD = prevSeedPwd;
  process.env.NODE_ENV = prevNodeEnv;
  const leilaGenerated = listAdminAccounts({ includeInactive: true }).find((a) => a.username === 'leila');
  assert(leilaGenerated, 're-seed creates missing leila account via HR reset path');
  assert(leilaGenerated!.roleKey === 'finance', 'generated leila account is finance');
  const generatedPlain = getEmployeePlainPassword(leilaEmp.id);
  assert(generatedPlain.length >= 6, 'HR reset path stored a usable plain password');
  const leilaFromGenerated = resolveAdminActor({ username: 'leila', password: generatedPlain });
  assert(leilaFromGenerated?.role === 'finance', 'leila logs in with generated HR password');
  assert(actorHasPermission(leilaFromGenerated!, 'finance.write'), 'generated leila has finance.write');

  assert(TEAM_AGENTS.length === 4, 'four public personas');
  const users = ensureAllTeamAgents();
  assert(users.length === 4, 'four team-agent users');
  const sanazUser = ensureTeamAgentBySlug('sanaz-ghaffari')!;
  assert(sanazUser.telegramId === 'petdate_ai_sanaz_ghaffari', 'sanaz telegram id unchanged');
  assert(sanazUser.name === 'ساناز غفاری', 'sanaz display name');
  assert(sanazUser.username === 'agent_sanaz_ghaffari', 'sanaz chat username');
  const yaldaAlias = ensureTeamAgentBySlug('yalda-shabani')!;
  assert(yaldaAlias.id === sanazUser.id, 'yalda slug aliases to Sanaz synthetic user');
  assert(staffAgentsForTeamSlug('yalda-shabani') == null, 'yalda is ops-only staff');
  assert(yaldaAlias.username !== 'yalda', 'panel login must not replace agent_* chat username');

  console.log('staff-agents-seed.selftest: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
