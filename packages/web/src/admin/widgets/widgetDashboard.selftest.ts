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
  filterPointsByFocus,
  formatFocusLabel,
  pointMatchesFocusKey,
  timeDrillView,
} from './drill.ts';
import {
  normalizeBoard,
  reorderItems,
  storageKeyFor,
} from './layoutStorage.ts';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WidgetCatalogItem } from './types.ts';
import { PLATFORM_WIDGET_CATALOG } from './catalogs.ts';
import { localDateToIso } from '../jalaliDate.ts';

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

/* Focus / drill-into: month click → weeks in that month only */
assert.equal(pointMatchesFocusKey(days[0]!, '2026-09'), true);
assert.equal(pointMatchesFocusKey(days[5]!, '2026-09'), false);
const sepDays = filterPointsByFocus(days, ['2026-09']);
assert.equal(sepDays.length, 5);
assert.equal(
  sepDays.reduce((a, p) => a + p.value, 0),
  15
);

const sepWeeks = timeDrillView(days, 'week', 'day', ['2026-09']);
assert.ok(sepWeeks.length >= 1);
assert.equal(
  sepWeeks.reduce((a, p) => a + p.value, 0),
  15
);

const weekKey = sepWeeks[0]!.label;
assert.ok(/^2026-W\d{2}$/.test(weekKey));
const weekDays = timeDrillView(days, 'day', 'day', ['2026-09', weekKey]);
assert.ok(weekDays.length >= 1);
assert.ok(weekDays.every((p) => pointMatchesFocusKey(p, weekKey)));
assert.ok(formatFocusLabel(weekKey).includes('هفته'));

const cats = [
  { label: 'CRM', value: 10 },
  { label: 'فروش', value: 4 },
];
const drilled = categoryDrillDetail(cats, 'CRM');
assert.equal(drilled.detail?.value, 10);
assert.equal(drilled.view.length, 1);
assert.equal(drilled.missing, false);
assert.equal(categoryDrillDetail(cats, null).view.length, 2);
const missing = categoryDrillDetail(cats, 'ghost');
assert.equal(missing.missing, true);
assert.equal(missing.view.length, 0);

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
assert.deepEqual(
  reordered.map((i) => i.order),
  [0, 1]
);

const noop = reorderItems(board.items, 'a', 'a');
assert.equal(noop, board.items);

const missingReorder = reorderItems(board.items, 'ghost', 'a');
assert.equal(missingReorder, board.items);

const swapEnd = reorderItems(
  [
    { id: 'a', w: 2, h: 1, order: 0 },
    { id: 'b', w: 2, h: 1, order: 1 },
    { id: 'c', w: 2, h: 1, order: 2 },
  ],
  'a',
  'c'
);
assert.deepEqual(
  swapEnd.map((i) => i.id),
  ['b', 'c', 'a']
);

assert.ok(storageKeyFor('platform', 'admin@x').includes('platform'));
assert.ok(storageKeyFor('platform', 'admin@x').includes('admin'));

assert.ok(PLATFORM_WIDGET_CATALOG.some((c) => c.id === 'dualCalendar'));
const cal = PLATFORM_WIDGET_CATALOG.find((c) => c.id === 'dualCalendar')!;
assert.equal(cal.drill, 'none');
assert.equal(cal.defaultW, 2);
assert.equal(cal.defaultH, 2);

const notes = PLATFORM_WIDGET_CATALOG.find((c) => c.id === 'dailyNotes');
assert.ok(notes, 'dailyNotes catalog entry');
assert.equal(notes!.drill, 'none');
assert.equal(notes!.defaultW, 2);
assert.equal(notes!.defaultH, 2);
assert.equal(notes!.group, 'ابزارها');
const calIdx = PLATFORM_WIDGET_CATALOG.findIndex((c) => c.id === 'dualCalendar');
const notesIdx = PLATFORM_WIDGET_CATALOG.findIndex((c) => c.id === 'dailyNotes');
assert.equal(notesIdx, calIdx + 1, 'daily notes sit immediately after calendar');

const withCal = normalizeBoard(
  {
    version: 1,
    removed: [],
    items: [{ id: 'moduleMix', w: 1, h: 1, order: 0 }],
  },
  PLATFORM_WIDGET_CATALOG
);
assert.ok(withCal.items.some((i) => i.id === 'dualCalendar'));
assert.ok(withCal.items.some((i) => i.id === 'dailyNotes'));

const iso = localDateToIso(new Date(2026, 8, 12, 23, 30, 0));
assert.equal(iso, '2026-09-12', 'local ISO ignores UTC shift');

const here = dirname(fileURLToPath(import.meta.url));
const dashPage = readFileSync(join(here, '../pages/AdminDashboardPage.tsx'), 'utf8');
assert.match(dashPage, /DailyNotesWidget/, 'dashboard renders daily notes widget');
assert.match(dashPage, /DashboardSelectedDateProvider/, 'calendar date shared with notes');
assert.match(dashPage, /id === 'dailyNotes'/, 'notes id wired in renderer');
assert.doesNotMatch(
  dashPage,
  /series \?\s*\n\s*<WidgetDashboard/,
  'widget board is not gated on series so calendar + notes always show'
);

const calSrc = readFileSync(join(here, 'CalendarWidget.tsx'), 'utf8');
assert.match(calSrc, /setSelectedIso/, 'calendar publishes selected day');
assert.match(calSrc, /localDateToIso/, 'calendar uses local ISO dates');

console.log('widgetDashboard.selftest: ok');
