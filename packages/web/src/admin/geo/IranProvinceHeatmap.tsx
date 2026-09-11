import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { formatNumFa } from '../api';
import { IRAN_MAP_VIEWBOX, IRAN_PROVINCE_PATHS, type IranProvincePath } from './iranProvincePaths';

export type IranHeatRow = { name: string; count: number };

export type IranProvinceHeatmapCopy = {
  /** e.g. استخدام / کاربر */
  metric: string;
  /** Sidebar top line when a province leads. Use {name} and {count}. */
  topTemplate: string;
  /** Empty sidebar message. */
  emptyTop: string;
  /** Legend caption after the gradient swatch. */
  scaleLabel: string;
  /** Map aria-label. */
  mapAria: string;
  /** Tooltip count row label. */
  tipCountLabel: string;
  /** Tooltip empty count. */
  tipEmpty: string;
  /** Unit after count, e.g. نفر */
  unit: string;
};

type HoverState = {
  prov: IranProvincePath;
  count: number;
  pct: number | null;
  rank: number | null;
  x: number;
  y: number;
};

/**
 * Pepito mint heat scale: empty → cool slate, max → deep mint (#0a8f70).
 * Avoids generic purple-AI; stays in Pepito --admin-mint family.
 */
function heatFill(count: number, max: number): string {
  if (count <= 0 || max <= 0) return '#e6edf4';
  const t = Math.pow(count / max, 0.85);
  const stops = [
    { t: 0, c: [216, 245, 238] },
    { t: 0.45, c: [21, 204, 160] },
    { t: 1, c: [10, 143, 112] },
  ];
  let a = stops[0];
  let b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const u = (t - a.t) / Math.max(0.0001, b.t - a.t);
  const r = Math.round(a.c[0] + (b.c[0] - a.c[0]) * u);
  const g = Math.round(a.c[1] + (b.c[1] - a.c[1]) * u);
  const bl = Math.round(a.c[2] + (b.c[2] - a.c[2]) * u);
  return `rgb(${r},${g},${bl})`;
}

function heatStroke(count: number, max: number, emphasized: boolean): string {
  if (emphasized) return '#0a8f70';
  if (count <= 0 || max <= 0) return '#b7c5d6';
  const t = count / max;
  return t > 0.5 ? '#0a8f70' : '#7d94aa';
}

function labelFill(count: number, max: number, emphasized: boolean): string {
  if (emphasized) return '#064e3b';
  if (count <= 0 || max <= 0) return '#64748b';
  return count / max > 0.55 ? '#ecfdf8' : '#064e3b';
}

function chipBg(count: number, max: number, emphasized: boolean): string {
  if (emphasized) return 'rgba(255,255,255,0.94)';
  if (count <= 0) return 'rgba(255,255,255,0.82)';
  return count / Math.max(max, 1) > 0.55
    ? 'rgba(10,143,112,0.72)'
    : 'rgba(255,255,255,0.9)';
}

export function IranProvinceHeatmap({
  rows,
  unknownCount = 0,
  copy,
}: {
  rows: IranHeatRow[];
  /** Count with empty / نامشخص province — sidebar only. */
  unknownCount?: number;
  copy: IranProvinceHeatmapCopy;
}) {
  const tipId = useId();
  const mapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  const byName = useMemo(() => new Map(rows.map((r) => [r.name, r.count])), [rows]);
  const max = Math.max(0, ...rows.map((r) => r.count));
  const ranked = useMemo(
    () => [...rows].filter((r) => r.count > 0).sort((a, b) => b.count - a.count),
    [rows]
  );
  const rankByName = useMemo(() => {
    const m = new Map<string, number>();
    ranked.forEach((r, i) => m.set(r.name, i + 1));
    return m;
  }, [ranked]);
  const top = ranked[0] || null;
  const mappedTotal = ranked.reduce((s, r) => s + r.count, 0);
  const hasData = mappedTotal > 0 || unknownCount > 0;

  const placeTip = useCallback(
    (clientX: number, clientY: number, prov: IranProvincePath) => {
      const el = mapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const count = byName.get(prov.name) || 0;
      const pct = mappedTotal > 0 && count > 0 ? Math.round((count / mappedTotal) * 100) : null;
      const rank = rankByName.get(prov.name) ?? null;
      const pad = 12;
      let x = clientX - rect.left + 14;
      let y = clientY - rect.top + 14;
      const tipW = 210;
      const tipH = 110;
      if (x + tipW > rect.width - pad) x = clientX - rect.left - tipW - 10;
      if (y + tipH > rect.height - pad) y = clientY - rect.top - tipH - 10;
      x = Math.max(pad, Math.min(x, rect.width - tipW - pad));
      y = Math.max(pad, Math.min(y, rect.height - tipH - pad));
      setHover({ prov, count, pct, rank, x, y });
    },
    [byName, mappedTotal, rankByName]
  );

  const clearTip = useCallback(() => setHover(null), []);

  const emphasize = (name: string) => hover?.prov.name === name || pinned === name;

  const topText = top
    ? copy.topTemplate
        .replace('{name}', top.name)
        .replace('{count}', formatNumFa(top.count))
    : copy.emptyTop;

  return (
    <div className="iran-heat-layout">
      <aside className="iran-heat-legend-card" aria-label="رتبه‌بندی استان‌ها">
        <p className={`iran-heat-top${top ? '' : ' admin-muted'}`}>
          {top ? (
            <>
              {topText.split(top.name)[0]}
              <strong>{top.name}</strong>
              {topText.split(top.name)[1] || ''}
            </>
          ) : (
            topText
          )}
        </p>
        <div className="iran-heat-scale" aria-hidden>
          <span className="iran-heat-scale-min">کم</span>
          <span className="iran-heat-scale-swatch" />
          <span className="iran-heat-scale-max">زیاد</span>
          <span className="iran-heat-scale-caption">{copy.scaleLabel}</span>
        </div>

        {!hasData ? (
          <div className="iran-heat-empty" role="status">
            <span className="iran-heat-empty-icon" aria-hidden />
            <p>هنوز پراکندگی استانی ثبت نشده است</p>
          </div>
        ) : (
          <ul className="iran-heat-rank">
            {ranked.map((r) => {
              const hot = top && r.name === top.name;
              const selected = pinned === r.name;
              const share = mappedTotal > 0 ? Math.round((r.count / mappedTotal) * 100) : 0;
              return (
                <li
                  key={r.name}
                  className={
                    [hot ? 'is-hot' : '', selected ? 'is-selected' : '']
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                >
                  <button
                    type="button"
                    className="iran-heat-rank-btn"
                    onClick={() => setPinned((p) => (p === r.name ? null : r.name))}
                    onMouseEnter={() => {
                      const prov = IRAN_PROVINCE_PATHS.find((p) => p.name === r.name);
                      const el = mapRef.current;
                      if (!prov || !el) return;
                      const rect = el.getBoundingClientRect();
                      const [lx, ly] = prov.label;
                      const sx = rect.width / 800;
                      const sy = rect.height / 730;
                      placeTip(rect.left + lx * sx, rect.top + ly * sy, prov);
                    }}
                    onMouseLeave={clearTip}
                  >
                    <span className="iran-heat-rank-name">
                      <i
                        className="iran-heat-rank-swatch"
                        style={{ background: heatFill(r.count, max) }}
                        aria-hidden
                      />
                      {r.name}
                    </span>
                    <span className="iran-heat-rank-meta">
                      <strong>{formatNumFa(r.count)}</strong>
                      <span className="iran-heat-rank-bar" aria-hidden>
                        <i style={{ width: `${Math.max(8, share)}%` }} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {unknownCount > 0 ? (
              <li className="iran-heat-rank-unknown" aria-label="بدون استان">
                <span className="iran-heat-rank-row" role="presentation">
                  <span className="iran-heat-rank-name">
                    <i
                      className="iran-heat-rank-swatch iran-heat-rank-swatch--unknown"
                      aria-hidden
                    />
                    بدون استان
                  </span>
                  <span className="iran-heat-rank-meta">
                    <strong>{formatNumFa(unknownCount)}</strong>
                    <span className="iran-heat-rank-bar iran-heat-rank-bar--unknown" aria-hidden>
                      <i
                        style={{
                          width: `${Math.max(
                            8,
                            Math.round(
                              (unknownCount / Math.max(mappedTotal + unknownCount, 1)) * 100
                            )
                          )}%`,
                        }}
                      />
                    </span>
                  </span>
                </span>
              </li>
            ) : null}
          </ul>
        )}
        {hasData ? (
          <p className="iran-heat-sum admin-muted">
            جمع استان‌ها {formatNumFa(mappedTotal)}
            {unknownCount > 0 ? ` + بدون استان ${formatNumFa(unknownCount)}` : ''}
          </p>
        ) : null}
      </aside>

      <div
        ref={mapRef}
        className="iran-heat-map"
        role="img"
        aria-label={copy.mapAria}
        onMouseLeave={clearTip}
      >
        <svg
          viewBox={IRAN_MAP_VIEWBOX}
          className="iran-heat-svg"
          preserveAspectRatio="xMidYMid meet"
          shapeRendering="geometricPrecision"
        >
          <defs>
            <linearGradient id={`${tipId}-sea`} x1="0" y1="0" x2="0.15" y2="1">
              <stop offset="0%" stopColor="var(--iran-heat-sea-0, #e7f1fb)" />
              <stop offset="55%" stopColor="var(--iran-heat-sea-1, #f3f7fb)" />
              <stop offset="100%" stopColor="var(--iran-heat-sea-2, #f8fafc)" />
            </linearGradient>
            <filter id={`${tipId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="1.2"
                stdDeviation="2.2"
                floodColor="#0a8f70"
                floodOpacity="0.28"
              />
            </filter>
            <pattern id={`${tipId}-grid`} width="28" height="28" patternUnits="userSpaceOnUse">
              <path
                d="M28 0H0V28"
                fill="none"
                stroke="rgba(148,163,184,0.12)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect x="0" y="0" width="800" height="730" fill={`url(#${tipId}-sea)`} rx="16" />
          <rect
            x="0"
            y="0"
            width="800"
            height="730"
            fill={`url(#${tipId}-grid)`}
            rx="16"
            opacity="0.7"
          />

          <g className="iran-heat-provinces">
            {IRAN_PROVINCE_PATHS.map((prov) => {
              const count = byName.get(prov.name) || 0;
              const active = count > 0;
              const emph = emphasize(prov.name);
              return (
                <path
                  key={prov.name}
                  d={prov.d}
                  className={
                    active
                      ? 'iran-heat-province iran-heat-province--active'
                      : 'iran-heat-province'
                  }
                  fill={heatFill(count, max)}
                  stroke={heatStroke(count, max, emph)}
                  strokeWidth={emph ? 2 : active ? 1.3 : 0.95}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  filter={emph ? `url(#${tipId}-glow)` : undefined}
                  aria-describedby={emph && hover ? tipId : undefined}
                  onMouseEnter={(e) => placeTip(e.clientX, e.clientY, prov)}
                  onMouseMove={(e) => placeTip(e.clientX, e.clientY, prov)}
                  onFocus={(e) => {
                    const rect = (e.target as SVGPathElement).getBoundingClientRect();
                    placeTip(rect.left + rect.width / 2, rect.top + rect.height / 2, prov);
                  }}
                  onBlur={clearTip}
                  onClick={() => setPinned((p) => (p === prov.name ? null : prov.name))}
                  tabIndex={0}
                />
              );
            })}
          </g>

          <g className="iran-heat-labels" pointerEvents="none" aria-hidden>
            {IRAN_PROVINCE_PATHS.map((prov) => {
              const count = byName.get(prov.name) || 0;
              const active = count > 0;
              const emph = emphasize(prov.name);
              if (!active && !emph && prov.area < 9000) return null;
              const [lx, ly] = prov.label;
              const text = active || emph ? prov.name : prov.shortLabel;
              const fill = labelFill(count, max, emph);
              const countPart = active ? ` — ${formatNumFa(count)}` : '';
              const label = `${text}${countPart}`;
              const chipW = Math.min(132, 22 + label.length * 6.4 + (active ? 14 : 0));
              return (
                <g
                  key={`lbl-${prov.name}`}
                  className={active ? 'iran-heat-label is-active' : 'iran-heat-label'}
                >
                  {active || emph ? (
                    <>
                      <rect
                        x={lx - chipW / 2}
                        y={ly - 12}
                        width={chipW}
                        height={24}
                        rx={8}
                        className="iran-heat-label-bg"
                        fill={chipBg(count, max, emph)}
                        stroke="rgba(10,143,112,0.22)"
                        strokeWidth={0.9}
                      />
                      {active ? (
                        <rect
                          x={lx - chipW / 2 + 6}
                          y={ly - 4}
                          width={8}
                          height={8}
                          rx={2}
                          fill={heatFill(count, max)}
                          stroke="rgba(255,255,255,0.55)"
                          strokeWidth={0.6}
                        />
                      ) : null}
                    </>
                  ) : null}
                  <text
                    x={active ? lx + 4 : lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="iran-heat-label-text"
                    fill={fill}
                    fontSize={active ? 11.5 : emph ? 11 : 9.5}
                    fontWeight={active || emph ? 700 : 500}
                    opacity={active || emph ? 1 : 0.68}
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {hover ? (
          <div
            id={tipId}
            className="iran-heat-tooltip"
            role="tooltip"
            style={{ left: hover.x, top: hover.y }}
          >
            <div className="iran-heat-tooltip-name">
              <i style={{ background: heatFill(hover.count, max) }} aria-hidden />
              {hover.prov.name}
            </div>
            <div className="iran-heat-tooltip-row">
              <span>{copy.tipCountLabel}</span>
              <strong>
                {hover.count > 0
                  ? `${formatNumFa(hover.count)} ${copy.unit}`
                  : copy.tipEmpty}
              </strong>
            </div>
            {hover.pct != null ? (
              <div className="iran-heat-tooltip-row">
                <span>سهم از استان‌ها</span>
                <strong>{formatNumFa(hover.pct)}٪</strong>
              </div>
            ) : null}
            {hover.rank != null ? (
              <div className="iran-heat-tooltip-row">
                <span>رتبه</span>
                <strong>
                  {formatNumFa(hover.rank)} از {formatNumFa(ranked.length)}
                </strong>
              </div>
            ) : null}
            {hover.count > 0 && max > 0 ? (
              <div className="iran-heat-tooltip-meter" aria-hidden>
                <i style={{ width: `${Math.round((hover.count / max) * 100)}%` }} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const HR_HEATMAP_COPY: IranProvinceHeatmapCopy = {
  metric: 'استخدام',
  topTemplate: 'استان با بیشترین استخدام: {name} ({count} نفر)',
  emptyTop: 'هنوز استانی با استخدام ثبت نشده',
  scaleLabel: 'تیره‌تر = استخدام بیشتر',
  mapAria: 'نقشه حرارتی استخدام بر اساس استان‌های ایران',
  tipCountLabel: 'تعداد استخدام',
  tipEmpty: 'بدون استخدام',
  unit: 'نفر',
};

export const USERS_HEATMAP_COPY: IranProvinceHeatmapCopy = {
  metric: 'کاربر',
  topTemplate: 'استان با بیشترین کاربر: {name} ({count} نفر)',
  emptyTop: 'هنوز استانی با کاربر ثبت نشده',
  scaleLabel: 'تیره‌تر = کاربر بیشتر',
  mapAria: 'نقشه حرارتی پراکندگی کاربران بر اساس استان‌های ایران',
  tipCountLabel: 'تعداد کاربر',
  tipEmpty: 'بدون کاربر',
  unit: 'نفر',
};
