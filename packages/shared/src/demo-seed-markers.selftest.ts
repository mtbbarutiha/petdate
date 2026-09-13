/**
 * Demo-seed marker detection — only known ids/emails/mobiles, never names.
 * Run: npx tsx packages/shared/src/demo-seed-markers.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  filterDemoSeedRows,
  isDemoSeedRecord,
  isDemoSeedText,
  partitionDemoSeedRows,
} from './demo-seed-markers.ts';

assert.equal(isDemoSeedText('SEED-HR-01'), true, 'personnel marker');
assert.equal(isDemoSeedText('SEED-HR-07'), true, 'personnel marker 07');
assert.equal(isDemoSeedText('09120006001'), true, 'CRM seed mobile');
assert.equal(isDemoSeedText('09120006088'), true, 'CRM seed mobile 088');
assert.equal(isDemoSeedText('09120001001'), true, 'ATS seed mobile');
assert.equal(isDemoSeedText('0912SEED200'), true, 'sales seed mobile');
assert.equal(isDemoSeedText('seed-hr-01@petdate.ir'), true, 'org email');
assert.equal(isDemoSeedText('لیدا@seed.petdate.ir'), true, 'seed domain');
assert.equal(isDemoSeedText('seed.sales.agent'), true, 'panel username');
assert.equal(isDemoSeedText('ثبت نمونه SEED'), true, 'timesheet note');
assert.equal(isDemoSeedText('دادهٔ نمونه SEED'), true, 'ATS note');

assert.equal(isDemoSeedText(''), false, 'empty');
assert.equal(isDemoSeedText(undefined), false, 'undefined');
assert.equal(isDemoSeedText('نیما فروشنده'), false, 'name alone is not a marker');
assert.equal(isDemoSeedText('09121234567'), false, 'ordinary mobile');
assert.equal(isDemoSeedText('admin'), false, 'real admin username');
assert.equal(isDemoSeedText('hr@petdate.ir'), false, 'ordinary org email');

assert.equal(isDemoSeedRecord({ personnelCode: 'SEED-HR-01', firstName: 'نیما' }), true);
assert.equal(isDemoSeedRecord({ mobile: '09120006001', first: 'سارا' }), true);
assert.equal(isDemoSeedRecord({ username: 'seed.sales.lead' }), true);
assert.equal(isDemoSeedRecord({ firstName: 'نیما', lastName: 'فروشنده', mobile: '09121234567' }), false);

const rows = [
  { personnelCode: 'SEED-HR-01' },
  { personnelCode: 'PD-100' },
];
const { live, seed } = partitionDemoSeedRows(rows);
assert.equal(live.length, 1);
assert.equal(seed.length, 1);
assert.equal(filterDemoSeedRows(rows, false).length, 1);
assert.equal(filterDemoSeedRows(rows, true).length, 2);

console.log('demo-seed-markers.selftest: ok');
