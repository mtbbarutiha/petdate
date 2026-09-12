/**
 * Shared SVG chart kit for admin dashboards — motion-ready (gradients, draw, grow, callouts).
 * Used by Platform / Finance widgets and finance pages; Recharts panels use motionCharts helpers.
 */
import { useId, useMemo, useState, type CSSProperties } from 'react';
import {
  ADMIN_CHART_DONUT_SIZE,
  ADMIN_CHART_PLOT_H,
  ADMIN_CHART_VIEWBOX_W,
  truncateChartLabel,
} from './adminChartLayout';
import {
  AdminProgressRing,
  MOTION_DUR_MS,
  MOTION_PALETTE,
  hexToRgba,
  smoothAreaPath,
  smoothLinePath,
  usePathDraw,
  usePrefersReducedMotion,
} from './motionCharts';
import { formatNumFa } from './api';
import { tr } from '../i18n';

type Point = { label: string; value: number };

function maxOf(points: Point[], min = 1) {
  return Math.max(min, ...points.map((p) => p.value));
}

function Callout({
  x,
  y,
  value,
  visible,
}: {
  x: number;
  y: number;
  value: number;
  visible: boolean;
}) {
  if (!visible) return null;
  const text = formatNumFa(value);
  const w = Math.min(104, Math.max(52, 16 + text.length * 7));
  const h = 26;
  return (
    <g className="admin-motion-svg-callout" style={{ pointerEvents: 'none' }}>
      <rect
        x={x - w / 2}
        y={y - h - 10}
        width={w}
        height={h}
        rx={13}
        className="admin-motion-svg-callout-bg"
      />
      <polygon
        points={`${x - 5},${y - 10} ${x + 5},${y - 10} ${x},${y - 4}`}
        className="admin-motion-svg-callout-bg"
      />
      <text x={x} y={y - 16} textAnchor="middle" className="admin-motion-svg-callout-text">
        {text}
      </text>
    </g>
  );
}

export function AdminBarChart({
  points,
  height = ADMIN_CHART_PLOT_H,
  color = MOTION_PALETTE.purple,
  onSliceClick,
  interactive,
}: {
  points: Point[];
  height?: number;
  color?: string;
  onSliceClick?: (point: Point) => void;
  /** When false, clicks are ignored (e.g. already at finest drill level). */
  interactive?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) {
    return <p className="admin-muted">{tr('داده‌ای برای نمودار نیست')}</p>;
  }
  const clickable = Boolean(onSliceClick) && interactive !== false;
  const max = maxOf(points);
  const n = Math.max(points.length, 1);
  const width = ADMIN_CHART_VIEWBOX_W;
  const slot = width / n;
  const barW = Math.max(10, Math.min(28, slot - 8));
  const labelH = 36;
  const labelEvery = n > 10 ? Math.ceil(n / 8) : 1;
  return (
    <div className="admin-chart-scroll">
      <svg
        viewBox={`0 0 ${width} ${height + labelH}`}
        preserveAspectRatio="xMidYMid meet"
        className="admin-chart-svg admin-chart-svg--compact"
        role="img"
      >
        <defs>
          <linearGradient id={`bar-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.98} />
            <stop offset="100%" stopColor={hexToRgba(MOTION_PALETTE.mint, 0.75)} />
          </linearGradient>
        </defs>
        {points.map((p, i) => {
          const h = Math.round((p.value / max) * height);
          const x = i * slot + (slot - barW) / 2;
          const y = height - h + 8;
          const delay = reduced ? 0 : i * 45;
          return (
            <g
              key={`${p.label}-${i}`}
              className={clickable ? 'admin-chart-hit' : undefined}
              onClick={
                clickable
                  ? (e) => {
                      e.stopPropagation();
                      onSliceClick?.(p);
                    }
                  : undefined
              }
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={clickable ? { cursor: 'pointer' } : undefined}
            >
              {clickable ? (
                <rect x={x - 2} y={0} width={barW + 4} height={height + 8} fill="transparent" />
              ) : null}
              <g
                className={reduced ? undefined : 'admin-motion-bar-grow'}
                style={
                  reduced
                    ? undefined
                    : ({
                        transformOrigin: `${x + barW / 2}px ${height + 8}px`,
                        animationDelay: `${delay}ms`,
                      } as CSSProperties)
                }
              >
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(2, h)}
                  rx={6}
                  fill={`url(#bar-${uid})`}
                  opacity={hover === null || hover === i ? 0.95 : 0.45}
                />
              </g>
              <title>{`${tr(p.label)}: ${formatNumFa(p.value)}`}</title>
              {i % labelEvery === 0 ? (
                <text
                  x={x + barW / 2}
                  y={height + 22}
                  textAnchor="middle"
                  className="admin-chart-axis"
                  transform={`rotate(-24 ${x + barW / 2} ${height + 22})`}
                >
                  {truncateChartLabel(tr(p.label), n > 8 ? 8 : 12)}
                </text>
              ) : null}
              {n <= 12 || hover === i ? (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="admin-chart-val">
                  {formatNumFa(p.value)}
                </text>
              ) : null}
              <Callout x={x + barW / 2} y={y} value={p.value} visible={hover === i} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Horizontal funnel — wide top / narrow bottom with full Persian labels. */
export function AdminFunnelChart({
  points,
  height,
  colors = [
    MOTION_PALETTE.purple,
    MOTION_PALETTE.mint,
    MOTION_PALETTE.coral,
    MOTION_PALETTE.blue,
    MOTION_PALETTE.pink,
    MOTION_PALETTE.teal,
    '#8b5cf6',
    '#64748b',
  ],
  onSliceClick,
}: {
  points: Point[];
  height?: number;
  colors?: string[];
  onSliceClick?: (point: Point) => void;
}) {
  const reduced = usePrefersReducedMotion();
  if (!points.length) {
    return <p className="admin-muted">{tr('داده‌ای برای نمودار نیست')}</p>;
  }
  const max = maxOf(points);
  const rowH = 36;
  const padX = 12;
  const width = ADMIN_CHART_VIEWBOX_W;
  const h = height ?? points.length * rowH + 12;
  return (
    <div className="admin-chart-scroll admin-funnel-wrap">
      <svg
        viewBox={`0 0 ${width} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        className="admin-chart-svg admin-chart-svg--funnel"
        role="img"
      >
        {points.map((p, i) => {
          const ratio = p.value / max;
          const barW = Math.max(80, Math.round((width - padX * 2) * (0.42 + ratio * 0.58)));
          const x = (width - barW) / 2;
          const y = 8 + i * rowH;
          const color = colors[i % colors.length]!;
          return (
            <g
              key={`${p.label}-${i}`}
              className={onSliceClick ? 'admin-chart-hit' : undefined}
              onClick={() => onSliceClick?.(p)}
              style={onSliceClick ? { cursor: 'pointer' } : undefined}
            >
              <rect
                x={x}
                y={y}
                width={barW}
                height={34}
                rx={10}
                fill={color}
                opacity={0.92}
                className={reduced ? undefined : 'admin-motion-funnel-row'}
                style={reduced ? undefined : { animationDelay: `${i * 60}ms` }}
              />
              <title>{`${p.label}: ${formatNumFa(p.value)}`}</title>
              <text x={width / 2} y={y + 22} textAnchor="middle" className="admin-funnel-label">
                {truncateChartLabel(tr(p.label), 22)} — {formatNumFa(p.value)}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="admin-funnel-legend" aria-hidden>
        {points.map((p, i) => (
          <li key={tr(p.label)}>
            <span style={{ background: colors[i % colors.length] }} />
            {tr(p.label)}
            <strong>{formatNumFa(p.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminLineChart({
  points,
  height = ADMIN_CHART_PLOT_H,
  color = MOTION_PALETTE.purple,
  onPointClick,
  interactive,
}: {
  points: Point[];
  height?: number;
  color?: string;
  onPointClick?: (point: Point) => void;
  interactive?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const geometry = useMemo(() => {
    if (!points.length) return null;
    const max = maxOf(points);
    const width = ADMIN_CHART_VIEWBOX_W;
    const padX = 14;
    const padY = 14;
    const step = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
    const coords = points.map((p, i) => {
      const x = padX + i * step;
      const y = padY + (height - padY * 2) * (1 - p.value / max);
      return { x, y, ...p };
    });
    return {
      width,
      step,
      coords,
      line: smoothLinePath(coords),
      area: smoothAreaPath(coords, height),
    };
  }, [points, height]);

  const { pathRef, style: drawStyle } = usePathDraw(
    !reduced && Boolean(geometry),
    geometry?.line ?? ''
  );

  if (!geometry) {
    return <p className="admin-muted">{tr('داده‌ای برای نمودار نیست')}</p>;
  }
  const clickable = Boolean(onPointClick) && interactive !== false;
  const { width, step, coords, line, area } = geometry;
  const peakIdx = coords.reduce((best, c, i) => (c.value > (coords[best]?.value ?? -1) ? i : best), 0);

  return (
    <div className="admin-chart-scroll">
      <svg
        viewBox={`0 0 ${width} ${height + 28}`}
        preserveAspectRatio="xMidYMid meet"
        className="admin-chart-svg admin-chart-svg--compact"
        role="img"
      >
        <defs>
          <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.38} />
            <stop offset="55%" stopColor={MOTION_PALETTE.mint} stopOpacity={0.12} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path
          d={area}
          fill={`url(#area-${uid})`}
          className={reduced ? undefined : 'admin-motion-area-fade'}
        />
        <path
          ref={pathRef}
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={drawStyle}
        />
        {clickable
          ? coords.map((c, i) => (
              <rect
                key={`hit-${c.label}-${i}`}
                x={c.x - Math.max(10, step / 2)}
                y={0}
                width={Math.max(20, step)}
                height={height + 28}
                fill="transparent"
                className="admin-chart-hit"
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onPointClick?.({ label: c.label, value: c.value });
                }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${c.label}: ${formatNumFa(c.value)}`}</title>
              </rect>
            ))
          : coords.map((c, i) => (
              <rect
                key={`hov-${c.label}-${i}`}
                x={c.x - Math.max(8, step / 2)}
                y={0}
                width={Math.max(16, step)}
                height={height + 28}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
        {coords.map((c, i) => (
          <g key={`${c.label}-${i}`} style={{ pointerEvents: 'none' }}>
            <circle
              cx={c.x}
              cy={c.y}
              r={hover === i || i === peakIdx ? 5.5 : clickable ? 4.5 : 3.5}
              fill={color}
              className={reduced ? undefined : 'admin-motion-dot-pop'}
              style={reduced ? undefined : { animationDelay: `${200 + i * 40}ms` }}
            />
            <title>{`${c.label}: ${formatNumFa(c.value)}`}</title>
          </g>
        ))}
        {hover != null && coords[hover] ? (
          <Callout x={coords[hover].x} y={coords[hover].y} value={coords[hover].value} visible />
        ) : coords[peakIdx] ? (
          <Callout
            x={coords[peakIdx].x}
            y={coords[peakIdx].y}
            value={coords[peakIdx].value}
            visible={!reduced}
          />
        ) : null}
      </svg>
    </div>
  );
}

function MotionLinePath({
  d,
  color,
  reduced,
  delay = 0,
}: {
  d: string;
  color: string;
  reduced: boolean;
  delay?: number;
}) {
  const { pathRef, style } = usePathDraw(!reduced, d);
  return (
    <path
      ref={pathRef}
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={2.6}
      strokeLinejoin="round"
      strokeLinecap="round"
      style={reduced ? undefined : { ...style, animationDelay: `${delay}ms` }}
    />
  );
}

/** Multi-series smooth line chart with floating callouts. */
export function AdminMultiLineChart({
  series,
  height = ADMIN_CHART_PLOT_H,
  onPointClick,
  interactive,
}: {
  series: Array<{ key: string; label: string; color: string; points: Point[] }>;
  height?: number;
  /** Fired with the x-axis label (shared across series) for time drill-down. */
  onPointClick?: (label: string) => void;
  interactive?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const [hover, setHover] = useState<{ series: number; i: number } | null>(null);
  const layout = useMemo(() => {
    const active = series.filter((s) => s.points.length > 0);
    if (!active.length) return null;
    const allValues = active.flatMap((s) => s.points.map((p) => p.value));
    const max = Math.max(1, ...allValues);
    const len = Math.max(...active.map((s) => s.points.length));
    const width = ADMIN_CHART_VIEWBOX_W;
    const padX = 14;
    const padY = 14;
    const step = len > 1 ? (width - padX * 2) / (len - 1) : 0;
    const xLabels = active[0]?.points.map((p) => p.label) ?? [];
    const built = active.map((s) => {
      const coords = s.points.map((p, i) => {
        const x = padX + i * step;
        const y = padY + (height - padY * 2) * (1 - p.value / max);
        return { x, y, ...p };
      });
      return { ...s, coords, path: smoothLinePath(coords), area: smoothAreaPath(coords, height) };
    });
    return { width, step, xLabels, built, max };
  }, [series, height]);

  if (!layout) {
    return <p className="admin-muted">{tr('داده‌ای برای نمودار نیست')}</p>;
  }
  const clickable = Boolean(onPointClick) && interactive !== false;
  const { width, step, xLabels, built } = layout;

  return (
    <div className="admin-chart-scroll">
      <svg
        viewBox={`0 0 ${width} ${height + 36}`}
        preserveAspectRatio="xMidYMid meet"
        className="admin-chart-svg admin-chart-svg--compact"
        role="img"
      >
        <defs>
          {built.map((s) => (
            <linearGradient key={`g-${s.key}`} id={`ml-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        {clickable
          ? xLabels.map((label, i) => {
              const x = 14 + i * step;
              return (
                <rect
                  key={`hit-${label}-${i}`}
                  x={x - Math.max(8, step / 2)}
                  y={0}
                  width={Math.max(16, step)}
                  height={height + 36}
                  fill="transparent"
                  className="admin-chart-hit"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPointClick?.(label);
                  }}
                  onMouseEnter={() => setHover({ series: 0, i })}
                  onMouseLeave={() => setHover(null)}
                >
                  <title>{label}</title>
                </rect>
              );
            })
          : null}
        {built.map((s, si) => (
          <g key={s.key}>
            <path
              d={s.area}
              fill={`url(#ml-${s.key})`}
              className={reduced ? undefined : 'admin-motion-area-fade'}
              style={reduced ? undefined : { animationDelay: `${si * 80}ms` }}
            />
            <MotionLinePath d={s.path} color={s.color} reduced={reduced} delay={si * 120} />
            {s.coords.map((c, i) => (
              <circle
                key={`${s.key}-${i}`}
                cx={c.x}
                cy={c.y}
                r={hover?.series === si && hover.i === i ? 5 : 3.2}
                fill={s.color}
                style={{ pointerEvents: 'none' }}
              >
                <title>{`${s.label} · ${c.label}: ${formatNumFa(c.value)}`}</title>
              </circle>
            ))}
          </g>
        ))}
        {built.slice(0, 2).map((s, si) => {
          const peak = s.coords.reduce((b, c, i) => (c.value > (s.coords[b]?.value ?? -1) ? i : b), 0);
          const c = s.coords[peak];
          if (!c) return null;
          const show = hover ? hover.series === si && hover.i === peak : !reduced;
          return <Callout key={`peak-${s.key}`} x={c.x} y={c.y} value={c.value} visible={Boolean(show)} />;
        })}
      </svg>
      <ul className="admin-chart-legend">
        {built.map((s) => (
          <li key={s.key}>
            <span style={{ background: s.color }} />
            <span className="admin-chart-legend-label" title={tr(s.label)}>
              {truncateChartLabel(tr(s.label), 18)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminDonutChart({
  slices,
  size = ADMIN_CHART_DONUT_SIZE,
  onSliceClick,
}: {
  slices: Array<{ label: string; value: number; color: string }>;
  size?: number;
  onSliceClick?: (slice: { label: string; value: number; color: string }) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = 62;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const hasData = slices.some((s) => s.value > 0);
  return (
    <div className="admin-donut-wrap">
      <svg
        width={size}
        height={size}
        viewBox="0 0 160 160"
        preserveAspectRatio="xMidYMid meet"
        className="admin-chart-svg admin-chart-svg--donut"
      >
        <g transform="translate(80,80) rotate(-90)">
          {!hasData ? (
            <circle r={r} cx={0} cy={0} fill="transparent" stroke={MOTION_PALETTE.track} strokeWidth={20} />
          ) : (
            slices.map((s, i) => {
              const len = (s.value / total) * c;
              const el = (
                <circle
                  key={tr(s.label)}
                  r={r}
                  cx={0}
                  cy={0}
                  fill="transparent"
                  stroke={s.color}
                  strokeWidth={20}
                  strokeLinecap="butt"
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  className={[
                    onSliceClick ? 'admin-chart-hit' : '',
                    reduced ? '' : 'admin-motion-donut-seg',
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined}
                  style={
                    onSliceClick || !reduced
                      ? {
                          cursor: onSliceClick ? 'pointer' : undefined,
                          animationDelay: reduced ? undefined : `${i * 90}ms`,
                        }
                      : undefined
                  }
                  onClick={() => onSliceClick?.(s)}
                >
                  <title>{`${s.label}: ${formatNumFa(s.value)} (${Math.round((s.value / total) * 100)}${tr('٪)')}`}</title>
                </circle>
              );
              offset += len;
              return el;
            })
          )}
        </g>
        <text x="80" y="76" textAnchor="middle" className="admin-donut-center">
          {formatNumFa(hasData ? total : 0)}
        </text>
        <text x="80" y="94" textAnchor="middle" className="admin-donut-sub">
          {tr('جمع')}
        </text>
      </svg>
      <ul className="admin-donut-legend">
        {slices.map((s) => (
          <li
            key={tr(s.label)}
            className={onSliceClick ? 'admin-chart-hit' : undefined}
            onClick={() => onSliceClick?.(s)}
            style={onSliceClick ? { cursor: 'pointer' } : undefined}
            title={`${s.label}: ${formatNumFa(s.value)}`}
          >
            <span style={{ background: s.color }} />
            <span className="admin-chart-legend-label" title={tr(s.label)}>
              {truncateChartLabel(tr(s.label), 18)}
            </span>
            <strong>{formatNumFa(s.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { AdminProgressRing };

export const PERIOD_OPTIONS = [
  { value: 'day', label: 'روز' },
  { value: 'week', label: 'هفته' },
  { value: 'month', label: 'ماه' },
  { value: 'year', label: 'سال' },
] as const;

export type FinancePeriod = (typeof PERIOD_OPTIONS)[number]['value'];

export function PeriodFilter({
  value,
  onChange,
}: {
  value: FinancePeriod;
  onChange: (v: FinancePeriod) => void;
}) {
  return (
    <div className="admin-period-filter" role="group" aria-label={tr("بازه زمانی")}>
      {PERIOD_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`admin-period-btn${value === o.value ? ' is-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {tr(o.label)}
        </button>
      ))}
    </div>
  );
}

void MOTION_DUR_MS;
