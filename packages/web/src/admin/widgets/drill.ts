import type { ChartPoint, TimeGrain } from './types';
import { TIME_GRAINS } from './types';

export function parsePointDate(label: string): Date | null {
  const full = label.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (full) {
    const d = new Date(Date.UTC(Number(full[1]), Number(full[2]) - 1, Number(full[3])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const ym = label.match(/^(\d{4})-(\d{2})$/);
  if (ym) {
    const d = new Date(Date.UTC(Number(ym[1]), Number(ym[2]) - 1, 1));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoWeekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function isoMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function sumBy(points: ChartPoint[], keyOf: (p: ChartPoint) => string): ChartPoint[] {
  const map = new Map<string, number>();
  const order: string[] = [];
  for (const p of points) {
    const key = keyOf(p);
    if (!map.has(key)) {
      map.set(key, 0);
      order.push(key);
    }
    map.set(key, (map.get(key) || 0) + p.value);
  }
  return order.map((label) => ({ label, value: map.get(label) || 0 }));
}

export function detectTimeGrain(points: ChartPoint[]): TimeGrain {
  if (!points.length) return 'day';
  const dated = points.map((p) => parsePointDate(p.label)).filter(Boolean) as Date[];
  if (dated.length < Math.max(2, Math.floor(points.length * 0.5))) return 'day';
  const uniqueDays = new Set(dated.map(isoDay)).size;
  if (uniqueDays >= points.length * 0.7) return 'day';
  const months = new Set(dated.map(isoMonthKey)).size;
  if (months >= points.length * 0.7) return 'month';
  return 'week';
}

export function canDrillUp(grain: TimeGrain): boolean {
  return TIME_GRAINS.indexOf(grain) < TIME_GRAINS.length - 1;
}

export function canDrillDown(grain: TimeGrain, base: TimeGrain): boolean {
  return TIME_GRAINS.indexOf(grain) > TIME_GRAINS.indexOf(base);
}

export function drillUpGrain(grain: TimeGrain): TimeGrain {
  const i = TIME_GRAINS.indexOf(grain);
  return TIME_GRAINS[Math.min(TIME_GRAINS.length - 1, i + 1)]!;
}

export function drillDownGrain(grain: TimeGrain, base: TimeGrain): TimeGrain {
  const i = TIME_GRAINS.indexOf(grain);
  const b = TIME_GRAINS.indexOf(base);
  return TIME_GRAINS[Math.max(b, i - 1)]!;
}

/** True when a source point belongs under an aggregated focus key (day/week/month). */
export function pointMatchesFocusKey(point: ChartPoint, focusKey: string): boolean {
  if (!focusKey) return true;
  if (point.label === focusKey) return true;

  const d = parsePointDate(point.label);
  if (d) {
    if (/^\d{4}-W\d{2}$/.test(focusKey)) return isoWeekKey(d) === focusKey;
    if (/^\d{4}-\d{2}-\d{2}$/.test(focusKey)) return isoDay(d) === focusKey;
    if (/^\d{4}-\d{2}$/.test(focusKey)) return isoMonthKey(d) === focusKey;
    return false;
  }

  // Aggregated labels vs coarser month focus (e.g. week label won't match month without a date).
  if (/^\d{4}-\d{2}$/.test(focusKey) && point.label.startsWith(focusKey)) return true;
  return false;
}

export function filterPointsByFocus(points: ChartPoint[], focusStack: string[]): ChartPoint[] {
  if (!focusStack.length) return points;
  return focusStack.reduce(
    (pts, key) => pts.filter((p) => pointMatchesFocusKey(p, key)),
    points
  );
}

export function aggregateByGrain(
  points: ChartPoint[],
  grain: TimeGrain,
  _base: TimeGrain = 'day',
): ChartPoint[] {
  if (!points.length) return [];
  if (grain === 'day') {
    return points.map((p) => {
      const d = parsePointDate(p.label);
      return d ? { label: isoDay(d), value: p.value } : p;
    });
  }
  const keyFn =
    grain === 'week'
      ? (p: ChartPoint) => {
          const d = parsePointDate(p.label);
          return d ? isoWeekKey(d) : p.label;
        }
      : (p: ChartPoint) => {
          const d = parsePointDate(p.label);
          return d ? isoMonthKey(d) : p.label.slice(0, 7);
        };
  return sumBy(points, keyFn);
}

/** Filter by drill-into stack, then aggregate to the active grain. */
export function timeDrillView(
  points: ChartPoint[],
  grain: TimeGrain,
  baseGrain: TimeGrain,
  focusStack: string[],
): ChartPoint[] {
  return aggregateByGrain(filterPointsByFocus(points, focusStack), grain, baseGrain);
}

export function categoryDrillDetail(
  points: ChartPoint[],
  selectedLabel: string | null,
): { view: ChartPoint[]; detail: ChartPoint | null; missing: boolean } {
  if (!selectedLabel) return { view: points, detail: null, missing: false };
  const hit = points.find((p) => p.label === selectedLabel) || null;
  if (!hit) return { view: [], detail: null, missing: true };
  return { view: [hit], detail: hit, missing: false };
}

export function formatFocusLabel(key: string): string {
  const week = key.match(/^(\d{4})-W(\d{2})$/);
  if (week) return `هفته ${Number(week[2]).toLocaleString('fa-IR')} · ${week[1]}`;
  const day = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (day) return key;
  const month = key.match(/^(\d{4})-(\d{2})$/);
  if (month) return key;
  return key;
}

export const GRAIN_LABEL: Record<TimeGrain, string> = {
  day: 'روز',
  week: 'هفته',
  month: 'ماه',
};

export function chartHeightForRow(h: 1 | 2 | 3): number {
  if (h >= 3) return 220;
  if (h === 2) return 170;
  return 130;
}

export function donutSizeForRow(h: 1 | 2 | 3): number {
  if (h >= 3) return 180;
  if (h === 2) return 150;
  return 120;
}
