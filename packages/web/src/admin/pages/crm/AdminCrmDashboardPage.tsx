import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CrmDashboard, CrmKpiRing } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';

const STANDING_COLOR: Record<string, string> = {
  'در مسیر درست': '#15cca0',
  'نیازمند تلاش بیشتر': '#fd961e',
  ضعیف: '#c62828',
};

function GaugeSemi({ pct, standing }: { pct: number; standing: string }) {
  const color = STANDING_COLOR[standing] || '#c62828';
  const clamped = Math.max(0, Math.min(100, pct));
  // semicircle path via stroke-dasharray on 180deg arc
  const r = 70;
  const c = Math.PI * r;
  const filled = (clamped / 100) * c;
  return (
    <div className="crm-gauge" aria-label={`تحقق ${pct} درصد`}>
      <svg viewBox="0 0 180 110" width="180" height="110">
        <path
          d="M 20 95 A 70 70 0 0 1 160 95"
          fill="none"
          stroke="var(--admin-border)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 20 95 A 70 70 0 0 1 160 95"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
        />
        <text x="90" y="78" textAnchor="middle" className="crm-gauge-value" fill={color}>
          {formatNumFa(clamped)}٪
        </text>
        <text x="90" y="98" textAnchor="middle" className="crm-gauge-sub" fill="var(--admin-muted)">
          تحقق کلی شاخص‌ها
        </text>
      </svg>
      <span className="crm-standing-pill" style={{ background: `${color}22`, color, borderColor: `${color}55` }}>
        {standing}
      </span>
    </div>
  );
}

function KpiRing({ kpi }: { kpi: CrmKpiRing }) {
  const color = STANDING_COLOR[kpi.standing] || '#c62828';
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(150, kpi.pct));
  const filled = (Math.min(100, pct) / 100) * circ;
  return (
    <div className="crm-kpi-ring">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--admin-border)" strokeWidth="7" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          transform="rotate(-90 36 36)"
        />
        <text x="36" y="34" textAnchor="middle" className="crm-kpi-ring-num" fill="var(--admin-ink)">
          {formatNumFa(kpi.value)}
        </text>
        <text x="36" y="48" textAnchor="middle" className="crm-kpi-ring-target" fill="var(--admin-muted)">
          از {formatNumFa(kpi.target)}
        </text>
      </svg>
      <div className="crm-kpi-ring-label">{kpi.label}</div>
      <div className="admin-muted" style={{ fontSize: 11 }}>{kpi.unit}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="crm-chart-tooltip">
      {label ? <div className="crm-chart-tooltip-label">{label}</div> : null}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--admin-ink)' }}>
          {formatNumFa(Number(p.value))}
        </div>
      ))}
    </div>
  );
}

export function AdminCrmDashboardPage() {
  const [data, setData] = useState<CrmDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void adminFetch<CrmDashboard>('/api/admin/crm/workspace')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'خطا'));
  }, []);

  const ticketPie = useMemo(
    () => (data?.ticketStatus || []).filter((s) => s.value > 0).map((s) => ({ ...s, name: s.label })),
    [data]
  );

  if (error) return <div className="admin-page"><p className="admin-error">{error}</p></div>;
  if (!data) return <div className="admin-page"><p>در حال بارگذاری…</p></div>;

  const completeFollowup = (id: number) => {
    void adminFetch(`/api/admin/crm/followups/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ result: 'انجام شد از میز کار' }),
    }).then(() =>
      adminFetch<CrmDashboard>('/api/admin/crm/workspace').then(setData)
    );
  };

  return (
    <div className="admin-page crm-workspace">
      <header className="admin-header crm-workspace-header">
        <div>
          <h1>میز کار من</h1>
          <p>
            {data.dateLabel} · {data.greetingName} · {data.roleLabel} · داده‌ها لحظه‌ای
          </p>
        </div>
        <div className="crm-header-badges">
          <span className="crm-badge crm-badge--danger">{formatNumFa(data.breachedSla)} نقض SLA</span>
          <span className="crm-badge">{formatNumFa(data.qaQueue)} در صف ارزیابی</span>
          <Link className="admin-btn admin-btn--primary" to="/admin/crm/inbox">اینباکس</Link>
        </div>
      </header>

      <section className="admin-card crm-kpi-panel">
        <div className="admin-card-head">
          <h2>وضعیت من نسبت به شاخص‌ها</h2>
          <span className="admin-muted">۷ روز اخیر</span>
        </div>
        <div className="crm-kpi-layout">
          <GaugeSemi pct={data.overallAchievement} standing={data.overallStanding} />
          <div className="crm-kpi-rings">
            {data.kpis.map((k) => (
              <KpiRing key={k.key} kpi={k} />
            ))}
          </div>
          <div className="crm-kpi-legend">
            <div className="crm-legend-item" style={{ borderColor: '#15cca055', background: '#15cca014' }}>
              <strong style={{ color: '#0f9a78' }}>در مسیر درست</strong>
              <span>۹۰٪ و بالاتر</span>
            </div>
            <div className="crm-legend-item" style={{ borderColor: '#fd961e55', background: '#fd961e14' }}>
              <strong style={{ color: '#c77810' }}>نیازمند تلاش بیشتر</strong>
              <span>۷۰٪ تا ۹۰٪</span>
            </div>
            <div className="crm-legend-item" style={{ borderColor: '#c6282855', background: '#c6282814' }}>
              <strong style={{ color: '#c62828' }}>ضعیف</strong>
              <span>زیر ۷۰٪</span>
            </div>
          </div>
        </div>
        {data.weakPoints.length ? (
          <div className="crm-weak-points">
            <strong>نقاط ضعف:</strong> {data.weakPoints.join(' · ')}
          </div>
        ) : (
          <div className="crm-weak-points crm-weak-points--ok">همه شاخص‌ها در مسیر مطلوب هستند.</div>
        )}
      </section>

      <div className="crm-charts-row">
        <section className="admin-card">
          <div className="admin-card-head"><h2>توزیع کانال‌ها</h2></div>
          <div className="crm-chart-box">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.channelDistribution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#757086' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#757086' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" radius={[8, 8, 4, 4]} fill="#5c4d91" maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card-head"><h2>حجم تعامل ۷ روز اخیر</h2></div>
          <div className="crm-chart-box">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.dailyInteractions} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="crmArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#15cca0" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#15cca0" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#757086' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#757086' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#15cca0" strokeWidth={2.5} fill="url(#crmArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card-head"><h2>وضعیت تیکت‌ها</h2></div>
          <div className="crm-donut-wrap">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={ticketPie.length ? ticketPie : [{ name: 'خالی', value: 1, color: '#e4e2f3' }]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={2}
                >
                  {(ticketPie.length ? ticketPie : [{ color: '#e4e2f3' }]).map((s, i) => (
                    <Cell key={i} fill={s.color || '#5c4d91'} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="crm-donut-center">
              <strong>{formatNumFa(data.openTickets)}</strong>
              <span>تیکت باز</span>
            </div>
            <ul className="crm-donut-legend">
              {data.ticketStatus.map((s) => (
                <li key={s.key}>
                  <i style={{ background: s.color || '#5c4d91' }} />
                  {s.label}
                  <span>{formatNumFa(s.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <div className="crm-bottom-row">
        <section className="admin-card crm-bottom-main">
          <div className="admin-card-head"><h2>تیکت‌های من</h2></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>شناسه</th>
                  <th>عنوان</th>
                  <th>مشتری</th>
                  <th>اولویت</th>
                  <th>وضعیت</th>
                  <th>کارشناس</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {data.myTickets.map((t) => (
                  <tr key={t.id} style={{ borderRight: `3px solid ${t.borderColor || 'var(--admin-border)'}` }}>
                    <td className="admin-muted">
                      <Link to={`/admin/crm/ticketing?view=detail&id=${t.id}`}>{t.publicId}</Link>
                    </td>
                    <td><Link to={`/admin/crm/ticketing?view=detail&id=${t.id}`}>{t.title}</Link></td>
                    <td>{t.customerName || '—'}</td>
                    <td><span className="crm-prio">{t.priority}</span></td>
                    <td>{t.status}</td>
                    <td>{t.agentName || '—'}</td>
                    <td>
                      <span className={`crm-sla crm-sla--${t.slaState || 'ok'}`}>
                        {t.slaState === 'breached' ? 'نقض SLA' : t.slaState === 'at_risk' ? 'در معرض' : t.slaState === 'closed' ? 'بسته' : 'سالم'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!data.myTickets.length ? <tr><td colSpan={7}>تیکت بازی نیست</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className="crm-bottom-side">
          <section className="admin-card">
            <div className="admin-card-head"><h2>پیگیری‌های نزدیک</h2></div>
            {data.upcomingFollowups.length ? (
              <ul className="crm-fu-list">
                {data.upcomingFollowups.map((f) => {
                  const overdue = new Date(f.dueAt).getTime() < Date.now();
                  return (
                    <li key={f.id}>
                      <div>
                        <strong>{f.description || f.kind}</strong>
                        <div className="admin-muted">{f.customerName || '—'} · {f.dueAt.slice(0, 16).replace('T', ' ')}</div>
                        {overdue ? <span className="crm-badge crm-badge--danger">عقب‌افتاده</span> : null}
                      </div>
                      {f.status === 'باز' ? (
                        <button type="button" className="admin-btn admin-btn--ghost" onClick={() => completeFollowup(f.id)}>
                          انجام شد
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="admin-muted">پیگیری نزدیکی نیست</p>
            )}
          </section>

          <section className="admin-card">
            <div className="admin-card-head"><h2>وظایف داخلی</h2></div>
            {data.myTasks.length ? (
              <ul className="crm-fu-list">
                {data.myTasks.map((t) => (
                  <li key={t.id}>
                    <div>
                      <strong>{t.title}</strong>
                      <div className="admin-muted">{t.kind} · {t.dueAt.slice(0, 10)} · {t.priority}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-muted">وظیفه‌ای باز نیست</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
