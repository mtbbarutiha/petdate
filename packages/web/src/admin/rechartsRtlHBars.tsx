/**
 * Shared layout for Recharts horizontal (layout="vertical") category bar charts
 * under document dir=rtl.
 *
 * Recharts SVG axis ticks inherit RTL and often clip Persian labels to ~1 glyph.
 * Fix: LTR chart island + category YAxis on the right + reversed value axis so
 * bars grow toward the labels (RTL-readable).
 */

import type { ReactElement } from 'react';
import { formatNumFa } from './api';
import {
  ADMIN_CHART_HBARS_MIN,
  ADMIN_CHART_HBARS_ROW,
  ADMIN_CHART_MAX_H,
  adminChartHBarsHeight,
  truncateChartLabel,
} from './adminChartLayout';

export const ADMIN_RTL_HBARS_CLASS = 'admin-recharts-rtl-hbars';

export const adminRtlHBarsMargin = { top: 8, right: 8, left: 16, bottom: 8 } as const;

/** Extra left gutter so bar end-count labels stay visible on reversed value axis. */
export const adminRtlHBarsMarginWithCounts = { top: 8, right: 8, left: 36, bottom: 8 } as const;

/** Value axis (counts) — reversed so bars grow toward the right-side labels. */
export const adminRtlHBarsValueAxis = {
  type: 'number' as const,
  reversed: true,
  allowDecimals: false,
  tick: { fontSize: 11, fill: 'var(--admin-muted)' },
  axisLine: false as const,
  tickLine: false as const,
};

type CategoryTickProps = {
  x?: number;
  y?: number;
  payload?: { value?: string };
  maxChars?: number;
};

/** Truncated Persian category tick — full value in native tooltip. */
export function AdminRtlCategoryTick(props: CategoryTickProps): ReactElement<SVGElement> {
  const { x = 0, y = 0, payload, maxChars = 14 } = props;
  const full = String(payload?.value ?? '');
  const shown = truncateChartLabel(full, maxChars);
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{full}</title>
      <text
        x={8}
        y={0}
        dy={4}
        textAnchor="start"
        fill="var(--admin-ink)"
        fontSize={11}
      >
        {shown}
      </text>
    </g>
  ) as ReactElement<SVGElement>;
}

/** Category axis (Persian labels) — right lane, truncated ticks, compact width. */
export const adminRtlHBarsCategoryAxis = {
  type: 'category' as const,
  orientation: 'right' as const,
  width: 118,
  interval: 0 as const,
  tick: AdminRtlCategoryTick,
  axisLine: false as const,
  tickLine: false as const,
  tickMargin: 8,
};

/** Wider right lane for LTR path strings (`/my-pets`, long routes). */
export const adminRtlPathBarsCategoryAxis = {
  ...adminRtlHBarsCategoryAxis,
  width: 148,
  tickMargin: 10,
};

/** Bar radius when bars grow leftward toward right-side labels. */
export const adminRtlHBarsRadius = [8, 0, 0, 8] as [number, number, number, number];

/** Row height for path / category horizontal bars — capped so cards stay in viewport. */
export function adminRtlHBarsHeight(
  rowCount: number,
  rowPx = ADMIN_CHART_HBARS_ROW,
  minPx = ADMIN_CHART_HBARS_MIN,
  maxPx = ADMIN_CHART_MAX_H
): number {
  return adminChartHBarsHeight(rowCount, rowPx, minPx, maxPx);
}

type PathTickProps = {
  x?: number;
  y?: number;
  payload?: { value?: string };
  fullLabelByShort?: Record<string, string>;
};

/** Custom Y tick: LTR path, native tooltip with full path, ellipsis when shortened. */
export function AdminRtlPathTick(props: PathTickProps): ReactElement {
  const { x = 0, y = 0, payload, fullLabelByShort } = props;
  const short = String(payload?.value ?? '');
  const full = (fullLabelByShort && fullLabelByShort[short]) || short;
  const shown = truncateChartLabel(short, 22);
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{full}</title>
      <text
        x={8}
        y={0}
        dy={4}
        textAnchor="start"
        fill="var(--admin-ink)"
        fontSize={11}
        direction="ltr"
        style={{ unicodeBidi: 'plaintext' }}
      >
        {shown}
      </text>
    </g>
  );
}

type CountLabelProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number | string;
};

/**
 * Count at the visual end of a reversed horizontal bar (grows leftward).
 * Uses bar geometry so short bars still show a readable number.
 */
export function AdminRtlBarCountLabel(props: CountLabelProps): ReactElement | null {
  const { x = 0, y = 0, width = 0, height = 0, value } = props;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  // With reversed X, bar is drawn from right toward left; end is at min(x, x+width).
  const endX = Math.min(x, x + width) - 6;
  const cy = y + height / 2;
  return (
    <text
      x={endX}
      y={cy}
      dy={4}
      textAnchor="end"
      fill="var(--admin-ink)"
      fontSize={11}
      fontWeight={600}
      direction="ltr"
      style={{ unicodeBidi: 'plaintext' }}
    >
      {formatNumFa(n)}
    </text>
  );
}
