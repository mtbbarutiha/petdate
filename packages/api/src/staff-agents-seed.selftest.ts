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
  assert(sanaz?.role === 'veterinarian', 'sanaz login');
  assert(actorHasPermission(sanaz!, 'content.write'), 'vet can edit magazine medical');
  assert(actorHasPermission(sanaz!, 'platform.read'), 'vet can see consults');
  assert(!actorHasPermission(sanaz!, 'admin.full'), 'vet is not full admin');
  assert(!actorHasPermission(sanaz!, 'finance.write'), 'vet has no finance write');
  assert(!actorHasPermission(sanaz!, 'hr.write'), 'vet has no HR write');

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
    resolveAdminActor({ username: 'sanaz', password: 'staff-temp-12' })?.role === 'veterinarian',
    're-seed must not overwrite password'
  );
  assert(
    resolveAdminActor({ username: 'sanaz', password: 'changed-must-not-apply' }) === null,
    'new env password must not replace existing hash'
  );

  assert(TEAM_AGENTS.length === 5, 'five public personas');
  const users = ensureAllTeamAgents();
  assert(users.length === 5, 'five team-agent users');
  const sanazUser = ensureTeamAgentBySlug('sanaz-ghaffari')!;
  assert(sanazUser.telegramId === 'petdate_ai_sanaz_ghaffari', 'sanaz telegram id unchanged');
  assert(sanazUser.name === 'دکتر ساناز غفاری', 'sanaz display name');
  assert(sanazUser.username === 'agent_sanaz_ghaffari', 'sanaz chat username');
  const yaldaUser = ensureTeamAgentBySlug('yalda-shabani')!;
  assert(yaldaUser.telegramId === 'petdate_ai_yalda_shabani', 'yalda telegram id unchanged');
  assert(staffAgentsForTeamSlug('yalda-shabani')?.username === 'yalda', 'yalda staff username');
  assert(yaldaUser.username !== 'yalda', 'panel login must not replace agent_* chat username');

  console.log('staff-agents-seed.selftest: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
