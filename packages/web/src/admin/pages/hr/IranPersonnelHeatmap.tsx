import { formatNumFa } from '../../api';

/** Approximate centroids for Iran provinces on a 520×460 SVG canvas. */
const PROVINCE_POINTS: Record<string, { x: number; y: number }> = {
  تهران: { x: 278, y: 168 },
  البرز: { x: 258, y: 158 },
  اصفهان: { x: 268, y: 255 },
  فارس: { x: 255, y: 320 },
  'خراسان رضوی': { x: 390, y: 175 },
  'آذربایجان شرقی': { x: 165, y: 95 },
  خوزستان: { x: 195, y: 300 },
  مازندران: { x: 295, y: 120 },
  گیلان: { x: 240, y: 105 },
  کرمان: { x: 330, y: 310 },
  'آذربایجان غربی': { x: 125, y: 100 },
  کرمانشاه: { x: 155, y: 195 },
  همدان: { x: 200, y: 195 },
  مرکزی: { x: 230, y: 210 },
  قزوین: { x: 235, y: 155 },
  قم: { x: 255, y: 205 },
  یزد: { x: 310, y: 270 },
  سمنان: { x: 320, y: 175 },
  گلستان: { x: 335, y: 115 },
  اردبیل: { x: 195, y: 75 },
  زنجان: { x: 205, y: 140 },
  کردستان: { x: 155, y: 160 },
  لرستان: { x: 185, y: 230 },
  ایلام: { x: 150, y: 235 },
  بوشهر: { x: 220, y: 350 },
  هرمزگان: { x: 310, y: 380 },
  'سیستان و بلوچستان': { x: 400, y: 350 },
  'خراسان شمالی': { x: 370, y: 120 },
  'خراسان جنوبی': { x: 375, y: 250 },
  'چهارمحال و بختیاری': { x: 230, y: 260 },
  'کهگیلویه و بویراحمد': { x: 220, y: 295 },
};

type Row = { name: string; count: number };

export function IranPersonnelHeatmap({ rows }: { rows: Row[] }) {
  const max = Math.max(0, ...rows.map((r) => r.count));
  const ranked = [...rows].filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  const top = ranked[0] || null;

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
        <ul className="hr-heat-rank">
          {ranked.length ? (
            ranked.map((r) => {
              const hot = top && r.name === top.name;
              return (
                <li key={r.name} className={hot ? 'is-hot' : undefined}>
                  <span>{r.name}</span>
                  <strong>{formatNumFa(r.count)}</strong>
                </li>
              );
            })
          ) : (
            <li className="admin-muted">بدون داده</li>
          )}
        </ul>
      </aside>

      <div className="hr-heat-map" role="img" aria-label="نقشه حرارتی پرسنل ایران">
        <svg viewBox="0 0 520 460" className="hr-heat-svg">
          <defs>
            <linearGradient id="hrHeatSea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dbeafe" />
              <stop offset="100%" stopColor="#eff6ff" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="520" height="460" fill="url(#hrHeatSea)" rx="16" />
          {/* Simplified Iran landmass silhouette */}
          <path
            className="hr-heat-land"
            d="M118 78 C145 48 190 42 235 55 C280 40 330 48 375 70 C420 95 455 130 468 175
               C475 220 470 265 455 300 C440 345 410 385 360 405 C310 422 255 425 210 410
               C165 392 130 355 115 310 C95 260 90 210 98 165 C102 130 108 100 118 78 Z"
          />
          {Object.entries(PROVINCE_POINTS).map(([name, pt]) => {
            const row = rows.find((r) => r.name === name);
            const count = row?.count || 0;
            if (!count) {
              return (
                <circle
                  key={name}
                  cx={pt.x}
                  cy={pt.y}
                  r={5}
                  className="hr-heat-dot hr-heat-dot--empty"
                >
                  <title>{name}</title>
                </circle>
              );
            }
            const hot = max > 0 && count === max;
            const r = 8 + Math.round((count / Math.max(max, 1)) * 14);
            const intensity = 0.35 + (count / Math.max(max, 1)) * 0.65;
            return (
              <g key={name}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={r + 4}
                  className={hot ? 'hr-heat-glow hr-heat-glow--hot' : 'hr-heat-glow'}
                />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={r}
                  className={hot ? 'hr-heat-dot hr-heat-dot--hot' : 'hr-heat-dot hr-heat-dot--active'}
                  style={{ opacity: intensity }}
                >
                  <title>
                    {name}: {count} استخدام
                  </title>
                </circle>
                <text x={pt.x} y={pt.y + r + 12} textAnchor="middle" className="hr-heat-label">
                  {name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
