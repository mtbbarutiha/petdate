import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { formatNumFa } from '../../api';
import { IRAN_MAP_VIEWBOX, IRAN_PROVINCE_PATHS, type IranProvincePath } from './iranProvincePaths';

type Row = { name: string; count: number };

type HoverState = {
  prov: IranProvincePath;
  count: number;
  pct: number | null;
  rank: number | null;
  x: number;
  y: number;
};

/** Single-hue teal intensity: empty → light slate, max → deep teal. */
function heatFill(count: number, max: number): string {
  if (count <= 0 || max <= 0) return '#e8eef4';
  const t = count / max;
  const r = Math.round(204 + (15 - 204) * t);
  const g = Math.round(232 + (118 - 232) * t);
  const b = Math.round(228 + (110 - 228) * t);
  return `rgb(${r},${g},${b})`;
}

function heatStroke(count: number, max: number, hovered: boolean): string {
  if (hovered) return '#0f766e';
  if (count <= 0 || max <= 0) return '#b8c4d4';
  const t = count / max;
  return t > 0.55 ? '#0f766e' : '#7a93ab';
}

function labelFill(count: number, max: number): string {
  if (count <= 0 || max <= 0) return '#64748b';
  return count / max > 0.55 ? '#f0fdfa' : '#0f3f3c';
}

export function IranPersonnelHeatmap({
  rows,
  unknownCount = 0,
}: {
  rows: Row[];
  /** Hired with empty / نامشخص province — shown in sidebar, not on map. */
  unknownCount?: number;
}) {
  const tipId = useId();
  const mapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

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

  const placeTip = useCallback((clientX: number, clientY: number, prov: IranProvincePath) => {
    const el = mapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const count = byName.get(prov.name) || 0;
    const pct = mappedTotal > 0 && count > 0 ? Math.round((count / mappedTotal) * 100) : null;
    const rank = rankByName.get(prov.name) ?? null;
    // Keep tooltip inside the map pane
    const pad = 12;
    let x = clientX - rect.left + 14;
    let y = clientY - rect.top + 14;
    const tipW = 200;
    const tipH = 96;
    if (x + tipW > rect.width - pad) x = clientX - rect.left - tipW - 10;
    if (y + tipH > rect.height - pad) y = clientY - rect.top - tipH - 10;
    x = Math.max(pad, Math.min(x, rect.width - tipW - pad));
    y = Math.max(pad, Math.min(y, rect.height - tipH - pad));
    setHover({ prov, count, pct, rank, x, y });
  }, [byName, mappedTotal, rankByName]);

  const clearTip = useCallback(() => setHover(null), []);

  return (
    <div className="hr-heat-layout">
      <aside className="hr-heat-legend-card" aria-label="رتبه‌بندی استان‌ها">
        {top ? (
          <p className="hr-heat-top">
            استان با بیشترین استخدام: <strong>{top.name}</strong> ({formatNumFa(top.count)} نفر)
          </p>
        ) : (
          <p className="hr-heat-top admin-muted">هنوز استانی با استخدام ثبت نشده</p>
        )}
        <p className="hr-heat-scale" aria-hidden>
          <span className="hr-heat-scale-swatch" />
          تیره‌تر = استخدام بیشتر
        </p>
        <ul className="hr-heat-rank">
          {ranked.length ? (
            ranked.map((r) => {
              const hot = top && r.name === top.name;
              return (
                <li key={r.name} className={hot ? 'is-hot' : undefined}>
                  <span className="hr-heat-rank-name">
                    <i
                      className="hr-heat-rank-swatch"
                      style={{ background: heatFill(r.count, max) }}
                      aria-hidden
                    />
                    {r.name}
                  </span>
                  <strong>{formatNumFa(r.count)}</strong>
                </li>
              );
            })
          ) : (
            <li className="admin-muted">بدون داده</li>
          )}
          {unknownCount > 0 ? (
            <li className="hr-heat-rank-unknown">
              <span>بدون استان</span>
              <strong>{formatNumFa(unknownCount)}</strong>
            </li>
          ) : null}
        </ul>
        {(mappedTotal > 0 || unknownCount > 0) && (
          <p className="hr-heat-sum admin-muted">
            جمع استان‌ها {formatNumFa(mappedTotal)}
            {unknownCount > 0 ? ` + بدون استان ${formatNumFa(unknownCount)}` : ''}
          </p>
        )}
      </aside>

      <div
        ref={mapRef}
        className="hr-heat-map"
        role="img"
        aria-label="نقشه حرارتی استخدام بر اساس استان‌های ایران"
        onMouseLeave={clearTip}
      >
        <svg
          viewBox={IRAN_MAP_VIEWBOX}
          className="hr-heat-svg"
          preserveAspectRatio="xMidYMid meet"
          shapeRendering="geometricPrecision"
        >
          <defs>
            <linearGradient id={`${tipId}-sea`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#eaf2fb" />
              <stop offset="100%" stopColor="#f7f9fc" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="800" height="730" fill={`url(#${tipId}-sea)`} rx="14" />
          <g className="hr-heat-provinces">
            {IRAN_PROVINCE_PATHS.map((prov) => {
              const count = byName.get(prov.name) || 0;
              const active = count > 0;
              const hovered = hover?.prov.name === prov.name;
              return (
                <path
                  key={prov.name}
                  d={prov.d}
                  className={
                    active
                      ? 'hr-heat-province hr-heat-province--active'
                      : 'hr-heat-province'
                  }
                  fill={heatFill(count, max)}
                  stroke={heatStroke(count, max, hovered)}
                  strokeWidth={hovered ? 1.85 : active ? 1.25 : 0.95}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  aria-describedby={hovered ? tipId : undefined}
                  onMouseEnter={(e) => placeTip(e.clientX, e.clientY, prov)}
                  onMouseMove={(e) => placeTip(e.clientX, e.clientY, prov)}
                  onFocus={(e) => {
                    const rect = (e.target as SVGPathElement).getBoundingClientRect();
                    placeTip(rect.left + rect.width / 2, rect.top + rect.height / 2, prov);
                  }}
                  onBlur={clearTip}
                  tabIndex={0}
                />
              );
            })}
          </g>

          <g className="hr-heat-labels" pointerEvents="none" aria-hidden>
            {IRAN_PROVINCE_PATHS.map((prov) => {
              const count = byName.get(prov.name) || 0;
              const active = count > 0;
              const hovered = hover?.prov.name === prov.name;
              // Always label hired provinces; large empty ones at rest; small empty on hover.
              if (!active && !hovered && prov.area < 9000) return null;
              const [lx, ly] = prov.label;
              const text = active || hovered ? prov.name : prov.shortLabel;
              const fill = hovered ? '#0f766e' : labelFill(count, max);
              const chipW = Math.min(118, 18 + text.length * 6.2 + (active ? 20 : 0));
              return (
                <g key={`lbl-${prov.name}`} className={active ? 'hr-heat-label is-active' : 'hr-heat-label'}>
                  {active || hovered ? (
                    <rect
                      x={lx - chipW / 2}
                      y={ly - 11}
                      width={chipW}
                      height={22}
                      rx={6}
                      className="hr-heat-label-bg"
                      fill={
                        active && count / Math.max(max, 1) > 0.55
                          ? 'rgba(15,118,110,0.58)'
                          : 'rgba(255,255,255,0.78)'
                      }
                      stroke="rgba(15,118,110,0.2)"
                      strokeWidth={0.85}
                    />
                  ) : null}
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="hr-heat-label-text"
                    fill={fill}
                    fontSize={active ? 11.5 : hovered ? 11 : 9.5}
                    fontWeight={active || hovered ? 700 : 500}
                    opacity={active || hovered ? 1 : 0.7}
                  >
                    {active ? `${text} · ${formatNumFa(count)}` : text}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {hover ? (
          <div
            id={tipId}
            className="hr-heat-tooltip"
            role="tooltip"
            style={{ left: hover.x, top: hover.y }}
          >
            <div className="hr-heat-tooltip-name">{hover.prov.name}</div>
            <div className="hr-heat-tooltip-row">
              <span>تعداد استخدام</span>
              <strong>
                {hover.count > 0 ? `${formatNumFa(hover.count)} نفر` : 'بدون استخدام'}
              </strong>
            </div>
            {hover.pct != null ? (
              <div className="hr-heat-tooltip-row">
                <span>سهم از استان‌ها</span>
                <strong>{formatNumFa(hover.pct)}٪</strong>
              </div>
            ) : null}
            {hover.rank != null ? (
              <div className="hr-heat-tooltip-row">
                <span>رتبه</span>
                <strong>{formatNumFa(hover.rank)} از {formatNumFa(ranked.length)}</strong>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
