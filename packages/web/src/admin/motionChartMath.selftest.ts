/**
 * Motion chart math selftest.
 * Run: npx tsx packages/web/src/admin/motionChartMath.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  buildDonutSlices,
  clampPct,
  donutSliceTotal,
  finiteNonNeg,
  hexToRgba,
  smoothAreaPath,
  smoothLinePath,
} from './motionChartMath.ts';

assert.equal(smoothLinePath([]), '');
assert.equal(smoothLinePath([{ x: 1, y: 2 }]), 'M1,2');
assert.ok(smoothLinePath([{ x: 0, y: 0 }, { x: 10, y: 10 }]).startsWith('M0,0 L'));

const three = smoothLinePath([
  { x: 0, y: 10 },
  { x: 5, y: 0 },
  { x: 10, y: 8 },
]);
assert.ok(three.includes('C'), 'smooth path should use cubic curves');
assert.ok(three.startsWith('M0,10'));

const area = smoothAreaPath(
  [
    { x: 0, y: 2 },
    { x: 5, y: 1 },
    { x: 10, y: 3 },
  ],
  20
);
assert.ok(area.endsWith('Z'));
assert.ok(area.includes('L10,20'));
assert.ok(area.includes('L0,20'));

assert.equal(clampPct(-5), 0);
assert.equal(clampPct(150), 100);
assert.equal(clampPct(42.2), 42.2);
assert.equal(clampPct(Number.NaN), 0);

assert.equal(hexToRgba('#15cca0', 0.5), 'rgba(21, 204, 160, 0.5)');
assert.equal(hexToRgba('#abc', 1), 'rgba(170, 187, 204, 1)');

assert.equal(finiteNonNeg(Number.NaN), 0);
assert.equal(finiteNonNeg(-4), 0);
assert.equal(finiteNonNeg('3'), 3);
assert.equal(finiteNonNeg(Infinity), 0);
assert.equal(donutSliceTotal([{ value: 6 }, { value: 1 }, { value: Number.NaN }, { value: 1 }]), 8);

const empty = buildDonutSlices([
  { label: 'zero', value: 0, color: '#000' },
  { label: 'nan', value: Number.NaN, color: '#111' },
]);
assert.equal(empty.length, 0, 'zero/NaN slices are dropped');

const mixed = buildDonutSlices([
  { key: 'in_progress', label: 'در حال بررسی', value: 6, color: '#0ba5f2' },
  { key: 'unassigned', label: 'تخصیص‌نیافته', value: 1, color: '#5c4d91' },
  { key: 'breached', label: 'نقض SLA', value: 0, color: '#c62828' },
  { key: 'resolved', label: 'حل‌شده (۷روز)', value: 1, color: '#15cca0' },
]);
assert.equal(mixed.length, 3, 'zero SLA flag is not a slice');
assert.equal(mixed.reduce((s, x) => s + x.sweepDeg, 0), 360);
assert.ok(Math.abs(mixed[0]!.portion - 6 / 8) < 1e-9);
assert.ok(Math.abs(mixed[1]!.portion - 1 / 8) < 1e-9);
assert.ok(Math.abs(mixed[2]!.portion - 1 / 8) < 1e-9);
assert.ok(mixed.every((s) => Number.isFinite(s.startDeg) && Number.isFinite(s.sweepDeg)));
assert.ok(!mixed.some((s) => s.key === 'breached'));

console.log('motionChartMath.selftest: ok');
