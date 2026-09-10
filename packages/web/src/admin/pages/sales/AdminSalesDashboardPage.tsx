import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SalesDashboard, SalesFollowup, SalesKpiRing } from '@petdate/shared';
import { salesStageLabel } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';

const STAGE_COLORS = ['#5c4d91', '#15cca0', '#3b82f6', '#fd961e', '#14b8a6', '#ec4899', '#8b5cf6', '#64748b'];

function ringColor(pct: number): string {
  if (pct >= 90) return '#15cca0';
  if (pct >= 60) return '#fd961e';
  return '#c62828';
}

function KpiRingCard({ ring }: { ring: SalesKpiRing }) {
  const color = ringColor(ring.pct);
  const r = 34;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, ring.pct)) / 100) * circ;
  return (
    <article className="sales-kpi-ring" aria-label={ring.label}>
      <svg width="88" height="88" viewBox="0 0 88 88" role="img">
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--admin-border)" strokeWidth="8" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`}
          transform="rotate(-90 44 44)"
        />
        <text x="44" y="42" textAnchor="middle" className="sales-kpi-ring-value" fill="var(--admin-ink)">
          {formatNumFa(ring.value)}
        </text>
        <text x="44" y="56" textAnchor="middle" className="sales-kpi-ring-target" fill="var(--admin-muted)">
          از {formatNumFa(ring.target)}
        </text>
      </svg>
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

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="hr-chart-tooltip">
      <div className="hr-chart-tooltip-label">{label}</div>
      <strong>{formatNumFa(Number(payload[0].value || 0))}</strong>
    </div>
  );
}

export function AdminSalesDashboardPage() {
  const [data, setData] = useState<SalesDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canWrite = adminCan('sales.write') || adminCan('admin.full');

  const load = useCallback(() => {
    void adminFetch<SalesDashboard>('/api/admin/sales/dashboard')
      .then(setData)
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

  return (
    <div className="admin-page admin-page--wide sales-dash">
      <header className="admin-header">
        <div>
          <h1>سلام {data.greetingName}</h1>
          <p>کارتابل من · خط محصول Pet Date (بدون چند بیزنس‌لاین)</p>
        </div>
        <div className="admin-header-actions">
          <Link className="admin-btn admin-btn--ghost" to="/admin/sales/calls">
            مرکز تماس
          </Link>
          <Link className="admin-btn admin-btn--primary" to="/admin/sales/leads">
            لیدها
          </Link>
        </div>
      </header>

      <section className="sales-kpi-rings" aria-label="شاخص‌های کارتابل">
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

      <section className="admin-card" style={{ marginTop: 14 }}>
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
          {!data.nextActions.length ? <p className="admin-muted">اقدام پیشنهادی نیست</p> : null}
        </div>
      </section>

      <div className="sales-dash-split">
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>قیف مراحل فروش</h2>
          </div>
          <div className="sales-stage-chart" style={{ height: Math.max(240, 28 * Math.max(stageChart.length, 4)) }}>
            {stageChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={stageChart} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--admin-border)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#757086' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: '#3d3558' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(92,77,145,0.06)' }} />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} maxBarSize={18}>
                    {stageChart.map((_, idx) => (
                      <Cell key={idx} fill={STAGE_COLORS[idx % STAGE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="admin-muted">داده‌ای نیست</p>
            )}
          </div>
        </section>

        <section className="admin-card">
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
      </div>
    </div>
  );
}
