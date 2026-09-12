import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CrmDashboard, CrmKpiRing, CrmReportSummary } from '@petdate/shared';
import { AlertTriangle, Headphones, MessageSquare, ShieldAlert, Star } from 'lucide-react';
import { adminFetch, formatNumFa } from '../../api';
import { formatAdminFaDate, formatAdminFaDateTime } from '../../JalaliDateSelect';
import {
  AdminChartCard,
  AdminChartGrid,
  AdminDashPage,
  AdminKpiStrip,
  type AdminKpiItem,
} from '../../dash';
import {
  adminChartPlotMargin,
  adminChartTickFormatter,
  adminChartXAxisProps,
  adminChartYAxisProps,
} from '../../adminChartLayout';
import {
  adminRtlHBarsCategoryAxis,
  adminRtlHBarsHeight,
  adminRtlHBarsMargin,
  adminRtlHBarsRadius,
  adminRtlHBarsValueAxis,
} from '../../rechartsRtlHBars';
import {
  AdminProgressRing,
  MOTION_PALETTE,
  MotionAreaGradientDefs,
  MotionBarGradientDefs,
  MotionChartTooltip,
  usePrefersReducedMotion,
  useRechartsMotion,
} from '../../motionCharts';

const STANDING_COLOR: Record<string, string> = {
  'در مسیر درست': '#15cca0',
  'نیازمند تلاش بیشتر': '#fd961e',
  ضعیف: '#c62828',
};

function GaugeSemi({ pct, standing }: { pct: number; standing: string }) {
  const color = STANDING_COLOR[standing] || '#c62828';
  const clamped = Math.max(0, Math.min(100, pct));
  const reduced = usePrefersReducedMotion();
  const r = 70;
  const c = Math.PI * r;
  const filled = (clamped / 100) * c;
  return (
    <div className="crm-gauge" aria-label={`تحقق ${pct} درصد`}>
      <svg viewBox="0 0 180 110" width="180" height="110">
        <defs>
          <linearGradient id="crmGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={MOTION_PALETTE.blue} />
            <stop offset="55%" stopColor={color} />
            <stop offset="100%" stopColor={MOTION_PALETTE.mint} />
          </linearGradient>
        </defs>
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
          stroke="url(#crmGaugeGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          className={reduced ? undefined : 'admin-motion-ring-arc'}
          style={
            reduced
              ? undefined
              : ({
                  ['--ring-target' as string]: String(filled),
                  ['--ring-circ' as string]: String(c),
                } as CSSProperties)
          }
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
  return (
    <div className="crm-kpi-ring">
      <AdminProgressRing
        value={kpi.value}
        max={Math.max(1, kpi.target)}
        size={88}
        color={color}
        showPct={false}
        label={`از ${formatNumFa(kpi.target)}`}
      />
      <div className="crm-kpi-ring-label">{kpi.label}</div>
      <div className="admin-muted" style={{ fontSize: 11 }}>{kpi.unit}</div>
    </div>
  );
}

export function AdminCrmDashboardPage() {
  const [data, setData] = useState<CrmDashboard | null>(null);
  const [report, setReport] = useState<CrmReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    void Promise.all([
      adminFetch<CrmDashboard>('/api/admin/crm/workspace'),
      adminFetch<{ summary: CrmReportSummary }>('/api/admin/crm/reports')
        .then((r) => r.summary)
        .catch(() => null),
    ])
      .then(([dash, rep]) => {
        setData(dash);
        setReport(rep);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'خطا'));
  };

  useEffect(() => {
    reload();
  }, []);

  const ticketPie = useMemo(
    () => (data?.ticketStatus || []).filter((s) => s.value > 0).map((s) => ({ ...s, name: s.label })),
    [data]
  );

  const slaBars = useMemo(() => {
    if (!data) return [];
    const healthy = Math.max(0, data.openTickets - data.breachedSla - data.atRiskSla);
    return [
      { name: 'سالم', count: healthy },
      { name: 'در معرض', count: data.atRiskSla },
      { name: 'نقض‌شده', count: data.breachedSla },
    ].filter((r) => r.count > 0);
  }, [data]);

  const reasonBars = useMemo(() => {
    const fromReport = report?.callReasons?.length
      ? report.callReasons.map((r) => ({ name: r.label, count: r.value }))
      : report?.byReason?.map((r) => ({ name: r.reason, count: r.count })) || [];
    if (fromReport.length) return fromReport;
    return (data?.channelDistribution || []).map((c) => ({ name: c.label, count: c.value }));
  }, [data, report]);

  const motion = useRechartsMotion();

  const stripKpis: AdminKpiItem[] = data
    ? [
        { key: 'open', label: 'تیکت باز', value: formatNumFa(data.openTickets), icon: MessageSquare, tone: 'sky' },
        { key: 'sla', label: 'نقض SLA', value: formatNumFa(data.breachedSla), icon: ShieldAlert, tone: 'orange' },
        { key: 'risk', label: 'در معرض SLA', value: formatNumFa(data.atRiskSla), icon: AlertTriangle, tone: 'orange' },
        { key: 'complaints', label: 'شکایت باز', value: formatNumFa(data.openComplaints), icon: Headphones, tone: 'violet' },
        {
          key: 'csat',
          label: 'CSAT',
          value: data.avgCsat != null ? formatNumFa(data.avgCsat) : '—',
          icon: Star,
          tone: 'mint',
        },
        { key: 'calls', label: 'تماس امروز', value: formatNumFa(data.callsToday), icon: Headphones, tone: 'slate' },
      ]
    : [];

  if (error && !data) {
    return <AdminDashPage title="میز کار من" error={error} onRefresh={reload} />;
  }
  if (!data) {
    return <AdminDashPage title="میز کار من" subtitle="در حال بارگذاری…" />;
  }

  const completeFollowup = (id: number) => {
    void adminFetch(`/api/admin/crm/followups/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ result: 'انجام شد از میز کار' }),
    }).then(() => reload());
  };

  return (
    <AdminDashPage
      className="crm-workspace"
      title="میز کار من"
      live
      subtitle={`${data.dateLabel} · ${data.greetingName} · ${data.roleLabel}`}
      onRefresh={reload}
      error={error}
      actions={
        <>
          <span className="crm-badge crm-badge--danger">{formatNumFa(data.breachedSla)} نقض SLA</span>
          <span className="crm-badge">{formatNumFa(data.qaQueue)} در صف ارزیابی</span>
          <Link className="admin-btn admin-btn--primary" to="/admin/crm/inbox">اینباکس</Link>
        </>
      }
    >
      <AdminKpiStrip items={stripKpis} ariaLabel="شاخص‌های باشگاه مشتریان" />

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

      <AdminChartGrid cols={3}>
        <AdminChartCard title="توزیع کانال‌ها" empty={!data.channelDistribution.length} height={220}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.channelDistribution} margin={adminChartPlotMargin}>
              <MotionBarGradientDefs id="crmChanBar" from={MOTION_PALETTE.purple} to={MOTION_PALETTE.mint} />
              <XAxis dataKey="label" {...adminChartXAxisProps} tickFormatter={adminChartTickFormatter} />
              <YAxis {...adminChartYAxisProps} width={28} />
              <Tooltip content={<MotionChartTooltip />} />
              <Bar dataKey="value" radius={[8, 8, 4, 4]} fill="url(#crmChanBar)" maxBarSize={36} {...motion} />
            </BarChart>
          </ResponsiveContainer>
        </AdminChartCard>

        <AdminChartCard title="حجم تعامل ۷ روز اخیر" empty={!data.dailyInteractions.length} height={220}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.dailyInteractions} margin={adminChartPlotMargin}>
              <MotionAreaGradientDefs id="crmArea" color={MOTION_PALETTE.mint} mid={MOTION_PALETTE.blue} />
              <XAxis dataKey="label" {...adminChartXAxisProps} tickFormatter={adminChartTickFormatter} />
              <YAxis {...adminChartYAxisProps} width={28} />
              <Tooltip content={<MotionChartTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={MOTION_PALETTE.mint}
                strokeWidth={2.5}
                fill="url(#crmArea)"
                {...motion}
                animationDuration={motion.isAnimationActive ? 900 : 0}
              />
            </AreaChart>
          </ResponsiveContainer>
        </AdminChartCard>

        <AdminChartCard title="وضعیت تیکت‌ها" empty={!ticketPie.length} height={200}>
          <div className="crm-donut-wrap">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={ticketPie}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={2}
                  {...motion}
                >
                  {ticketPie.map((s, i) => (
                    <Cell key={i} fill={s.color || '#5c4d91'} />
                  ))}
                </Pie>
                <Tooltip content={<MotionChartTooltip />} />
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
        </AdminChartCard>
      </AdminChartGrid>

      <AdminChartGrid cols={2}>
        <AdminChartCard
          title="وضعیت SLA تیکت‌ها"
          empty={!slaBars.length}
          height={adminRtlHBarsHeight(slaBars.length)}
          rtlHBars
        >
          <ResponsiveContainer width="100%" height={adminRtlHBarsHeight(slaBars.length)}>
            <BarChart layout="vertical" data={slaBars} margin={{ ...adminRtlHBarsMargin }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--admin-border)" />
              <XAxis {...adminRtlHBarsValueAxis} />
              <YAxis dataKey="name" {...adminRtlHBarsCategoryAxis} />
              <Tooltip content={<MotionChartTooltip />} cursor={{ fill: 'rgba(92,77,145,0.06)' }} />
              <Bar dataKey="count" radius={adminRtlHBarsRadius} maxBarSize={22} {...motion}>
                {slaBars.map((row) => (
                  <Cell
                    key={row.name}
                    fill={row.name === 'نقض‌شده' ? '#c62828' : row.name === 'در معرض' ? '#fd961e' : '#15cca0'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AdminChartCard>

        <AdminChartCard
          title="دلایل تعامل / کانال"
          empty={!reasonBars.length}
          height={adminRtlHBarsHeight(reasonBars.length)}
          rtlHBars
        >
          <ResponsiveContainer width="100%" height={adminRtlHBarsHeight(reasonBars.length)}>
            <BarChart layout="vertical" data={reasonBars} margin={{ ...adminRtlHBarsMargin }}>
              <MotionBarGradientDefs id="crmReasonBar" from={MOTION_PALETTE.mint} to={MOTION_PALETTE.blue} />
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--admin-border)" />
              <XAxis {...adminRtlHBarsValueAxis} />
              <YAxis dataKey="name" {...adminRtlHBarsCategoryAxis} />
              <Tooltip content={<MotionChartTooltip />} cursor={{ fill: 'rgba(92,77,145,0.06)' }} />
              <Bar dataKey="count" radius={adminRtlHBarsRadius} maxBarSize={18} fill="url(#crmReasonBar-h)" {...motion} />
            </BarChart>
          </ResponsiveContainer>
        </AdminChartCard>
      </AdminChartGrid>

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
                        <div className="admin-muted">{f.customerName || '—'} · {formatAdminFaDateTime(f.dueAt)}</div>
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
              <p className="admin-dash-chart-empty">پیگیری نزدیکی نیست</p>
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
                      <div className="admin-muted">{t.kind} · {formatAdminFaDate(t.dueAt)} · {t.priority}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-dash-chart-empty">وظیفه‌ای باز نیست</p>
            )}
          </section>
        </div>
      </div>
    </AdminDashPage>
  );
}
