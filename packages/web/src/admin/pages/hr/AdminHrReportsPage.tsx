import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
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
import { adminFetch, formatNumFa } from '../../api';
import { HrKpiGrid, HrLinkGrid } from './HrUi';

type ChartRow = { name: string; count: number };

type Report = {
  personnelTotal: number;
  /** Chart arrays from API (`getReportsSummary`); maps kept for older payloads */
  byDept: ChartRow[];
  byStatus: ChartRow[];
  byLocation: ChartRow[];
  byDeptMap?: Record<string, number>;
  byStatusMap?: Record<string, number>;
  byLocationMap?: Record<string, number>;
  serviceHoursMonth: number;
  requestsOpen: number;
};

const COLORS = ['#15cca0', '#5c4d91', '#fd961e', '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6', '#64748b'];

function toRows(data: ChartRow[] | Record<string, number> | undefined): ChartRow[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Object.entries(data)
    .map(([name, count]) => ({ name, count: Number(count) || 0 }))
    .sort((a, b) => b.count - a.count);
}

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: ChartRow }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="hr-chart-tooltip">
      <div className="hr-chart-tooltip-label">{label || payload[0].payload?.name}</div>
      <strong>{formatNumFa(Number(payload[0].value || 0))} نفر</strong>
    </div>
  );
}

function HorizontalBars({ rows, height }: { rows: ChartRow[]; height?: number }) {
  if (!rows.length) return <p className="admin-muted">داده‌ای نیست</p>;
  return (
    <div className="hr-dash-chart" style={{ height: height ?? Math.max(200, 34 * rows.length) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={rows} margin={{ top: 4, right: 20, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--admin-border)" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#757086' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: '#3d3558' }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(92,77,145,0.06)' }} />
          <Bar dataKey="count" radius={[0, 8, 8, 0]} maxBarSize={20}>
            {rows.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AdminHrReportsPage() {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await adminFetch<Report>('/api/admin/hr/reports'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const byDept = useMemo(
    () => toRows(data?.byDept?.length ? data.byDept : data?.byDeptMap),
    [data],
  );
  const byStatus = useMemo(
    () => toRows(data?.byStatus?.length ? data.byStatus : data?.byStatusMap),
    [data],
  );
  const byLocation = useMemo(
    () => toRows(data?.byLocation?.length ? data.byLocation : data?.byLocationMap),
    [data],
  );
  const statusPie = useMemo(
    () => byStatus.map((s, i) => ({ ...s, color: COLORS[i % COLORS.length] })),
    [byStatus]
  );

  return (
    <div className="admin-page hr-dash">
      <header className="admin-header">
        <div>
          <h1>گزارشات منابع انسانی</h1>
          <p>توزیع پرسنل، ساعت فعالیت و درخواست‌ها</p>
        </div>
        <div className="admin-header-actions">
          <Link to="/admin/hr" className="admin-btn admin-btn--ghost">
            داشبورد
          </Link>
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      {data ? (
        <HrKpiGrid
          items={[
            { label: 'کل پرسنل', value: data.personnelTotal, tone: 'mint' },
            { label: 'ساعت فعالیت ماه', value: data.serviceHoursMonth, tone: 'sky' },
            { label: 'درخواست باز', value: data.requestsOpen, tone: 'orange' },
          ]}
        />
      ) : null}

      <div className="hr-dash-main-row" style={{ marginTop: 16 }}>
        <article className="admin-card hr-dash-panel">
          <div className="admin-card-head">
            <h2>توزیع بر دپارتمان</h2>
          </div>
          <HorizontalBars rows={byDept} />
        </article>
        <article className="admin-card hr-dash-panel">
          <div className="admin-card-head">
            <h2>وضعیت قرارداد</h2>
          </div>
          <div className="hr-dash-donut-wrap">
            {statusPie.length ? (
              <>
                <div className="hr-dash-chart" style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusPie} dataKey="count" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2}>
                        {statusPie.map((s) => (
                          <Cell key={s.name} fill={s.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="hr-dash-legend">
                  {statusPie.map((s) => (
                    <li key={s.name}>
                      <i style={{ background: s.color }} />
                      {s.name}
                      <span>{formatNumFa(s.count)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="admin-muted">داده‌ای نیست</p>
            )}
          </div>
        </article>
      </div>

      <article className="admin-card hr-dash-panel" style={{ marginTop: 14 }}>
        <div className="admin-card-head">
          <h2>توزیع بر محل کار</h2>
        </div>
        <HorizontalBars rows={byLocation} height={Math.max(180, 34 * Math.max(byLocation.length, 2))} />
      </article>

      <HrLinkGrid
        links={[
          { to: '/admin/hr/employees', label: 'پرسنل', sub: 'جزئیات پرونده' },
          { to: '/admin/hr/cost', label: 'هزینه', sub: 'جمع ماهانه' },
          { to: '/admin/hr/compensation', label: 'جبران خدمت', sub: 'مدل درآمد' },
        ]}
      />
      <p style={{ marginTop: 12 }}>
        <Link to="/admin/hr/requests">مانده مرخصی →</Link>
      </p>
    </div>
  );
}
