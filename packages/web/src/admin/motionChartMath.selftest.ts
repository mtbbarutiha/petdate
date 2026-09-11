/**
 * Motion chart math selftest.
 * Run: npx tsx packages/web/src/admin/motionChartMath.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  clampPct,
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

console.log('motionChartMath.selftest: ok');
