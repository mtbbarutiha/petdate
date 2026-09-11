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

export const ADMIN_RTL_HBARS_CLASS = 'admin-recharts-rtl-hbars';

export const adminRtlHBarsMargin = { top: 8, right: 8, left: 20, bottom: 8 } as const;

/** Extra left gutter so bar end-count labels stay visible on reversed value axis. */
export const adminRtlHBarsMarginWithCounts = { top: 8, right: 8, left: 40, bottom: 8 } as const;

/** Value axis (counts) — reversed so bars grow toward the right-side labels. */
export const adminRtlHBarsValueAxis = {
  type: 'number' as const,
  reversed: true,
  allowDecimals: false,
  tick: { fontSize: 11, fill: 'var(--admin-muted)' },
  axisLine: false as const,
  tickLine: false as const,
};

/** Category axis (Persian labels) — right lane with enough width for full names. */
export const adminRtlHBarsCategoryAxis = {
  type: 'category' as const,
  orientation: 'right' as const,
  width: 148,
  interval: 0 as const,
  tick: { fontSize: 12, fill: 'var(--admin-ink)' },
  axisLine: false as const,
  tickLine: false as const,
  tickMargin: 10,
};

/** Wider right lane for LTR path strings (`/my-pets`, long routes). */
export const adminRtlPathBarsCategoryAxis = {
  ...adminRtlHBarsCategoryAxis,
  width: 168,
  tickMargin: 12,
  tick: { fontSize: 12, fill: 'var(--admin-ink)', direction: 'ltr' as const },
};

/** Bar radius when bars grow leftward toward right-side labels. */
export const adminRtlHBarsRadius = [8, 0, 0, 8] as [number, number, number, number];

/** Row height for path / category horizontal bars (avoids cramped RTL ticks). */
export function adminRtlHBarsHeight(rowCount: number, rowPx = 36, minPx = 180): number {
  return Math.max(minPx, Math.max(rowCount, 1) * rowPx);
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
  const shown = short.length > 26 ? `${short.slice(0, 25)}…` : short;
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{full}</title>
      <text
        x={10}
        y={0}
        dy={4}
        textAnchor="start"
        fill="var(--admin-ink)"
        fontSize={12}
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
