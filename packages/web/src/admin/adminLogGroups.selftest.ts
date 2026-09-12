/**
 * Consecutive log grouping for admin «لاگ خطاها».
 * Run: npx tsx packages/web/src/admin/adminLogGroups.selftest.ts
 */
import assert from 'node:assert/strict';
import { adminLogFingerprint, groupConsecutiveLogs } from './adminLogGroups.ts';

const a = {
  id: 3,
  level: 'warn',
  source: 'api',
  message: 'materialize telegram avatar failed: INVALID_IMAGE',
  path: null as string | null,
  method: null as string | null,
  statusCode: null as number | null,
};
const b = { ...a, id: 2 };
const c = { ...a, id: 1 };
const other = {
  id: 0,
  level: 'warn',
  source: 'api',
  message: 'HTTP 400 POST /api/consultations/quick-connect',
  path: '/api/consultations/quick-connect',
  method: 'POST',
  statusCode: 400,
};

assert.equal(adminLogFingerprint(a), adminLogFingerprint(b));
assert.notEqual(adminLogFingerprint(a), adminLogFingerprint(other));

const grouped = groupConsecutiveLogs([a, b, c, other]);
assert.equal(grouped.length, 2);
assert.equal(grouped[0]!.count, 3);
assert.equal(grouped[0]!.latest.id, 3);
assert.equal(grouped[0]!.oldest.id, 1);
assert.equal(grouped[1]!.count, 1);
assert.equal(grouped[1]!.latest.id, 0);

const split = groupConsecutiveLogs([a, other, b]);
assert.equal(split.length, 3, 'non-adjacent duplicates stay separate');

console.log('adminLogGroups.selftest: ok');
