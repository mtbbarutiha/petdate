/**
 * Shared layout for Recharts horizontal (layout="vertical") category bar charts
 * under document dir=rtl.
 *
 * Recharts SVG axis ticks inherit RTL and often clip Persian labels to ~1 glyph.
 * Fix: LTR chart island + category YAxis on the right + reversed value axis so
 * bars grow toward the labels (RTL-readable).
 */

export const ADMIN_RTL_HBARS_CLASS = 'admin-recharts-rtl-hbars';

export const adminRtlHBarsMargin = { top: 8, right: 8, left: 20, bottom: 8 } as const;

/** Value axis (counts) — reversed so bars grow toward the right-side labels. */
export const adminRtlHBarsValueAxis = {
  type: 'number' as const,
  reversed: true,
  allowDecimals: false,
  tick: { fontSize: 11, fill: '#757086' },
  axisLine: false as const,
  tickLine: false as const,
};

/** Category axis (Persian labels) — right lane with enough width for full names. */
export const adminRtlHBarsCategoryAxis = {
  type: 'category' as const,
  orientation: 'right' as const,
  width: 148,
  interval: 0 as const,
  tick: { fontSize: 12, fill: '#3d3558' },
  axisLine: false as const,
  tickLine: false as const,
  tickMargin: 10,
};

/** Bar radius when bars grow leftward toward right-side labels. */
export const adminRtlHBarsRadius = [8, 0, 0, 8] as [number, number, number, number];
