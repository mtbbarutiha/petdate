/**
 * Role sanitization — pet_seeker («دنبال پت») → no_pet migration.
 * Run: cd packages/shared && npx tsx src/sanitize-roles.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  REMOVED_USER_ROLES,
  USER_ROLES,
  normalizeRoles,
  primaryRole,
  sanitizeRoleList,
} from './petdate';

assert.ok(!USER_ROLES.includes('pet_seeker' as never), 'pet_seeker not selectable');
assert.ok(REMOVED_USER_ROLES.includes('pet_seeker'), 'pet_seeker in REMOVED_USER_ROLES');

assert.deepEqual(sanitizeRoleList(['pet_seeker']), ['no_pet'], 'seeker alone → no_pet');
assert.deepEqual(
  sanitizeRoleList([], 'pet_seeker'),
  ['no_pet'],
  'seeker fallback column → no_pet'
);
assert.deepEqual(
  sanitizeRoleList(['pet_seeker', 'pet_owner']),
  ['pet_owner'],
  'seeker dropped when other roles remain'
);
assert.deepEqual(
  sanitizeRoleList(['pet_seeker', 'no_pet']),
  ['no_pet'],
  'seeker + no_pet → no_pet'
);
assert.deepEqual(sanitizeRoleList(['pet_sitter']), ['pet_owner'], 'sitter alone → pet_owner');
assert.deepEqual(
  sanitizeRoleList(['community_seeker']),
  ['pet_owner'],
  'community alone → pet_owner'
);

assert.deepEqual(normalizeRoles(['pet_seeker' as never]), ['no_pet']);
assert.equal(primaryRole(['pet_seeker' as never], 'pet_seeker' as never), 'no_pet');

assert.deepEqual(
  sanitizeRoleList(['pet_owner', 'vet', 'trainer']),
  ['pet_owner', 'vet', 'trainer'],
  'live roles unchanged'
);

console.log('sanitize-roles.selftest: ok');
