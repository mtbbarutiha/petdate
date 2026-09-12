/**
 * Fan-out reject notify gate — hide per-recipient rejects when count > 1.
 * Run: npx tsx src/fanout-reject.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  consultRejectedNotifyText,
  countFanoutSiblingsByCreatedAt,
  playdateRejectedNotifyText,
  shouldNotifyRequesterOnReject,
} from './fanout-reject';

assert.equal(shouldNotifyRequesterOnReject(1), true, 'single recipient still notifies');
assert.equal(shouldNotifyRequesterOnReject(0), true, 'unknown/zero still notifies');
assert.equal(shouldNotifyRequesterOnReject(NaN), true, 'NaN still notifies');
assert.equal(shouldNotifyRequesterOnReject(2), false, 'two recipients: hide');
assert.equal(shouldNotifyRequesterOnReject(100), false, 'broadcast: hide');

const t0 = '2026-09-12 13:00:00';
const sameWave = [
  '2026-09-12 13:00:00',
  '2026-09-12 13:00:01',
  '2026-09-12 13:00:02',
];
assert.equal(countFanoutSiblingsByCreatedAt(t0, sameWave), 3, 'same-second wave counts 3');

const mixed = [...sameWave, '2026-09-12 13:10:00'];
assert.equal(
  countFanoutSiblingsByCreatedAt(t0, mixed),
  3,
  'later request is a different wave'
);

assert.match(playdateRejectedNotifyText(), /رد شد/, 'playdate reject copy');
assert.match(consultRejectedNotifyText('vet'), /دامپزشک/, 'vet reject copy');
assert.match(consultRejectedNotifyText('trainer'), /مربی/, 'trainer reject copy');
assert.match(consultRejectedNotifyText('seeker_advice'), /صاحب پت/, 'seeker reject copy');

console.log('fanout-reject.selftest: ok');
