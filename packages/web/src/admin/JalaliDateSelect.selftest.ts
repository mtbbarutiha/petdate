/**
 * Jalali admin date helpers — conversion + display boundary.
 * Run: npx tsx packages/web/src/admin/JalaliDateSelect.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  currentJalaliParts,
  formatAdminFaDate,
  formatJalaliNumFa,
  formatJalaliSlash,
  gregorianIsoToJalaliParts,
  jalaliDaysAgo,
  jalaliPartsAndTimeToIso,
  jalaliPartsToGregorianIso,
  jalaliToGregorianYmd,
  parseJalaliSlash,
} from './jalaliDate.ts';

const now = currentJalaliParts();
assert.ok(now.year >= 1400 && now.year <= 1500);
assert.ok(now.month >= 1 && now.month <= 12);
assert.ok(now.day >= 1 && now.day <= 31);

// Years must never get thousands separators (۱,۴۰۵)
const yearFa = formatJalaliNumFa(1405);
assert.equal(yearFa, '۱۴۰۵');
assert.ok(!/[,\u066C\u060C\u2009\u202F]/.test(yearFa));

const g = jalaliToGregorianYmd(1403, 1, 1);
assert.equal(g.gy, 2024);
assert.equal(g.gm, 3);
assert.equal(g.gd, 20);

const iso = jalaliPartsToGregorianIso({ year: 1403, month: 1, day: 1 });
assert.equal(iso, '2024-03-20');

const back = gregorianIsoToJalaliParts('2024-03-20');
assert.deepEqual(back, { year: 1403, month: 1, day: 1 });

assert.equal(formatJalaliSlash({ year: 1403, month: 1, day: 5 }), '1403/01/05');
assert.deepEqual(parseJalaliSlash('1403/1/5'), { year: 1403, month: 1, day: 5 });
assert.equal(parseJalaliSlash('bad'), null);

const withTime = jalaliPartsAndTimeToIso({ year: 1403, month: 1, day: 1 }, '09:30');
assert.equal(withTime, '2024-03-20T09:30');

const ago = jalaliDaysAgo(0);
assert.deepEqual(ago, now);

const jalaliDisplay = formatAdminFaDate('1403/01/01');
assert.match(jalaliDisplay, /۱۴۰۳|1403/);

const gregDisplay = formatAdminFaDate('2024-03-20');
assert.ok(gregDisplay && gregDisplay !== '—');
assert.notEqual(gregDisplay, '2024-03-20');

console.log('JalaliDateSelect.selftest: ok');
