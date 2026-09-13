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
    listAdminAccounts,
    listAdminRoles,
    resolveAdminActor,
  } = await import('./hr-service');
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
  for (const agent of STAFF_AGENTS) {
    const row = accounts.find((a) => a.username === agent.username);
    assert(row, `account ${agent.username} missing`);
    assert(row!.roleKey === agent.roleKey, `${agent.username} role ${row!.roleKey}`);
    assert(row!.displayName === agent.displayName, `${agent.username} display name`);
    assert(row!.isActive, `${agent.username} active`);
  }

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
