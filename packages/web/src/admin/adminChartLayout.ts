/**
 * Shared admin chart sizing + tick/label helpers.
 * Caps viewport blow-up, keeps side-by-side cards readable, RTL-safe.
 */

export const ADMIN_CHART_MAX_H = 280;
export const ADMIN_CHART_COMPACT_H = 160;
export const ADMIN_CHART_STANDARD_H = 200;
export const ADMIN_CHART_TALL_H = 240;
export const ADMIN_CHART_PLOT_H = 140;
export const ADMIN_CHART_VIEWBOX_W = 560;
export const ADMIN_CHART_DONUT_SIZE = 140;
export const ADMIN_CHART_HBARS_ROW = 32;
export const ADMIN_CHART_HBARS_MIN = 160;
export const ADMIN_CHART_LABEL_MAX = 14;

export function capAdminChartHeight(height: number, max = ADMIN_CHART_MAX_H): number {
  if (!Number.isFinite(height) || height <= 0) return ADMIN_CHART_STANDARD_H;
  return Math.min(max, Math.max(ADMIN_CHART_COMPACT_H, Math.round(height)));
}

/** Horizontal-bar plot height — capped so cards never eat the viewport. */
export function adminChartHBarsHeight(
  rowCount: number,
  rowPx = ADMIN_CHART_HBARS_ROW,
  minPx = ADMIN_CHART_HBARS_MIN,
  maxPx = ADMIN_CHART_MAX_H
): number {
  const rows = Math.max(1, rowCount);
  return Math.min(maxPx, Math.max(minPx, rows * rowPx));
}

export function truncateChartLabel(label: unknown, max = ADMIN_CHART_LABEL_MAX): string {
  const s = String(label ?? '').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(1, max - 1))}…`;
}

export const ADMIN_CHART_TICK = {
  fontSize: 11,
  fill: 'var(--admin-muted)',
} as const;

export const adminChartXAxisProps = {
  tick: ADMIN_CHART_TICK,
  axisLine: false as const,
  tickLine: false as const,
  interval: 'preserveStartEnd' as const,
  minTickGap: 18,
};

export const adminChartYAxisProps = {
  allowDecimals: false,
  tick: ADMIN_CHART_TICK,
  axisLine: false as const,
  tickLine: false as const,
  width: 36,
};

export const adminChartPlotMargin = {
  top: 8,
  right: 8,
  left: 0,
  bottom: 4,
} as const;

export function adminChartTickFormatter(value: unknown): string {
  return truncateChartLabel(value, 10);
}
