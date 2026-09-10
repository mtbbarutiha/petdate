import { formatNumFa } from '../../api';
import { IRAN_MAP_VIEWBOX, IRAN_PROVINCE_PATHS } from './iranProvincePaths';

type Row = { name: string; count: number };

/** Single-hue teal intensity: empty → light slate, max → deep teal. */
function heatFill(count: number, max: number): string {
  if (count <= 0 || max <= 0) return '#e8eef4';
  const t = count / max;
  // Mix #cce8e4 → #0f766e (teal-700)
  const r = Math.round(204 + (15 - 204) * t);
  const g = Math.round(232 + (118 - 232) * t);
  const b = Math.round(228 + (110 - 228) * t);
  return `rgb(${r},${g},${b})`;
}

function heatStroke(count: number, max: number): string {
  if (count <= 0 || max <= 0) return '#cbd5e1';
  const t = count / max;
  return t > 0.55 ? '#0f766e' : '#94a3b8';
}

export function IranPersonnelHeatmap({
  rows,
  unknownCount = 0,
}: {
  rows: Row[];
  /** Hired with empty / نامشخص province — shown in sidebar, not on map. */
  unknownCount?: number;
}) {
  const byName = new Map(rows.map((r) => [r.name, r.count]));
  const max = Math.max(0, ...rows.map((r) => r.count));
  const ranked = [...rows].filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  const top = ranked[0] || null;
  const mappedTotal = ranked.reduce((s, r) => s + r.count, 0);

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

      <div className="hr-heat-map" role="img" aria-label="نقشه حرارتی استخدام بر اساس استان‌های ایران">
        <svg viewBox={IRAN_MAP_VIEWBOX} className="hr-heat-svg" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="hrHeatSea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8f1fb" />
              <stop offset="100%" stopColor="#f4f7fb" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="798" height="724" fill="url(#hrHeatSea)" rx="12" />
          <g className="hr-heat-provinces">
            {IRAN_PROVINCE_PATHS.map((prov) => {
              const count = byName.get(prov.name) || 0;
              const active = count > 0;
              return (
                <path
                  key={prov.name}
                  d={prov.d}
                  className={active ? 'hr-heat-province hr-heat-province--active' : 'hr-heat-province'}
                  fill={heatFill(count, max)}
                  stroke={heatStroke(count, max)}
                  strokeWidth={active ? 1.6 : 1}
                >
                  <title>
                    {prov.name}
                    {count > 0 ? `: ${count} استخدام` : ': بدون استخدام'}
                  </title>
                </path>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
