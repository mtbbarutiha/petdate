import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SalesDashboard, SalesFollowup, SalesKpiRing, SalesReportSummary } from '@petdate/shared';
import { salesStageLabel } from '@petdate/shared';
import { Briefcase, Phone, Target, Wallet } from 'lucide-react';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import {
  adminRtlHBarsCategoryAxis,
  adminRtlHBarsMargin,
  adminRtlHBarsRadius,
  adminRtlHBarsValueAxis,
} from '../../rechartsRtlHBars';
import {
  AdminChartCard,
  AdminChartGrid,
  AdminDashPage,
  AdminKpiStrip,
  type AdminKpiItem,
} from '../../dash';
import {
  AdminProgressRing,
  MOTION_PALETTE,
  MotionAreaGradientDefs,
  MotionBarGradientDefs,
  MotionChartTooltip,
  useRechartsMotion,
} from '../../motionCharts';

const STAGE_COLORS = ['#5c4d91', '#15cca0', '#3b82f6', '#fd961e', '#14b8a6', '#ec4899', '#8b5cf6', '#64748b'];

function ringColor(pct: number): string {
  if (pct >= 90) return '#15cca0';
  if (pct >= 60) return '#fd961e';
  return '#c62828';
}

function KpiRingCard({ ring }: { ring: SalesKpiRing }) {
  const color = ringColor(ring.pct);
  return (
    <article className="sales-kpi-ring admin-dash-kpi admin-dash-kpi--slate" aria-label={ring.label}>
      <AdminProgressRing
        value={ring.value}
        max={Math.max(1, ring.target)}
        size={88}
        color={color}
        showPct={false}
        label={`از ${formatNumFa(ring.target)}`}
      />
      <div className="sales-kpi-ring-meta">
        <strong>{ring.label}</strong>
        <span>
          {formatNumFa(Math.round(ring.pct))}٪ · {ring.unit}
        </span>
      </div>
    </article>
  );
}

function relativeFa(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  if (mins < 60) return diff >= 0 ? `${formatNumFa(mins)} دقیقه پیش` : `${formatNumFa(mins)} دقیقه دیگر`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return diff >= 0 ? `${formatNumFa(hours)} ساعت پیش` : `${formatNumFa(hours)} ساعت دیگر`;
  const days = Math.round(hours / 24);
  return diff >= 0 ? `${formatNumFa(days)} روز پیش` : `${formatNumFa(days)} روز دیگر`;
}

export function AdminSalesDashboardPage() {
  const motion = useRechartsMotion();
  const [data, setData] = useState<SalesDashboard | null>(null);
  const [report, setReport] = useState<SalesReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canWrite = adminCan('sales.write') || adminCan('admin.full');

  const load = useCallback(() => {
    void Promise.all([
      adminFetch<SalesDashboard>('/api/admin/sales/dashboard'),
      adminFetch<SalesReportSummary>('/api/admin/sales/reports').catch(() => null),
    ])
      .then(([dash, rep]) => {
        setData(dash);
        setReport(rep);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'خطا'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const completeFollowup = async (id: number) => {
    await adminFetch(`/api/admin/sales/followups/${id}/complete`, { method: 'POST', body: '{}' });
    load();
  };

  const stageChart = useMemo(() => {
    if (!data?.stageCounts?.length) return [];
    return data.stageCounts.map((s) => ({
      name: salesStageLabel(Number(s.stage)),
      count: s.count,
    }));
  }, [data]);

  const revenueTrend = useMemo(
    () => (report?.dailyRevenue || []).map((p) => ({ label: p.day.slice(5), value: p.value })),
    [report],
  );
  const callsTrend = useMemo(
    () => (report?.dailyCalls || []).map((p) => ({ label: p.day.slice(5), value: p.count })),
    [report],
  );
  const bySource = useMemo(
    () => (report?.bySource || []).map((s) => ({ name: s.source, count: s.value })),
    [report],
  );

  const stripKpis: AdminKpiItem[] = data
    ? [
        { key: 'leads', label: 'لید فعال', value: formatNumFa(data.activeLeads), icon: Target, tone: 'violet' },
        { key: 'sales', label: 'فروش امروز', value: formatNumFa(data.salesTodayCount), icon: Briefcase, tone: 'mint' },
        { key: 'calls', label: 'تماس امروز', value: formatNumFa(data.callsToday), icon: Phone, tone: 'sky' },
        {
          key: 'value',
          label: 'مبلغ فروش امروز',
          value: `${formatNumFa(data.salesTodayValue)} ت`,
          icon: Wallet,
          tone: 'orange',
          wide: true,
        },
        { key: 'overdue', label: 'پیگیری سررسید', value: formatNumFa(data.overdueFollowups), icon: Target, tone: 'orange' },
        { key: 'finance', label: 'در انتظار مالی', value: formatNumFa(data.pendingFinance), icon: Wallet, tone: 'slate' },
      ]
    : [];

  if (error && !data) {
    return (
      <AdminDashPage title="داشبورد فروش" error={error} onRefresh={load} />
    );
  }
  if (!data) {
    return (
      <AdminDashPage title="داشبورد فروش" subtitle="در حال بارگذاری…" />
    );
  }

  return (
    <AdminDashPage
      className="sales-dash"
      title={`سلام ${data.greetingName}`}
      subtitle="کارتابل من · خط محصول Pet Date"
      onRefresh={load}
      error={error}
      actions={
        <>
          <Link className="admin-btn admin-btn--ghost" to="/admin/sales/calls">
            مرکز تماس
          </Link>
          <Link className="admin-btn admin-btn--primary" to="/admin/sales/leads">
            لیدها
          </Link>
        </>
      }
    >
      <AdminKpiStrip items={stripKpis} ariaLabel="شاخص‌های فروش" />

      <section className="sales-kpi-rings" aria-label="حلقه‌های KPI">
        {(data.kpiRings || []).map((r) => (
          <KpiRingCard key={r.key} ring={r} />
        ))}
      </section>

      <article className="admin-card sales-commission-card">
        <div>
          <span className="admin-muted">کمیسیون تخمینی امروز</span>
          <strong className="sales-commission-value">{formatNumFa(data.estimatedCommission)} تومان</strong>
          <p className="admin-muted">
            {formatNumFa(data.commissionRatePct)}٪ از {formatNumFa(data.salesTodayValue)} تومان فروش شخصی امروز
          </p>
        </div>
        <div className="sales-commission-side">
          <div>
            <span className="admin-muted">لید فعال</span>
            <b>{formatNumFa(data.activeLeads)}</b>
          </div>
          <div>
            <span className="admin-muted">پیگیری سررسید</span>
            <b className={data.overdueFollowups ? 'sales-danger' : undefined}>{formatNumFa(data.overdueFollowups)}</b>
          </div>
          <div>
            <span className="admin-muted">در انتظار مالی</span>
            <b>{formatNumFa(data.pendingFinance)}</b>
          </div>
        </div>
      </article>

      <AdminChartGrid cols={2}>
        <AdminChartCard
          title="قیف مراحل فروش"
          empty={!stageChart.length}
          height={Math.max(240, 36 * Math.max(stageChart.length, 4))}
          rtlHBars
        >
          <ResponsiveContainer width="100%" height={Math.max(240, 36 * Math.max(stageChart.length, 4))}>
            <BarChart layout="vertical" data={stageChart} margin={{ ...adminRtlHBarsMargin }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--admin-border)" />
              <XAxis {...adminRtlHBarsValueAxis} />
              <YAxis dataKey="name" {...adminRtlHBarsCategoryAxis} />
              <Tooltip content={<MotionChartTooltip />} cursor={{ fill: 'rgba(92,77,145,0.06)' }} />
              <Bar dataKey="count" radius={adminRtlHBarsRadius} maxBarSize={18} {...motion}>
                {stageChart.map((_, idx) => (
                  <Cell key={idx} fill={STAGE_COLORS[idx % STAGE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AdminChartCard>

        <AdminChartCard title="روند درآمد روزانه" empty={!revenueTrend.length} height={240}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revenueTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <MotionAreaGradientDefs id="salesRevArea" color={MOTION_PALETTE.purple} mid={MOTION_PALETTE.mint} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#757086' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#757086' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<MotionChartTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={MOTION_PALETTE.purple}
                strokeWidth={2.5}
                fill="url(#salesRevArea)"
                {...motion}
                animationDuration={motion.isAnimationActive ? 900 : 0}
              />
            </AreaChart>
          </ResponsiveContainer>
        </AdminChartCard>

        <AdminChartCard title="روند تماس‌های روزانه" empty={!callsTrend.length} height={220}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={callsTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <MotionBarGradientDefs id="salesCallsBar" from={MOTION_PALETTE.mint} to={MOTION_PALETTE.blue} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#757086' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#757086' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<MotionChartTooltip />} />
              <Bar dataKey="value" radius={[8, 8, 4, 4]} fill="url(#salesCallsBar)" maxBarSize={28} {...motion} />
            </BarChart>
          </ResponsiveContainer>
        </AdminChartCard>

        <AdminChartCard
          title="فروش بر اساس منبع"
          empty={!bySource.length}
          height={Math.max(200, 36 * Math.max(bySource.length, 3))}
          rtlHBars
        >
          <ResponsiveContainer width="100%" height={Math.max(200, 36 * Math.max(bySource.length, 3))}>
            <BarChart layout="vertical" data={bySource} margin={{ ...adminRtlHBarsMargin }}>
              <MotionBarGradientDefs id="salesSrcBar" from={MOTION_PALETTE.coral} to={MOTION_PALETTE.pink} />
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--admin-border)" />
              <XAxis {...adminRtlHBarsValueAxis} />
              <YAxis dataKey="name" {...adminRtlHBarsCategoryAxis} />
              <Tooltip content={<MotionChartTooltip />} cursor={{ fill: 'rgba(92,77,145,0.06)' }} />
              <Bar dataKey="count" radius={adminRtlHBarsRadius} maxBarSize={18} fill="url(#salesSrcBar-h)" {...motion} />
            </BarChart>
          </ResponsiveContainer>
        </AdminChartCard>
      </AdminChartGrid>

      <section className="admin-card" style={{ marginTop: 4 }}>
        <div className="admin-card-head">
          <h2>اقدام بعدی پیشنهادی</h2>
          <span className="admin-muted">{formatNumFa(data.nextActions.length)} لید</span>
        </div>
        <div className="sales-next-actions">
          {data.nextActions.map((i) => (
            <article key={i.id} className="sales-next-card">
              <div className="sales-next-score">امتیاز {formatNumFa(i.score)}</div>
              <strong>
                {i.first} {i.last}
              </strong>
              <p className="admin-muted">
                {i.product || 'Pet Date'} · {salesStageLabel(i.stage)}
              </p>
              <p className="admin-muted">{i.mobile}</p>
              <div className="sales-next-actions-row">
                <span className="admin-muted">{relativeFa(i.lastActivity)}</span>
                <Link className="admin-btn admin-btn--primary admin-btn--sm" to={`/admin/sales/leads/${i.id}`}>
                  تماس / باز
                </Link>
              </div>
            </article>
          ))}
          {!data.nextActions.length ? <p className="admin-dash-chart-empty">اقدام پیشنهادی نیست</p> : null}
        </div>
      </section>

      <section className="admin-card" style={{ marginTop: 14 }}>
        <div className="admin-card-head">
          <h2>فالوآپ‌های من</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>مخاطب/شرح</th>
                <th>نوع</th>
                <th>سررسید</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.myFollowups.map((f: SalesFollowup) => {
                const overdue = new Date(f.at).getTime() < Date.now();
                return (
                  <tr key={f.id}>
                    <td>
                      {f.desc || '—'}
                      <div className="admin-muted">{f.priority}</div>
                    </td>
                    <td>{f.type}</td>
                    <td>
                      <span className={overdue ? 'sales-badge sales-badge--danger' : 'sales-badge'}>
                        {overdue ? `سررسید گذشته · ${relativeFa(f.at)}` : relativeFa(f.at)}
                      </span>
                    </td>
                    <td>
                      {canWrite && f.status === 'باز' ? (
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          onClick={() => void completeFollowup(f.id)}
                        >
                          انجام شد
                        </button>
                      ) : (
                        f.status
                      )}
                    </td>
                  </tr>
                );
              })}
              {!data.myFollowups.length ? (
                <tr>
                  <td colSpan={4}>خالی</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminDashPage>
  );
}
