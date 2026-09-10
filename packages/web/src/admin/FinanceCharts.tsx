/** Lightweight SVG charts for admin finance — no chart.js dependency. */

type Point = { label: string; value: number };

function maxOf(points: Point[], min = 1) {
  return Math.max(min, ...points.map((p) => p.value));
}

function ChartTipBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-chart-tip">
      <div className="admin-chart-tip-label">{label}</div>
      <strong>{value.toLocaleString('fa-IR')}</strong>
    </div>
  );
}

export function AdminBarChart({
  points,
  height = 140,
  color = '#5c4d91',
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
  if (!points.length) {
    return <p className="admin-muted">داده‌ای برای نمودار نیست</p>;
  }
  const clickable = Boolean(onSliceClick) && interactive !== false;
  const max = maxOf(points);
  const barW = Math.max(14, Math.min(36, Math.floor(560 / Math.max(points.length, 1)) - 6));
  const gap = 10;
  const labelH = 48;
  const width = Math.max(280, points.length * (barW + gap) + 24);
  return (
    <div className="admin-chart-scroll">
      <svg viewBox={`0 0 ${width} ${height + labelH}`} className="admin-chart-svg admin-chart-svg--compact" role="img">
        {points.map((p, i) => {
          const h = Math.round((p.value / max) * height);
          const x = 12 + i * (barW + gap);
          const y = height - h + 8;
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
              style={clickable ? { cursor: 'pointer' } : undefined}
            >
              {/* Full-column hit target so short bars stay easy to click */}
              {clickable ? (
                <rect x={x - 2} y={0} width={barW + 4} height={height + 8} fill="transparent" />
              ) : null}
              <rect x={x} y={y} width={barW} height={Math.max(2, h)} rx={4} fill={color} opacity={0.92} />
              <title>{`${p.label}: ${p.value.toLocaleString('fa-IR')}`}</title>
              <text
                x={x + barW / 2}
                y={height + 22}
                textAnchor="middle"
                className="admin-chart-axis"
                transform={`rotate(-28 ${x + barW / 2} ${height + 22})`}
              >
                {p.label.length > 14 ? `${p.label.slice(0, 12)}…` : p.label}
              </text>
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="admin-chart-val">
                {p.value.toLocaleString('fa-IR')}
              </text>
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
  colors = ['#5c4d91', '#15cca0', '#fd961e', '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6', '#64748b'],
  onSliceClick,
}: {
  points: Point[];
  height?: number;
  colors?: string[];
  onSliceClick?: (point: Point) => void;
}) {
  if (!points.length) {
    return <p className="admin-muted">داده‌ای برای نمودار نیست</p>;
  }
  const max = maxOf(points);
  const rowH = 44;
  const padX = 12;
  const width = 640;
  const h = height ?? points.length * rowH + 16;
  return (
    <div className="admin-chart-scroll admin-funnel-wrap">
      <svg viewBox={`0 0 ${width} ${h}`} className="admin-chart-svg admin-chart-svg--lg" role="img">
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
              <rect x={x} y={y} width={barW} height={34} rx={8} fill={color} opacity={0.9} />
              <title>{`${p.label}: ${p.value.toLocaleString('fa-IR')}`}</title>
              <text x={width / 2} y={y + 22} textAnchor="middle" className="admin-funnel-label">
                {p.label} — {p.value.toLocaleString('fa-IR')}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="admin-funnel-legend" aria-hidden>
        {points.map((p, i) => (
          <li key={p.label}>
            <span style={{ background: colors[i % colors.length] }} />
            {p.label}
            <strong>{p.value.toLocaleString('fa-IR')}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminLineChart({
  points,
  height = 140,
  color = '#5c4d91',
  onPointClick,
  interactive,
}: {
  points: Point[];
  height?: number;
  color?: string;
  onPointClick?: (point: Point) => void;
  interactive?: boolean;
}) {
  if (!points.length) {
    return <p className="admin-muted">داده‌ای برای نمودار نیست</p>;
  }
  const clickable = Boolean(onPointClick) && interactive !== false;
  const max = maxOf(points);
  const width = 640;
  const padX = 14;
  const padY = 14;
  const step = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = padX + i * step;
    const y = padY + (height - padY * 2) * (1 - p.value / max);
    return { x, y, ...p };
  });
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ');
  const area = `${path} L${coords[coords.length - 1].x},${height} L${coords[0].x},${height} Z`;
  return (
    <div className="admin-chart-scroll">
      <svg viewBox={`0 0 ${width} ${height + 28}`} className="admin-chart-svg admin-chart-svg--compact" role="img">
        <path d={area} fill={color} opacity={0.12} />
        <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
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
              >
                <title>{`${c.label}: ${c.value.toLocaleString('fa-IR')}`}</title>
              </rect>
            ))
          : null}
        {coords.map((c, i) => (
          <g key={`${c.label}-${i}`} style={{ pointerEvents: 'none' }}>
            <circle cx={c.x} cy={c.y} r={clickable ? 5 : 4} fill={color} />
            <title>{`${c.label}: ${c.value.toLocaleString('fa-IR')}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Multi-series line chart for executive aggregate trends. */
export function AdminMultiLineChart({
  series,
  height = 140,
  onPointClick,
  interactive,
}: {
  series: Array<{ key: string; label: string; color: string; points: Point[] }>;
  height?: number;
  /** Fired with the x-axis label (shared across series) for time drill-down. */
  onPointClick?: (label: string) => void;
  interactive?: boolean;
}) {
  const active = series.filter((s) => s.points.length > 0);
  if (!active.length) {
    return <p className="admin-muted">داده‌ای برای نمودار نیست</p>;
  }
  const clickable = Boolean(onPointClick) && interactive !== false;
  const allValues = active.flatMap((s) => s.points.map((p) => p.value));
  const max = Math.max(1, ...allValues);
  const len = Math.max(...active.map((s) => s.points.length));
  const width = 640;
  const padX = 14;
  const padY = 14;
  const step = len > 1 ? (width - padX * 2) / (len - 1) : 0;
  const xLabels = active[0]?.points.map((p) => p.label) ?? [];

  return (
    <div className="admin-chart-scroll">
      <svg viewBox={`0 0 ${width} ${height + 36}`} className="admin-chart-svg admin-chart-svg--compact" role="img">
        {clickable
          ? xLabels.map((label, i) => {
              const x = padX + i * step;
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
                >
                  <title>{label}</title>
                </rect>
              );
            })
          : null}
        {active.map((s) => {
          const coords = s.points.map((p, i) => {
            const x = padX + i * step;
            const y = padY + (height - padY * 2) * (1 - p.value / max);
            return { x, y, ...p };
          });
          const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ');
          return (
            <g key={s.key}>
              <path d={path} fill="none" stroke={s.color} strokeWidth={2.6} strokeLinejoin="round" />
              {coords.map((c, i) => (
                <circle key={`${s.key}-${i}`} cx={c.x} cy={c.y} r={3.2} fill={s.color}>
                  <title>{`${s.label} · ${c.label}: ${c.value.toLocaleString('fa-IR')}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <ul className="admin-chart-legend">
        {active.map((s) => (
          <li key={s.key}>
            <span style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminDonutChart({
  slices,
  size = 140,
  onSliceClick,
}: {
  slices: Array<{ label: string; value: number; color: string }>;
  size?: number;
  onSliceClick?: (slice: { label: string; value: number; color: string }) => void;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = 62;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const hasData = slices.some((s) => s.value > 0);
  return (
    <div className="admin-donut-wrap">
      <svg width={size} height={size} viewBox="0 0 160 160" className="admin-chart-svg admin-chart-svg--lg">
        <g transform="translate(80,80) rotate(-90)">
          {!hasData ? (
            <circle r={r} cx={0} cy={0} fill="transparent" stroke="#e2e8f0" strokeWidth={20} />
          ) : (
            slices.map((s) => {
              const len = (s.value / total) * c;
              const el = (
                <circle
                  key={s.label}
                  r={r}
                  cx={0}
                  cy={0}
                  fill="transparent"
                  stroke={s.color}
                  strokeWidth={20}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  className={onSliceClick ? 'admin-chart-hit' : undefined}
                  style={onSliceClick ? { cursor: 'pointer' } : undefined}
                  onClick={() => onSliceClick?.(s)}
                >
                  <title>{`${s.label}: ${s.value.toLocaleString('fa-IR')} (${Math.round((s.value / total) * 100)}٪)`}</title>
                </circle>
              );
              offset += len;
              return el;
            })
          )}
        </g>
        <text x="80" y="76" textAnchor="middle" className="admin-donut-center">
          {(hasData ? total : 0).toLocaleString('fa-IR')}
        </text>
        <text x="80" y="94" textAnchor="middle" className="admin-donut-sub">
          جمع
        </text>
      </svg>
      <ul className="admin-donut-legend">
        {slices.map((s) => (
          <li
            key={s.label}
            className={onSliceClick ? 'admin-chart-hit' : undefined}
            onClick={() => onSliceClick?.(s)}
            style={onSliceClick ? { cursor: 'pointer' } : undefined}
            title={`${s.label}: ${s.value.toLocaleString('fa-IR')}`}
          >
            <span style={{ background: s.color }} />
            {s.label}
            <strong>{s.value.toLocaleString('fa-IR')}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
    <div className="admin-period-filter" role="group" aria-label="بازه زمانی">
      {PERIOD_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`admin-period-btn${value === o.value ? ' is-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// silence unused helper warning in some builds
void ChartTipBox;
