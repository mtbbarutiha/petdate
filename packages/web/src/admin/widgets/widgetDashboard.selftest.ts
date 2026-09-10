/**
 * Admin widget dashboard — layout + time/category drill helpers.
 * Run: npx tsx packages/web/src/admin/widgets/widgetDashboard.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  aggregateByGrain,
  canDrillDown,
  canDrillUp,
  categoryDrillDetail,
  detectTimeGrain,
  drillDownGrain,
  drillUpGrain,
} from './drill.ts';
import {
  normalizeBoard,
  reorderItems,
  storageKeyFor,
} from './layoutStorage.ts';
import type { WidgetCatalogItem } from './types.ts';

const days = [
  { label: '2026-09-01', value: 2 },
  { label: '2026-09-02', value: 3 },
  { label: '2026-09-03', value: 1 },
  { label: '2026-09-08', value: 4 },
  { label: '2026-09-09', value: 5 },
  { label: '2026-10-01', value: 7 },
];

assert.equal(detectTimeGrain(days), 'day');

const weeks = aggregateByGrain(days, 'week', 'day');
assert.ok(weeks.length >= 2);
assert.equal(
  weeks.reduce((a, p) => a + p.value, 0),
  days.reduce((a, p) => a + p.value, 0)
);

const months = aggregateByGrain(days, 'month', 'day');
assert.equal(months.length, 2);
assert.equal(months.find((m) => m.label === '2026-09')?.value, 15);
assert.equal(months.find((m) => m.label === '2026-10')?.value, 7);

assert.equal(canDrillUp('day'), true);
assert.equal(canDrillUp('month'), false);
assert.equal(canDrillDown('month', 'day'), true);
assert.equal(canDrillDown('day', 'day'), false);
assert.equal(drillUpGrain('day'), 'week');
assert.equal(drillDownGrain('month', 'day'), 'week');

const cats = [
  { label: 'CRM', value: 10 },
  { label: 'فروش', value: 4 },
];
const drilled = categoryDrillDetail(cats, 'CRM');
assert.equal(drilled.detail?.value, 10);
assert.equal(drilled.view.length, 1);
assert.equal(categoryDrillDetail(cats, null).view.length, 2);

const catalog: WidgetCatalogItem[] = [
  { id: 'a', title: 'A', group: 'g', defaultW: 2, defaultH: 1 },
  { id: 'b', title: 'B', group: 'g', defaultW: 1, defaultH: 1 },
  { id: 'c', title: 'C', group: 'g', defaultW: 2, defaultH: 1 },
];

const board = normalizeBoard(
  {
    version: 1,
    removed: ['b'],
    items: [
      { id: 'a', w: 3, h: 2, order: 0 },
      { id: 'ghost', w: 2, h: 1, order: 1 },
    ],
  },
  catalog
);
assert.deepEqual(
  board.items.map((i) => i.id),
  ['a', 'c']
);
assert.ok(board.removed.includes('b'));
assert.equal(board.items[0]?.w, 3);

const reordered = reorderItems(board.items, 'c', 'a');
assert.deepEqual(
  reordered.map((i) => i.id),
  ['c', 'a']
);

assert.ok(storageKeyFor('platform', 'admin@x').includes('platform'));
assert.ok(storageKeyFor('platform', 'admin@x').includes('admin'));

console.log('widgetDashboard.selftest: ok');
