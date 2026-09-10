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
import { AdminEntityCell, AdminThumb } from '../../AdminThumb';
import { HrLinkGrid, formatHrMoney } from './HrUi';

type ChartRow = { name: string; count: number };

type Dash = {
  monthLabel?: string;
  kpis: {
    personnel: number;
    activeAccess: number;
    inactiveAccess: number;
    cockpitTasks: number;
    serviceHoursMonth: number;
    orgCostMonth: number;
    unreadNotifications: number;
    openRequests: number;
    openOnboarding: number;
  };
  charts?: {
    byDepartment: ChartRow[];
    byContractStatus: ChartRow[];
    byLocation: ChartRow[];
  };
  links: Array<{ to: string; label: string }>;
  recentLogs: Array<{
    personName: string;
    avatarUrl?: string;
    field: string;
    oldValue: string;
    newValue: string;
    date: string;
  }>;
  cockpitPreview: Array<{ type: string; employeeName?: string; detail: string; label?: string }>;
};

const DEPT_COLORS = ['#15cca0', '#5c4d91', '#fd961e', '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6'];
const STATUS_COLORS = ['#15cca0', '#fd961e', '#c62828', '#5c4d91', '#64748b'];

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; payload?: ChartRow }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  const title = label || row.payload?.name || row.name || '';
  return (
    <div className="hr-chart-tooltip">
      <div className="hr-chart-tooltip-label">{title}</div>
      <strong>{formatNumFa(Number(row.value || 0))} نفر</strong>
    </div>
  );
}

function formatLogDate(raw: string): string {
  if (!raw) return '—';
  const normalized = raw.includes('T') || /Z$/.test(raw) ? raw : raw.replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toLocaleDateString('fa-IR');
}

export function AdminHrDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await adminFetch<Dash>('/api/admin/hr/dashboard'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const k = data?.kpis;
  const deptData = data?.charts?.byDepartment || [];
  const statusData = data?.charts?.byContractStatus || [];
  const monthLabel = data?.monthLabel || '';

  const statusPie = useMemo(
    () => statusData.map((s, i) => ({ ...s, color: STATUS_COLORS[i % STATUS_COLORS.length] })),
    [statusData],
  );

  const topKpis = k
    ? [
        { label: 'کل پرسنل ثبت‌شده', value: formatNumFa(k.personnel), tone: 'mint' as const },
        { label: 'دسترسی فعال', value: formatNumFa(k.activeAccess), tone: 'sky' as const },
        { label: 'دسترسی غیرفعال', value: formatNumFa(k.inactiveAccess), tone: 'orange' as const },
        { label: 'وظایف کارتابل', value: formatNumFa(k.cockpitTasks), tone: 'violet' as const },
      ]
    : [];

  return (
    <div className="admin-page hr-dash">
      <header className="admin-header">
        <div>
          <h1>داشبورد</h1>
          <p>خلاصه اطلاعات کلیدی منابع انسانی{monthLabel ? ` · ${monthLabel}` : ''}</p>
        </div>
        <div className="admin-header-actions">
          <Link to="/admin/hr/recruitment" className="admin-btn admin-btn--ghost">
            داشبورد جذب
          </Link>
          <Link to="/admin/hr/reports" className="admin-btn admin-btn--ghost">
            گزارشات
          </Link>
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      {topKpis.length ? (
        <div className="hr-dash-kpi-row">
          {topKpis.map((item) => (
            <article key={item.label} className={`hr-dash-kpi hr-dash-kpi--${item.tone}`}>
              <span className="hr-dash-kpi-label">{item.label}</span>
              <strong className="hr-dash-kpi-value">{item.value}</strong>
            </article>
          ))}
        </div>
      ) : null}

      {k ? (
        <div className="hr-dash-highlight-row">
          <article className="hr-dash-highlight">
            <span className="hr-dash-highlight-label">
              ساعت فعالیت{monthLabel ? ` · ${monthLabel}` : ' این ماه'}
            </span>
            <strong className="hr-dash-highlight-value">
              {formatNumFa(k.serviceHoursMonth)} <small>ساعت</small>
            </strong>
          </article>
          <article className="hr-dash-highlight">
            <span className="hr-dash-highlight-label">
              جمع هزینه سازمانی{monthLabel ? ` · ${monthLabel}` : ' این ماه'}
            </span>
            <strong className="hr-dash-highlight-value">{formatHrMoney(k.orgCostMonth)}</strong>
          </article>
        </div>
      ) : null}

      <div className="hr-dash-main-row">
        <article className="admin-card hr-dash-panel">
          <div className="admin-card-head">
            <h2>توزیع پرسنل بر واحد سازمانی</h2>
            <span className="admin-muted">بر اساس دپارتمان (بدون بیزنس‌لاین)</span>
          </div>
          <div className="hr-dash-chart" style={{ height: Math.max(220, 36 * Math.max(deptData.length, 3)) }}>
            {deptData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={deptData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--admin-border)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#757086' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: '#3d3558' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(92,77,145,0.06)' }} />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} maxBarSize={22} name="نفر">
                    {deptData.map((_, i) => (
                      <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="admin-muted">هنوز پرسنلی برای نمودار ثبت نشده</p>
            )}
          </div>
        </article>

        <article className="admin-card hr-dash-panel">
          <div className="admin-card-head">
            <h2>آخرین تغییرات</h2>
            <span className="admin-muted">{formatNumFa(data?.recentLogs.length || 0)} مورد</span>
          </div>
          {data?.recentLogs?.length ? (
            <ul className="hr-dash-changelog">
              {data.recentLogs.map((l, i) => (
                <li key={`${l.personName}-${i}`}>
                  <AdminEntityCell
                    thumb={<AdminThumb src={l.avatarUrl} label={l.personName} kind="user" size={32} />}
                    title={<b>{l.personName}</b>}
                    subtitle={
                      <>
                        {l.field}: {l.oldValue || '—'} ← {l.newValue || '—'}
                      </>
                    }
                  />
                  <time className="hr-dash-changelog-date">{formatLogDate(l.date)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-muted">هنوز تغییری ثبت نشده</p>
          )}
        </article>
      </div>

      <div className="hr-dash-secondary-row">
        <article className="admin-card hr-dash-panel">
          <div className="admin-card-head">
            <h2>وضعیت قرارداد</h2>
          </div>
          <div className="hr-dash-donut-wrap">
            {statusPie.length ? (
              <>
                <div className="hr-dash-chart" style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusPie} dataKey="count" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
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

        <article className="admin-card hr-dash-panel">
          <div className="admin-card-head">
            <h2>کارتابل (پیش‌نمایش)</h2>
            <Link to="/admin/hr/cockpit" className="admin-muted">
              کامل →
            </Link>
          </div>
          {data?.cockpitPreview?.length ? (
            <ul className="admin-log-list">
              {data.cockpitPreview.map((t, i) => (
                <li key={i}>
                  <b>{t.type}</b>
                  {t.employeeName ? ` · ${t.employeeName}` : ''}
                  <div className="admin-muted">{t.detail || t.label || ''}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-muted">وظیفه‌ای نیست</p>
          )}
        </article>
      </div>

      {data ? <HrLinkGrid links={data.links.map((l) => ({ to: l.to, label: l.label, sub: 'باز کردن ماژول' }))} /> : null}
    </div>
  );
}
