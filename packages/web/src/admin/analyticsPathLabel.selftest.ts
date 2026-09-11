/**
 * Path label display helpers for صفحات پربازدید.
 * Run: npx tsx packages/web/src/admin/analyticsPathLabel.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  formatAnalyticsPathLabel,
  mapPathBars,
  shortenAnalyticsPathLabel,
} from './analyticsPathLabel.ts';

assert.equal(formatAnalyticsPathLabel('/profile|'), '/profile', 'strip trailing pipe');
assert.equal(formatAnalyticsPathLabel('/profile|||'), '/profile', 'strip many pipes');
assert.equal(formatAnalyticsPathLabel('/shop?x=1'), '/shop', 'strip query');
assert.equal(formatAnalyticsPathLabel('wallet'), '/wallet', 'leading slash');
assert.equal(formatAnalyticsPathLabel(''), '(خالی)', 'empty');
assert.equal(formatAnalyticsPathLabel(undefined), '(خالی)', 'undefined');
assert.equal(formatAnalyticsPathLabel('undefined'), '(خالی)', 'undefined string');
assert.equal(formatAnalyticsPathLabel('|'), '(خالی)', 'pipe only');
assert.equal(formatAnalyticsPathLabel('/'), '/', 'home');
assert.equal(formatAnalyticsPathLabel('//faq//'), '/faq', 'collapse slashes + trim trailing');

assert.equal(shortenAnalyticsPathLabel('/faq'), '/faq');
assert.ok(shortenAnalyticsPathLabel('/a'.repeat(40), 20).endsWith('…'));

const bars = mapPathBars([
  { label: '/profile|', value: 3 },
  { label: '/profile', value: 5 },
  { label: '|', value: 1 },
  { label: '/shop', value: 2 },
]);
assert.equal(bars.find((b) => b.fullLabel === '/profile')?.value, 8, 'merge profile variants');
assert.equal(bars.find((b) => b.fullLabel === '(خالی)')?.value, 1, 'junk → خالی');
assert.equal(bars[0].fullLabel, '/profile', 'sorted by value');

console.log('analyticsPathLabel.selftest: ok');
