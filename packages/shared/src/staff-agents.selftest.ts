/**
 * Staff/Grok agent roster stays linked to the four public chat personas.
 * Run: npx tsx packages/shared/src/staff-agents.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  ADMIN_PERMISSION_LABELS,
  ADMIN_PANEL_ROLE_LABELS,
  DEFAULT_DEV_STAFF_PASSWORD,
  STAFF_AGENTS,
  STAFF_ROLE_DEFS,
  STAFF_ROLE_KEYS,
  STAFF_ROLE_PERMISSIONS,
  TEAM_AGENTS,
  assertStaffAgentsLinkedToTeamChat,
  resolveStaffSeedPassword,
  staffAgentsForTeamSlug,
} from './index';

assert.equal(STAFF_ROLE_KEYS.length, 8);
assert.equal(STAFF_ROLE_DEFS.length, 8);
assert.equal(STAFF_AGENTS.length, 9);
assert.equal(STAFF_AGENTS.filter((a) => a.teamAgentSlug).length, 4);
assert.equal(TEAM_AGENTS.length, 4);

assertStaffAgentsLinkedToTeamChat();

for (const agent of TEAM_AGENTS) {
  assert.equal(agent.staffUsername, staffAgentsForTeamSlug(agent.slug)?.username);
  assert.ok(agent.telegramId.startsWith('petdate_ai_'), `${agent.slug} keeps synthetic telegram id`);
}

assert.equal(staffAgentsForTeamSlug('sanaz-ghaffari')?.username, 'sanaz');
assert.equal(staffAgentsForTeamSlug('sanaz-ghaffari')?.roleKey, 'support');
assert.equal(staffAgentsForTeamSlug('yalda-shabani'), undefined, 'yalda is ops-only staff, not a public team slug');
assert.equal(staffAgentsForTeamSlug('faranak-ahmadi')?.roleKey, 'trainer');
assert.equal(staffAgentsForTeamSlug('leila-kiani')?.roleKey, 'finance');
assert.equal(staffAgentsForTeamSlug('sara-noori')?.displayName, 'سارا نوری');

const OPS_AVATARS: Record<string, string> = {
  'staff.designer': '/agents/staff-designer.jpg',
  'staff.social': '/agents/staff-social.jpg',
  'staff.shop': '/agents/staff-shop.jpg',
  'staff.content': '/agents/staff-content.jpg',
};
for (const agent of STAFF_AGENTS) {
  assert.ok(agent.avatarUrl, `${agent.username} avatarUrl`);
  assert.match(agent.avatarUrl, /^\/agents\/[a-z0-9-]+\.jpg$/, `${agent.username} site avatar path`);
  assert.ok(agent.displayName, `${agent.username} displayName`);
  assert.ok(agent.firstName && agent.lastName, `${agent.username} first/last`);
  assert.ok(agent.personnelCode.startsWith('STAFF-'), `${agent.username} personnel code`);
  assert.ok(agent.jobTitle && agent.department && agent.orgEmail, `${agent.username} job fields`);
}
for (const [username, url] of Object.entries(OPS_AVATARS)) {
  const row = STAFF_AGENTS.find((a) => a.username === username);
  assert.equal(row?.avatarUrl, url, `${username} ops avatar`);
  assert.equal(row?.teamAgentSlug, undefined, `${username} is ops-only`);
}

assert.ok(STAFF_ROLE_PERMISSIONS.veterinarian.includes('content.write'));
assert.ok(!STAFF_ROLE_PERMISSIONS.veterinarian.includes('admin.full'));
assert.ok(!STAFF_ROLE_PERMISSIONS.veterinarian.includes('finance.write'));
assert.ok(STAFF_ROLE_PERMISSIONS.shop_procurement.includes('shop.write'));
assert.ok(!STAFF_ROLE_PERMISSIONS.shop_procurement.includes('platform.write'));
assert.ok(STAFF_ROLE_PERMISSIONS.content_editor.includes('content.create'));
assert.ok(!STAFF_ROLE_PERMISSIONS.designer.includes('platform.write'));
assert.ok(STAFF_ROLE_PERMISSIONS.support.includes('support.inbox'));

for (const key of STAFF_ROLE_KEYS) {
  assert.ok(ADMIN_PANEL_ROLE_LABELS[key], `missing role label ${key}`);
}
for (const perm of ['content.read', 'content.write', 'content.create'] as const) {
  assert.ok(ADMIN_PERMISSION_LABELS[perm], `missing permission label ${perm}`);
}

assert.equal(resolveStaffSeedPassword({ NODE_ENV: 'development' }), DEFAULT_DEV_STAFF_PASSWORD);
assert.equal(resolveStaffSeedPassword({ NODE_ENV: 'production' }), null);
assert.equal(
  resolveStaffSeedPassword({ NODE_ENV: 'production', ADMIN_STAFF_PASSWORD: 'from-env-ok' }),
  'from-env-ok'
);
assert.equal(
  resolveStaffSeedPassword({ NODE_ENV: 'production', ADMIN_SEED_PASSWORD: 'seed-ok' }),
  'seed-ok'
);

assert.equal(DEFAULT_DEV_STAFF_PASSWORD, 'petdate-seed');

console.log('staff-agents.selftest: ok');
