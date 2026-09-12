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
import { Briefcase, Clock, UserCheck, UserX, Users, Wallet } from 'lucide-react';
import { adminFetch, formatNumFa } from '../../api';
import {
  adminRtlHBarsCategoryAxis,
  adminRtlHBarsMargin,
  adminRtlHBarsRadius,
  adminRtlHBarsValueAxis,
} from '../../rechartsRtlHBars';
import { AdminChartCard, AdminChartGrid, AdminDashPage, AdminKpiStrip, type AdminKpiItem } from '../../dash';
import {
  MOTION_PALETTE,
  MotionBarGradientDefs,
  MotionChartTooltip,
  useRechartsMotion,
} from '../../motionCharts';
import { HrLinkGrid, formatHrMoney } from './HrUi';
import { tr } from '../../../i18n';

type ChartRow = { name: string; count: number };
type CostDeptRow = { name: string; total: number };

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
    costByDepartment?: CostDeptRow[];
    byContractStatus: ChartRow[];
    byLocation: ChartRow[];
  };
  links: Array<{ to: string; label: string }>;
  cockpitPreview: Array<{ type: string; employeeName?: string; detail: string; label?: string }>;
};

const DEPT_COLORS = ['#15cca0', '#5c4d91', '#fd961e', '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6'];
const STATUS_COLORS = ['#15cca0', '#fd961e', '#c62828', '#5c4d91', '#64748b'];

function HrMoneyTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; payload?: ChartRow | CostDeptRow }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  const title = label || row?.payload?.name || row?.name || '';
  const n = Number(row?.value || 0);
  return (
    <div className="admin-motion-callout" role="tooltip">
      <div className="admin-motion-callout-label">{title}</div>
      <strong>{formatHrMoney(n)}</strong>
    </div>
  );
}

/** Compact axis ticks for large تومان amounts (میلیون). */
function costAxisTick(v: number): string {
  if (!Number.isFinite(v) || v === 0) return '۰';
  if (Math.abs(v) >= 1_000_000) return `${formatNumFa(Math.round(v / 1_000_000))}${tr('م')}`;
  if (Math.abs(v) >= 1_000) return `${formatNumFa(Math.round(v / 1_000))}${tr('ه')}`;
  return formatNumFa(v);
}

export function AdminHrDashboardPage() {
  const motion = useRechartsMotion();
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
  const costDeptData = data?.charts?.costByDepartment || [];
  const statusData = data?.charts?.byContractStatus || [];
  const locData = data?.charts?.byLocation || [];
  const monthLabel = data?.monthLabel || '';

  const statusPie = useMemo(
    () => statusData.map((s, i) => ({ ...s, color: STATUS_COLORS[i % STATUS_COLORS.length] })),
    [statusData],
  );

  const chartRowHeight = Math.max(
    220,
    40 * Math.max(deptData.length, costDeptData.length, 3),
  );

  const kpiItems: AdminKpiItem[] = k
    ? [
        { key: 'personnel', label: tr('کل پرسنل'), value: formatNumFa(k.personnel), icon: Users, tone: 'mint' },
        { key: 'active', label: tr('دسترسی فعال'), value: formatNumFa(k.activeAccess), icon: UserCheck, tone: 'sky' },
        { key: 'inactive', label: tr('دسترسی غیرفعال'), value: formatNumFa(k.inactiveAccess), icon: UserX, tone: 'orange' },
        { key: 'cockpit', label: tr('وظایف کارتابل'), value: formatNumFa(k.cockpitTasks), icon: Briefcase, tone: 'violet' },
        { key: 'requests', label: tr('درخواست باز'), value: formatNumFa(k.openRequests), icon: Briefcase, tone: 'orange' },
        { key: 'onboard', label: tr('آنبوردینگ'), value: formatNumFa(k.openOnboarding), icon: Users, tone: 'sky' },
        {
          key: 'hours',
          label: `ساعت فعالیت${monthLabel ? ` · ${monthLabel}` : ''}`,
          value: `${formatNumFa(k.serviceHoursMonth)} س`,
          icon: Clock,
          tone: 'mint',
        },
        {
          key: 'cost',
          label: `هزینه سازمانی${monthLabel ? ` · ${monthLabel}` : ''}`,
          value: formatHrMoney(k.orgCostMonth),
          icon: Wallet,
          tone: 'violet',
          wide: true,
        },
      ]
    : [];

  return (
    <AdminDashPage
      className="hr-dash"
      title={tr("داشبورد منابع انسانی")}
      subtitle={`خلاصه اطلاعات کلیدی پیوند${monthLabel ? ` · ${monthLabel}` : ''}`}
      onRefresh={() => void load()}
      error={error}
      actions={
        <>
          <Link to="/admin/hr/recruitment" className="admin-btn admin-btn--ghost">
            {tr('داشبورد جذب')}
          </Link>
          <Link to="/admin/hr/reports" className="admin-btn admin-btn--ghost">
            {tr('گزارشات')}
          </Link>
        </>
      }
    >
      <AdminKpiStrip items={kpiItems} ariaLabel="شاخص‌های HR" />

      <AdminChartGrid cols={2}>
        <AdminChartCard
          title={tr("توزیع پرسنل بر اساس واحد سازمانی")}
          subtitle="بر اساس دپارتمان"
          empty={!deptData.length}
          emptyHint="هنوز پرسنلی برای نمودار ثبت نشده"
          height={chartRowHeight}
          rtlHBars
        >
          <ResponsiveContainer width="100%" height={chartRowHeight}>
            <BarChart layout="vertical" data={deptData} margin={{ ...adminRtlHBarsMargin }}>
              <MotionBarGradientDefs id="hrDeptBar" from={MOTION_PALETTE.mint} to={MOTION_PALETTE.purple} />
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--admin-border)" />
              <XAxis {...adminRtlHBarsValueAxis} />
              <YAxis dataKey="name" {...adminRtlHBarsCategoryAxis} />
              <Tooltip content={<MotionChartTooltip />} cursor={{ fill: 'rgba(92,77,145,0.06)' }} />
              <Bar dataKey="count" radius={adminRtlHBarsRadius} maxBarSize={22} name="نفر" {...motion}>
                {deptData.map((_, i) => (
                  <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AdminChartCard>

        <AdminChartCard
          title={tr("میزان هزینه در هر واحد")}
          subtitle={monthLabel || 'این ماه'}
          empty={!costDeptData.length}
          emptyHint="هزینه‌ای برای این ماه ثبت نشده"
          height={chartRowHeight}
          rtlHBars
        >
          <ResponsiveContainer width="100%" height={chartRowHeight}>
            <BarChart layout="vertical" data={costDeptData} margin={{ ...adminRtlHBarsMargin }}>
              <MotionBarGradientDefs id="hrCostBar" from={MOTION_PALETTE.coral} to={MOTION_PALETTE.purple} />
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--admin-border)" />
              <XAxis {...adminRtlHBarsValueAxis} tickFormatter={costAxisTick} domain={[0, 'auto']} />
              <YAxis dataKey="name" {...adminRtlHBarsCategoryAxis} />
              <Tooltip content={<HrMoneyTip />} cursor={{ fill: 'rgba(92,77,145,0.06)' }} />
              <Bar dataKey="total" radius={adminRtlHBarsRadius} maxBarSize={22} name="هزینه" {...motion}>
                {costDeptData.map((_, i) => (
                  <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AdminChartCard>
      </AdminChartGrid>

      <AdminChartGrid cols={3}>
        <AdminChartCard title={tr("وضعیت قرارداد")} empty={!statusPie.length}>
          <div className="hr-dash-donut-wrap">
            <div className="hr-dash-chart" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPie} dataKey="count" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2} {...motion}>
                    {statusPie.map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<MotionChartTooltip />} />
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
          </div>
        </AdminChartCard>

        <AdminChartCard
          title={tr("توزیع مکانی")}
          empty={!locData.length}
          emptyHint="موقعیتی ثبت نشده"
          height={Math.max(200, 36 * Math.max(locData.length, 3))}
          rtlHBars
        >
          <ResponsiveContainer width="100%" height={Math.max(200, 36 * Math.max(locData.length, 3))}>
            <BarChart layout="vertical" data={locData} margin={{ ...adminRtlHBarsMargin }}>
              <MotionBarGradientDefs id="hrLocBar" from={MOTION_PALETTE.purple} to={MOTION_PALETTE.blue} />
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--admin-border)" />
              <XAxis {...adminRtlHBarsValueAxis} />
              <YAxis dataKey="name" {...adminRtlHBarsCategoryAxis} />
              <Tooltip content={<MotionChartTooltip />} cursor={{ fill: 'rgba(92,77,145,0.06)' }} />
              <Bar dataKey="count" radius={adminRtlHBarsRadius} maxBarSize={18} fill="url(#hrLocBar-h)" {...motion} />
            </BarChart>
          </ResponsiveContainer>
        </AdminChartCard>

        <AdminChartCard title={tr("کارتابل (پیش‌نمایش)")} href="/admin/hr/cockpit" hrefLabel="کامل →" empty={!data?.cockpitPreview?.length} emptyHint="وظیفه‌ای نیست">
          <ul className="admin-log-list">
            {(data?.cockpitPreview || []).map((t, i) => (
              <li key={i}>
                <b>{t.type}</b>
                {t.employeeName ? ` · ${t.employeeName}` : ''}
                <div className="admin-muted">{t.detail || t.label || ''}</div>
              </li>
            ))}
          </ul>
        </AdminChartCard>
      </AdminChartGrid>

      {data ? <HrLinkGrid links={data.links.map((l) => ({ to: l.to, label: l.label, sub: 'باز کردن ماژول' }))} /> : null}
    </AdminDashPage>
  );
}
