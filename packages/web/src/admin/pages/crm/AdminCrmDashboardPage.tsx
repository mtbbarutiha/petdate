import { useEffect, useState } from 'react';
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

function standingTone(standing: string): 'good' | 'warn' | 'bad' {
  if (standing === 'در مسیر درست') return 'good';
  if (standing === 'نیازمند تلاش بیشتر') return 'warn';
  return 'bad';
}

function kpiColor(pct: number): string {
  if (pct >= 90) return '#15cca0';
  if (pct >= 70) return '#fd961e';
  return '#c62828';
}

function CircGauge({
  pct,
  label,
  valueLabel,
  size = 96,
  stroke = 8,
  centerLarge,
}: {
  pct: number;
  label: string;
  valueLabel: string;
  size?: number;
  stroke?: number;
  centerLarge?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const dash = (clamped / 100) * c;
  const color = kpiColor(pct);
  return (
    <div className="crm-gauge" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--admin-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="crm-gauge-arc"
        />
        <text
          x={size / 2}
          y={size / 2 + (centerLarge ? 6 : 4)}
          textAnchor="middle"
          className={centerLarge ? 'crm-gauge-pct crm-gauge-pct--lg' : 'crm-gauge-pct'}
        >
          {formatNumFa(Math.round(pct))}٪
        </text>
      </svg>
      <div className="crm-gauge-meta">
        <strong>{valueLabel}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function KpiRingCard({ kpi }: { kpi: CrmKpiRing }) {
  const valueLabel = `${formatNumFa(kpi.value)} از ${formatNumFa(kpi.target)} ${kpi.unit}`;
  return (
    <div className={`crm-kpi-item crm-kpi-item--${standingTone(kpi.standing)}`}>
      <CircGauge pct={kpi.pct} label={kpi.label} valueLabel={valueLabel} size={88} stroke={7} />
    </div>
  );
}

function relativeFa(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.round(diffMs / 3600_000);
  if (hours < 0) {
    const ahead = Math.abs(hours);
    if (ahead < 24) return `${formatNumFa(ahead)} ساعت دیگر`;
    return `${formatNumFa(Math.round(ahead / 24))} روز دیگر`;
  }
  if (hours < 1) return 'همین الان';
  if (hours < 24) return `${formatNumFa(hours)} ساعت گذشته`;
  return `${formatNumFa(Math.round(hours / 24))} روز گذشته`;
}

function slaBadge(state: string, due?: string | null) {
  if (state === 'breached') {
    const hours = due ? Math.max(1, Math.round((Date.now() - new Date(due).getTime()) / 3600_000)) : null;
    return (
      <span className="admin-badge admin-badge--error">
        نقض SLA{hours != null ? ` · ${formatNumFa(hours)} ساعت گذشته` : ''}
      </span>
    );
  }
  if (state === 'at_risk') return <span className="admin-badge admin-badge--warn">در معرض نقض</span>;
  if (state === 'closed') return <span className="admin-badge admin-badge--ok">بسته</span>;
  return <span className="admin-badge admin-badge--info">در مهلت</span>;
}

function priorityBadge(p: string) {
  if (p === 'بحرانی' || p === 'بالا') return <span className="admin-badge admin-badge--warn">{p}</span>;
  return <span className="admin-badge">{p}</span>;
}

export function AdminCrmDashboardPage() {
  const [data, setData] = useState<CrmDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyFu, setBusyFu] = useState<number | null>(null);

  const load = () => {
    void adminFetch<CrmDashboard>('/api/admin/crm/dashboard')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'خطا'));
  };

  useEffect(() => {
    load();
  }, []);

  const completeFu = async (id: number) => {
    setBusyFu(id);
    try {
      await adminFetch(`/api/admin/crm/followups/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ result: 'انجام شد از میز کار' }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusyFu(null);
    }
  };

  if (error) {
    return (
      <div className="admin-page">
        <p className="admin-error">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="admin-page">
        <p>در حال بارگذاری…</p>
      </div>
    );
  }

  const openSliceTotal = data.ticketStatus.reduce((s, x) => s + x.value, 0) || 1;

  return (
    <div className="admin-page crm-workspace">
      <header className="crm-ws-header">
        <div>
          <h1>میز کار من</h1>
          <p className="crm-ws-meta">
            <span>{data.dateLabel}</span>
            <span className="crm-ws-dot" />
            <span>{data.greetingName}</span>
            <span className="crm-ws-dot" />
            <span>{data.roleLabel}</span>
            <span className="crm-ws-dot" />
            <span className="crm-ws-live">داده‌های لحظه‌ای</span>
          </p>
        </div>
        <div className="crm-ws-badges">
          <span className="admin-badge admin-badge--error">{formatNumFa(data.breachedSla)} نقض SLA</span>
          <span className="admin-badge admin-badge--info">{formatNumFa(data.qaQueue)} در صف ارزیابی</span>
          <Link className="admin-btn admin-btn--primary" to="/admin/crm/inbox">
            اینباکس
          </Link>
        </div>
      </header>

      <section className="admin-card crm-kpi-panel">
        <div className="crm-kpi-panel-head">
          <div>
            <h2>وضعیت من نسبت به شاخص‌ها</h2>
            <p className="admin-muted">مدل استاندارد کارشناس امور مشتریان · ۷ روز گذشته</p>
          </div>
          <ul className="crm-kpi-legend">
            <li>
              <i className="crm-dot crm-dot--good" /> در مسیر درست: ۹۰٪ و بالاتر
            </li>
            <li>
              <i className="crm-dot crm-dot--warn" /> نیازمند تلاش بیشتر: ۷۰٪ تا ۹۰٪
            </li>
            <li>
              <i className="crm-dot crm-dot--bad" /> ضعیف: زیر ۷۰٪
            </li>
          </ul>
        </div>
        <div className="crm-kpi-body">
          <div className="crm-kpi-overall">
            <CircGauge
              pct={data.overallAchievement}
              label="تحقق کلی شاخص‌ها"
              valueLabel={data.overallStanding}
              size={148}
              stroke={12}
              centerLarge
            />
          </div>
          <div className="crm-kpi-grid">
            {data.kpis.map((k) => (
              <KpiRingCard key={k.key} kpi={k} />
            ))}
          </div>
        </div>
        {data.weakPoints.length ? (
          <p className="crm-weak-line">
            <strong>نقاط ضعف:</strong> {data.weakPoints.join(' · ')}
          </p>
        ) : (
          <p className="crm-weak-line crm-weak-line--ok">همه شاخص‌ها در وضعیت قابل قبول هستند.</p>
        )}
      </section>

      <div className="crm-charts-row">
        <section className="admin-card crm-chart-card">
          <div className="admin-card-head">
            <h2>توزیع کانال‌ها</h2>
          </div>
          <div className="crm-chart-box">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.channelDistribution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#757086" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#757086" width={28} />
                <Tooltip formatter={(v: number) => formatNumFa(v)} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#5c4d91" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="admin-card crm-chart-card">
          <div className="admin-card-head">
            <h2>حجم تعامل ۷ روز اخیر</h2>
          </div>
          <div className="crm-chart-box">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.dailyInteractions} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="crmVolFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#15cca0" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#15cca0" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#757086" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#757086" width={28} />
                <Tooltip formatter={(v: number) => formatNumFa(v)} />
                <Area type="monotone" dataKey="value" stroke="#15cca0" strokeWidth={2.5} fill="url(#crmVolFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="admin-card crm-chart-card">
          <div className="admin-card-head">
            <h2>وضعیت تیکت‌ها</h2>
          </div>
          <div className="crm-donut-wrap">
            <div className="crm-donut-chart">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={data.ticketStatus}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {data.ticketStatus.map((s) => (
                      <Cell key={s.key} fill={s.color || '#5c4d91'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatNumFa(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="crm-donut-center">
                <strong>{formatNumFa(data.openTickets)}</strong>
                <span>تیکت باز</span>
              </div>
            </div>
            <ul className="crm-donut-legend">
              {data.ticketStatus.map((s) => (
                <li key={s.key}>
                  <i style={{ background: s.color || '#5c4d91' }} />
                  <span>{s.label}</span>
                  <em>{formatNumFa(Math.round((s.value / openSliceTotal) * 100))}٪</em>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <div className="crm-bottom-row">
        <section className="admin-card crm-tickets-card">
          <div className="admin-card-head">
            <h2>تیکت‌های من</h2>
            <Link to="/admin/crm/cases?tab=tickets">همه پرونده‌ها</Link>
          </div>
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
                  <tr key={t.id} style={{ borderInlineStart: `3px solid ${t.borderColor || 'var(--admin-border)'}` }}>
                    <td className="admin-muted">{t.publicId}</td>
                    <td>{t.title}</td>
                    <td>{t.customerName || '—'}</td>
                    <td>{priorityBadge(t.priority)}</td>
                    <td>
                      <span className="admin-badge">{t.status}</span>
                    </td>
                    <td>{t.agentName || '—'}</td>
                    <td>{slaBadge(t.slaState || 'ok', t.slaDue)}</td>
                  </tr>
                ))}
                {!data.myTickets.length ? (
                  <tr>
                    <td colSpan={7}>تیکت بازی نیست</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className="crm-side-stack">
          <section className="admin-card">
            <div className="admin-card-head">
              <h2>پیگیری‌های نزدیک</h2>
            </div>
            <ul className="crm-fu-list">
              {data.upcomingFollowups.map((f) => (
                <li key={f.id}>
                  <div>
                    <strong>{f.description || f.kind}</strong>
                    <span className="admin-muted">
                      {f.customerName || 'مشتری'} · {relativeFa(f.dueAt)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    disabled={busyFu === f.id}
                    onClick={() => void completeFu(f.id)}
                  >
                    انجام شد
                  </button>
                </li>
              ))}
              {!data.upcomingFollowups.length ? <li className="admin-muted">پیگیری نزدیکی نیست</li> : null}
            </ul>
          </section>

          <section className="admin-card">
            <div className="admin-card-head">
              <h2>وظایف داخلی</h2>
            </div>
            <ul className="crm-fu-list">
              {data.myTasks.map((t) => (
                <li key={t.id}>
                  <div>
                    <strong>{t.title}</strong>
                    <span className="admin-muted">
                      {t.kind} · {t.dueAt.slice(0, 10)} · {t.priority}
                    </span>
                  </div>
                </li>
              ))}
              {!data.myTasks.length ? <li className="admin-muted">وظیفه‌ای باز نیست</li> : null}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
