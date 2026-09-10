/** Lightweight SVG charts for admin finance — no chart.js dependency. */

type Point = { label: string; value: number };

function maxOf(points: Point[], min = 1) {
  return Math.max(min, ...points.map((p) => p.value));
}

export function AdminBarChart({
  points,
  height = 180,
  color = '#5c4d91',
}: {
  points: Point[];
  height?: number;
  color?: string;
}) {
  if (!points.length) {
    return <p className="admin-muted">داده‌ای برای نمودار نیست</p>;
  }
  const max = maxOf(points);
  const barW = Math.max(8, Math.min(28, Math.floor(520 / Math.max(points.length, 1)) - 4));
  const gap = 6;
  const width = points.length * (barW + gap) + 20;
  return (
    <div className="admin-chart-scroll">
      <svg viewBox={`0 0 ${width} ${height + 36}`} className="admin-chart-svg" role="img">
        {points.map((p, i) => {
          const h = Math.round((p.value / max) * height);
          const x = 10 + i * (barW + gap);
          const y = height - h + 8;
          return (
            <g key={`${p.label}-${i}`}>
              <rect x={x} y={y} width={barW} height={Math.max(2, h)} rx={3} fill={color} opacity={0.9} />
              <title>{`${p.label}: ${p.value.toLocaleString('fa-IR')}`}</title>
              {points.length <= 14 ? (
                <text x={x + barW / 2} y={height + 28} textAnchor="middle" className="admin-chart-axis">
                  {p.label.slice(5) || p.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function AdminLineChart({
  points,
  height = 180,
  color = '#5c4d91',
}: {
  points: Point[];
  height?: number;
  color?: string;
}) {
  if (!points.length) {
    return <p className="admin-muted">داده‌ای برای نمودار نیست</p>;
  }
  const max = maxOf(points);
  const width = 560;
  const padX = 12;
  const padY = 12;
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
      <svg viewBox={`0 0 ${width} ${height + 28}`} className="admin-chart-svg" role="img">
        <path d={area} fill={color} opacity={0.12} />
        <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
        {coords.map((c, i) => (
          <g key={`${c.label}-${i}`}>
            <circle cx={c.x} cy={c.y} r={3.2} fill={color} />
            <title>{`${c.label}: ${c.value.toLocaleString('fa-IR')}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function AdminDonutChart({
  slices,
  size = 160,
}: {
  slices: Array<{ label: string; value: number; color: string }>;
  size?: number;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = 56;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="admin-donut-wrap">
      <svg width={size} height={size} viewBox="0 0 140 140" className="admin-chart-svg">
        <g transform="translate(70,70) rotate(-90)">
          {slices.map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label}
                r={r}
                cx={0}
                cy={0}
                fill="transparent"
                stroke={s.color}
                strokeWidth={18}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </g>
        <text x="70" y="68" textAnchor="middle" className="admin-donut-center">
          {total.toLocaleString('fa-IR')}
        </text>
        <text x="70" y="84" textAnchor="middle" className="admin-donut-sub">
          جمع
        </text>
      </svg>
      <ul className="admin-donut-legend">
        {slices.map((s) => (
          <li key={s.label}>
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
