import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Briefcase,
  HeartHandshake,
  Mail,
  Package,
  PawPrint,
  Stethoscope,
  Users,
  Wallet,
  Headphones,
  Building2,
} from 'lucide-react';
import { petPublicIdOf, orderPublicIdOf, consultPublicIdOf, userPublicIdOf } from '@petdate/shared';
import { adminFetch, formatNumFa, formatTomanFa } from '../api';
import { AdminIdChip } from '../AdminIds';
import { AdminEntityCell, AdminThumb } from '../AdminThumb';
import {
  JalaliDateRange,
  formatAdminFaDateTime,
  formatJalaliSlash,
  jalaliPartsToGregorianIso,
  type JalaliDateValue,
} from '../JalaliDateSelect';
import {
  CategoryBarWidget,
  CategoryDonutWidget,
  CategoryFunnelWidget,
  CalendarWidget,
  PLATFORM_WIDGET_CATALOG,
  TimeBarWidget,
  TimeLineWidget,
  TimeMultiLineWidget,
  WidgetDashboard,
  WidgetEmpty,
  type WidgetRenderContext,
} from '../widgets';
import {
  AdminDashPage,
  AdminKpiStrip,
  AdminModuleCard,
  AdminModuleGrid,
  type AdminKpiItem,
} from '../dash';
import { tr } from '../../i18n';

type ChartPoint = { label: string; value: number };
type ChartSlice = { label: string; value: number; color: string };

type Dash = {
  generatedAt: string;
  filterOptions?: {
    teams: string[];
    people: Array<{ id: number; name: string }>;
  };
  stats: {
    users: number;
    pets: number;
    playdates: number;
    playdatesPending: number;
    vetConsults: number;
    vetConsultsOpen: number;
    shopOrders: number;
    shopRevenueToman: number;
    walletTotals: { coins: number; toman: number; ton: number; stars: number };
    paymentOrdersPending: number;
    botRelated: { chatMessages: number; openGames: number; errors24h: number };
  };
  modules?: {
    platform: {
      users: number;
      pets: number;
      playdates: number;
      playdatesPending: number;
      vetConsults: number;
      vetConsultsOpen: number;
      shopOrders: number;
      shopRevenueToman: number;
      paymentOrdersPending: number;
      walletToman: number;
      errors24h: number;
    };
    hr: {
      personnel: number;
      activeAccess: number;
      openRequests: number;
      openOnboarding: number;
      cockpitTasks: number;
      unreadNotifications: number;
      orgCostMonth: number;
      serviceHoursMonth: number;
    };
    sales: {
      activeLeads: number;
      activeUpgrades: number;
      salesTodayCount: number;
      salesTodayValue: number;
      overdueFollowups: number;
      pendingFinance: number;
      callsToday: number;
      totalWonValue: number;
      aov: number;
    };
    crm: {
      openTickets: number;
      breachedSla: number;
      atRiskSla: number;
      unassigned: number;
      overdueFollowups: number;
      openComplaints: number;
      callsToday: number;
      avgCsat: number | null;
    };
    mail: { configured: boolean; address: string; unread: number; total: number };
  } | null;
  series?: {
    usersTrend: ChartPoint[];
    petsTrend: ChartPoint[];
    playdatesTrend: ChartPoint[];
    consultsTrend: ChartPoint[];
    revenueTrend: ChartPoint[];
    salesDailyRevenue: ChartPoint[];
    salesDailyCalls: ChartPoint[];
    salesStages: ChartPoint[];
    crmDailyTickets: ChartPoint[];
    crmReasons: ChartPoint[];
    paymentMix: ChartPoint[];
    activityBreakdown: ChartPoint[];
    moduleMix: ChartSlice[];
  } | null;
  links?: Record<string, string> | null;
  recentPets: Array<{
    id: number;
    publicId?: string;
    name: string;
    species: string;
    breed?: string;
    city?: string;
    ownerId: number;
    imageUrl?: string;
  }>;
  recentShopOrders: Array<{
    id: number;
    publicId?: string;
    status: string;
    totalToman: number;
    userId?: number;
    userAvatarUrl?: string;
    userName?: string;
    customerName?: string;
  }>;
  recentConsults: Array<{
    id: number;
    publicId?: string;
    status: string;
    patientName?: string;
    vetName?: string;
    petName?: string;
    patientUserId: number;
    vetUserId: number;
    petId?: number | null;
    patientAvatarUrl?: string;
    vetAvatarUrl?: string;
    petImageUrl?: string;
  }>;
};

type ActivityRow = {
  id: string;
  at: string;
  actor: string;
  action: string;
  entityType: string;
  entityLabel: string;
  refPath?: string;
  source: string;
};

const PAY_COLORS = ['#5c4d91', '#15cca0', '#f59e0b', '#0ea5e9', '#ec4899'];

type Standing = 'در مسیر درست' | 'نیازمند تلاش بیشتر' | 'ضعیف';
type DashKpi = { key: string; label: string; value: number; target: number; unit: string; standing: Standing; pct: number };

const STANDING_COLOR: Record<string, string> = {
  'در مسیر درست': '#15cca0',
  'نیازمند تلاش بیشتر': '#fd961e',
  ضعیف: '#c62828',
};

function standingOf(pct: number): Standing {
  if (pct >= 90) return 'در مسیر درست';
  if (pct >= 70) return 'نیازمند تلاش بیشتر';
  return 'ضعیف';
}

function makeKpi(key: string, label: string, value: number, target: number, unit: string, invert = false): DashKpi {
  const safeTarget = Math.max(1, target);
  const raw = invert ? (value <= 0 ? 100 : Math.max(0, 100 - (value / safeTarget) * 100)) : (value / safeTarget) * 100;
  const pct = Math.round(Math.max(0, Math.min(150, raw)));
  return { key, label, value, target: safeTarget, unit, pct, standing: standingOf(pct) };
}

function GaugeSemi({ pct, standing }: { pct: number; standing: string }) {
  const color = STANDING_COLOR[standing] || '#c62828';
  const clamped = Math.max(0, Math.min(100, pct));
  const r = 70;
  const c = Math.PI * r;
  const filled = (clamped / 100) * c;
  return (
    <div className="crm-gauge" aria-label={`${tr('تحقق ')}${pct}${tr(' درصد')}`}>
      <svg viewBox="0 0 180 110" width="180" height="110">
        <path d="M 20 95 A 70 70 0 0 1 160 95" fill="none" stroke="var(--admin-border)" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M 20 95 A 70 70 0 0 1 160 95"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
        />
        <text x="90" y="78" textAnchor="middle" className="crm-gauge-value" fill={color}>
          {formatNumFa(clamped)}{tr('٪')}
        </text>
        <text x="90" y="98" textAnchor="middle" className="crm-gauge-sub" fill="var(--admin-muted)">
          {tr('سلامت کلی پلتفرم')}
        </text>
      </svg>
      <span className="crm-standing-pill" style={{ background: `${color}22`, color, borderColor: `${color}55` }}>
        {tr(standing)}
      </span>
    </div>
  );
}

function KpiRing({ kpi }: { kpi: DashKpi }) {
  const color = STANDING_COLOR[kpi.standing] || '#c62828';
  const r = 28;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, kpi.pct)) / 100) * circ;
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
          {tr('از')} {formatNumFa(kpi.target)}
        </text>
      </svg>
      <div className="crm-kpi-ring-label">{tr(kpi.label)}</div>
      <div className="admin-muted" style={{ fontSize: 11 }}>{tr(kpi.unit)}</div>
    </div>
  );
}

type DashFilters = {
  from: JalaliDateValue;
  to: JalaliDateValue;
  team: string;
  personId: string;
  module: string;
  paymentType: string;
  salesStage: string;
};

const emptyFilters: DashFilters = {
  from: null,
  to: null,
  team: '',
  personId: '',
  module: '',
  paymentType: '',
  salesStage: '',
};

function filtersToQs(f: DashFilters): string {
  const qs = new URLSearchParams();
  const fromIso = jalaliPartsToGregorianIso(f.from);
  const toIso = jalaliPartsToGregorianIso(f.to);
  if (fromIso) qs.set('from', fromIso);
  if (toIso) qs.set('to', toIso);
  if (f.team) qs.set('team', f.team);
  if (f.personId) qs.set('personId', f.personId);
  if (f.module) qs.set('module', f.module);
  if (f.paymentType) qs.set('paymentType', f.paymentType);
  if (f.salesStage) qs.set('salesStage', f.salesStage);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function AdminDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'activity'>('overview');
  const [filters, setFilters] = useState<DashFilters>(emptyFilters);

  const load = useCallback(async () => {
    try {
      const qs = filtersToQs(filters);
      const [dash, act] = await Promise.all([
        adminFetch<Dash>(`/api/admin/dashboard${qs}`),
        adminFetch<{ rows: ActivityRow[] }>(`/api/admin/dashboard/activity${qs}`),
      ]);
      setData(dash);
      setActivity(act.rows || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const applySlice = (patch: Partial<DashFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const s = data?.stats;
  const m = data?.modules;
  const series = data?.series;
  const links = data?.links;
  const healthKpis = useMemo(() => {
    if (!s || !m) return [] as DashKpi[];
    return [
      makeKpi('users', 'کاربران فعال پلتفرم', s.users, Math.max(s.users, 100), 'نفر'),
      makeKpi('pets', 'پت‌های ثبت‌شده', s.pets, Math.max(s.pets, 80), 'پت'),
      makeKpi('playdates', 'همبازی باز', s.playdatesPending, Math.max(8, Math.round(s.playdatesPending * 1.2) || 8), 'مورد', true),
      makeKpi('consults', 'مشاوره باز', s.vetConsultsOpen, Math.max(6, Math.round(s.vetConsultsOpen * 1.2) || 6), 'مورد', true),
      makeKpi('sales', 'لید فعال فروش', m.sales.activeLeads, Math.max(m.sales.activeLeads, 20), 'لید'),
      makeKpi('crm_tickets', 'تیکت باز باشگاه', m.crm.openTickets, Math.max(10, Math.round(m.crm.openTickets * 1.15) || 10), 'تیکت', true),
      makeKpi('sla', 'نقض SLA', m.crm.breachedSla, Math.max(3, m.crm.breachedSla || 3), 'مورد', true),
      makeKpi('hr', 'درخواست باز HR', m.hr.openRequests, Math.max(5, Math.round(m.hr.openRequests * 1.2) || 5), 'درخواست', true),
    ];
  }, [s, m]);

  const overallPct = useMemo(() => {
    if (!healthKpis.length) return 0;
    return Math.round(healthKpis.reduce((a, k) => a + Math.min(100, k.pct), 0) / healthKpis.length);
  }, [healthKpis]);
  const overallStanding = standingOf(overallPct);
  const weakPoints = healthKpis.filter((k) => k.standing === 'ضعیف');

  const platformKpis: AdminKpiItem[] = s
    ? [
        { key: 'users', label: tr('کاربران'), value: formatNumFa(s.users), icon: Users, tone: 'violet', to: links?.users || '/admin/users' },
        { key: 'pets', label: tr('پت‌ها'), value: formatNumFa(s.pets), icon: PawPrint, tone: 'mint', to: links?.pets || '/admin/pets' },
        {
          key: 'playdates',
          label: tr('همبازی (باز)'),
          value: formatNumFa(s.playdatesPending),
          icon: HeartHandshake,
          tone: 'orange',
          to: links?.playdates || '/admin/playdates',
        },
        {
          key: 'consults',
          label: tr('مشاوره باز'),
          value: formatNumFa(s.vetConsultsOpen),
          icon: Stethoscope,
          tone: 'sky',
          to: links?.consults || '/admin/consults',
        },
        {
          key: 'shop',
          label: tr('سفارش فروشگاه'),
          value: formatNumFa(s.shopOrders),
          icon: Package,
          tone: 'slate',
          to: links?.shopOrders || '/admin/shop/orders',
        },
        {
          key: 'revenue',
          label: tr('درآمد فروشگاه'),
          value: formatTomanFa(s.shopRevenueToman),
          icon: Wallet,
          tone: 'mint',
          to: links?.finance || '/admin/finance',
          wide: true,
        },
        {
          key: 'pending',
          label: tr('پرداخت در انتظار'),
          value: formatNumFa(s.paymentOrdersPending),
          icon: Wallet,
          tone: 'orange',
          to: links?.payments || '/admin/payments',
        },
        {
          key: 'errors',
          label: tr('خطای ۲۴س'),
          value: formatNumFa(s.botRelated.errors24h),
          icon: Activity,
          tone: 'orange',
          to: '/admin/logs',
        },
      ]
    : [];

  const moduleCards = m
    ? [
        {
          key: 'hr',
          title: tr('پیوند · منابع انسانی'),
          to: links?.hr || '/admin/hr',
          icon: Building2,
          tone: 'mint',
          items: [
            { label: tr('پرسنل'), value: formatNumFa(m.hr.personnel) },
            { label: tr('درخواست باز'), value: formatNumFa(m.hr.openRequests) },
            { label: tr('کارتابل'), value: formatNumFa(m.hr.cockpitTasks) },
            { label: tr('آنبوردینگ'), value: formatNumFa(m.hr.openOnboarding) },
          ],
        },
        {
          key: 'sales',
          title: tr('فروش · CRM'),
          to: links?.sales || '/admin/sales',
          icon: Briefcase,
          tone: 'orange',
          items: [
            { label: tr('لید فعال'), value: formatNumFa(m.sales.activeLeads) },
            { label: tr('فروش امروز'), value: formatNumFa(m.sales.salesTodayCount) },
            { label: tr('پیگیری سررسید'), value: formatNumFa(m.sales.overdueFollowups) },
            { label: tr('در انتظار مالی'), value: formatNumFa(m.sales.pendingFinance) },
          ],
        },
        {
          key: 'crm',
          title: tr('باشگاه مشتریان · پشتیبانی'),
          to: links?.crm || '/admin/crm',
          icon: Headphones,
          tone: 'sky',
          items: [
            { label: tr('تیکت باز'), value: formatNumFa(m.crm.openTickets) },
            { label: tr('نقض SLA'), value: formatNumFa(m.crm.breachedSla) },
            { label: tr('شکایت باز'), value: formatNumFa(m.crm.openComplaints) },
            {
              label: 'CSAT',
              value: m.crm.avgCsat != null ? formatNumFa(m.crm.avgCsat) : '—',
            },
          ],
        },
        {
          key: 'mail',
          title: tr('صندوق ایمیل'),
          to: links?.mail || '/admin/mail',
          icon: Mail,
          tone: m.mail.configured ? 'violet' : 'slate',
          items: [
            { label: tr('خوانده‌نشده'), value: formatNumFa(m.mail.unread) },
            { label: tr('کل پیام'), value: formatNumFa(m.mail.total) },
            { label: tr('وضعیت'), value: m.mail.configured ? 'فعال' : 'خاموش' },
            { label: tr('آدرس'), value: m.mail.address || '—' },
          ],
        },
      ]
    : [];

  const activeFilterChips = [
    filters.from || filters.to
      ? `بازه: ${formatJalaliSlash(filters.from) || '…'} → ${formatJalaliSlash(filters.to) || '…'}`
      : null,
    filters.team ? `تیم: ${filters.team}` : null,
    filters.personId
      ? `فرد: ${data?.filterOptions?.people.find((p) => String(p.id) === filters.personId)?.name || filters.personId}`
      : null,
    filters.module ? `ماژول: ${filters.module}` : null,
    filters.paymentType ? `پرداخت: ${filters.paymentType}` : null,
    filters.salesStage ? `قیف فروش: ${filters.salesStage}` : null,
  ].filter(Boolean) as string[];

  const renderPlatformWidget = (id: string, ctx: WidgetRenderContext) => {
    if (id === 'dualCalendar') return <CalendarWidget ctx={ctx} />;
    if (!series) return <WidgetEmpty />;
    switch (id) {
      case 'moduleMix':
        return (
          <CategoryDonutWidget
            slices={series.moduleMix}
            ctx={ctx}
            onSliceClick={(s) => applySlice({ module: s.label })}
          />
        );
      case 'volume14d':
        return (
          <TimeMultiLineWidget
            ctx={ctx}
            series={[
              { key: 'users', label: 'کاربران', color: '#5c4d91', points: series.usersTrend },
              { key: 'pets', label: 'پت‌ها', color: '#15cca0', points: series.petsTrend },
              { key: 'playdates', label: 'همبازی', color: '#f59e0b', points: series.playdatesTrend },
              { key: 'consults', label: 'مشاوره', color: '#0ea5e9', points: series.consultsTrend },
            ]}
          />
        );
      case 'activityBreakdown':
        return (
          <CategoryBarWidget
            ctx={ctx}
            color="#5c4d91"
            points={series.activityBreakdown?.length ? series.activityBreakdown : series.crmReasons}
          />
        );
      case 'revenueTrend':
        return <TimeLineWidget points={series.revenueTrend} color="#5c4d91" ctx={ctx} />;
      case 'salesFunnel':
        return (
          <CategoryFunnelWidget
            ctx={ctx}
            points={series.salesStages}
            onSliceClick={(p) => applySlice({ salesStage: p.label })}
          />
        );
      case 'paymentMix':
        return (
          <CategoryDonutWidget
            ctx={ctx}
            slices={series.paymentMix.map((p, i) => ({
              label: p.label,
              value: p.value,
              color: PAY_COLORS[i % PAY_COLORS.length]!,
            }))}
            onSliceClick={(s) => applySlice({ paymentType: s.label })}
          />
        );
      case 'crmTickets':
        return (
          <TimeLineWidget
            ctx={ctx}
            color="#0ea5e9"
            points={
              series.crmDailyTickets.length
                ? series.crmDailyTickets
                : series.crmReasons.map((r) => ({ label: r.label, value: r.value }))
            }
          />
        );
      case 'crmReasons':
        return (
          <CategoryBarWidget
            ctx={ctx}
            color="#15cca0"
            points={series.crmReasons.length ? series.crmReasons : series.activityBreakdown}
          />
        );
      case 'salesDailyRevenue':
        return <TimeLineWidget points={series.salesDailyRevenue} color="#ec4899" ctx={ctx} />;
      case 'salesDailyCalls':
        return <TimeBarWidget points={series.salesDailyCalls} color="#5c4d91" ctx={ctx} />;
      default:
        return <WidgetEmpty />;
    }
  };

  return (
    <AdminDashPage
      title={tr("داشبورد پلتفرم")}
      live
      subtitle={
        <>
          {tr('گزارش یکپارچهٔ پلتفرم · پیوند · فروش · باشگاه مشتریان · ایمیل')}
          {data?.generatedAt ? ` · ${formatAdminFaDateTime(data.generatedAt)}` : ''}
        </>
      }
      onRefresh={() => void load()}
      error={error}
      tabs={
        <div className="admin-tabs" role="tablist">
          <button
            type="button"
            className={`admin-tab${tab === 'overview' ? ' is-on' : ''}`}
            onClick={() => setTab('overview')}
          >
            {tr('نمای کلی')}
          </button>
          <button
            type="button"
            className={`admin-tab${tab === 'activity' ? ' is-on' : ''}`}
            onClick={() => setTab('activity')}
          >
            {tr('فعالیت‌ها')}
          </button>
        </div>
      }
      filters={
        <section className="admin-card admin-dash-filters" style={{ padding: 14 }}>
          <div className="admin-card-head" style={{ marginBottom: 10 }}>
            <h2 style={{ fontSize: '0.95rem', margin: 0 }}>{tr('فیلترها')}</h2>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setFilters(emptyFilters)}>
              {tr('پاک کردن')}
            </button>
          </div>
          <div className="hr-reports-filters" role="group" aria-label={tr("فیلتر داشبورد")}>
            <JalaliDateRange
              from={filters.from}
              to={filters.to}
              onFromChange={(from) => setFilters((f) => ({ ...f, from }))}
              onToChange={(to) => setFilters((f) => ({ ...f, to }))}
              fromLabel="از تاریخ"
              toLabel="تا تاریخ"
            />
            <label className="hr-reports-filter">
              <span>{tr('تیم / دپارتمان')}</span>
              <select
                className="admin-select"
                value={filters.team}
                onChange={(e) => setFilters((f) => ({ ...f, team: e.target.value }))}
              >
                <option value="">{tr('همه')}</option>
                {(data?.filterOptions?.teams || []).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="hr-reports-filter">
              <span>{tr('فرد')}</span>
              <select
                className="admin-select"
                value={filters.personId}
                onChange={(e) => setFilters((f) => ({ ...f, personId: e.target.value }))}
              >
                <option value="">{tr('همه')}</option>
                {(data?.filterOptions?.people || []).map((p) => (
                  <option key={p.id} value={String(p.id)}>{p.name}</option>
                ))}
              </select>
            </label>
          </div>
          {activeFilterChips.length ? (
            <div className="admin-filter-chips" style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {activeFilterChips.map((c) => (
                <span key={c} className="admin-pill admin-pill--line">{c}</span>
              ))}
              <span className="admin-muted" style={{ fontSize: 12 }}>
                {tr('کلیک روی برش نمودار، فیلتر را اعمال می‌کند')}
              </span>
            </div>
          ) : null}
        </section>
      }
    >
      {tab === 'activity' ? (
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>{tr('فعالیت‌های سیستم')}</h2>
            <span className="admin-muted">{formatNumFa(activity.length)} {tr('ردیف')}</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--dense">
              <thead>
                <tr>
                  <th>{tr('زمان')}</th>
                  <th>{tr('عامل')}</th>
                  <th>{tr('اقدام')}</th>
                  <th>{tr('مرجع')}</th>
                  <th>{tr('منبع')}</th>
                </tr>
              </thead>
              <tbody>
                {activity.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="admin-muted">{tr('فعالیتی نیست')}</td>
                  </tr>
                ) : (
                  activity.map((row) => (
                    <tr key={row.id}>
                      <td className="admin-mono" dir="ltr">
                        {row.at ? formatAdminFaDateTime(row.at) : '—'}
                      </td>
                      <td>{row.actor}</td>
                      <td>{row.action}</td>
                      <td>
                        {row.refPath ? (
                          <Link to={row.refPath}>{row.entityLabel || row.entityType}</Link>
                        ) : (
                          row.entityLabel || row.entityType
                        )}
                      </td>
                      <td>
                        <span className="admin-pill">{row.source}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <>
          {healthKpis.length ? (
            <section className="admin-card crm-kpi-panel" style={{ marginBottom: 16 }}>
              <div className="admin-card-head">
                <h2>{tr('وضعیت سلامت پلتفرم نسبت به شاخص‌ها')}</h2>
                <span className="admin-muted">{tr('پنل پویا · مشابه باشگاه مشتریان')}</span>
              </div>
              <div className="crm-kpi-layout">
                <GaugeSemi pct={overallPct} standing={overallStanding} />
                <div className="crm-kpi-rings">
                  {healthKpis.map((k) => (
                    <KpiRing key={k.key} kpi={k} />
                  ))}
                </div>
                <div className="crm-kpi-legend">
                  <div className="crm-legend-item" style={{ borderColor: '#15cca055', background: '#15cca014' }}>
                    <strong style={{ color: '#0f9a78' }}>{tr('در مسیر درست')}</strong>
                    <span>{tr('۹۰٪ و بالاتر')}</span>
                  </div>
                  <div className="crm-legend-item" style={{ borderColor: '#fd961e55', background: '#fd961e14' }}>
                    <strong style={{ color: '#c77810' }}>{tr('نیازمند تلاش بیشتر')}</strong>
                    <span>{tr('۷۰٪ تا ۹۰٪')}</span>
                  </div>
                  <div className="crm-legend-item" style={{ borderColor: '#c6282855', background: '#c6282814' }}>
                    <strong style={{ color: '#c62828' }}>{tr('ضعیف')}</strong>
                    <span>{tr('زیر ۷۰٪')}</span>
                  </div>
                </div>
              </div>
              {weakPoints.length ? (
                <div className="crm-weak-points">
                  <strong>{tr('نقاط ضعف:')}</strong>{' '}
                  {weakPoints
                    .map((k) => `${tr(k.label)}: ${formatNumFa(k.value)}${tr(' از ')}${formatNumFa(k.target)} (${formatNumFa(k.pct)}${tr('٪)')}`)
                    .join(' · ')}
                </div>
              ) : (
                <div className="crm-weak-points crm-weak-points--ok">{tr('همه شاخص‌های اصلی در مسیر مطلوب هستند.')}</div>
              )}
            </section>
          ) : null}

          <p className="admin-section-label">{tr('شاخص‌های زندهٔ پلتفرم')}</p>
          <AdminKpiStrip items={platformKpis} ariaLabel="شاخص‌های زنده پلتفرم" />

          {moduleCards.length ? (
            <AdminModuleGrid label={tr("ماژول‌های سازمانی · پشتیبانی / جذب / فروش")}>
              {moduleCards.map((card) => (
                <AdminModuleCard
                  key={card.key}
                  title={tr(card.title)}
                  to={card.to}
                  icon={card.icon}
                  tone={card.tone as 'mint' | 'violet' | 'orange' | 'sky' | 'slate'}
                  items={card.items}
                />
              ))}
            </AdminModuleGrid>
          ) : null}

          {series ? (
            <WidgetDashboard
              dashboardId="platform"
              catalog={PLATFORM_WIDGET_CATALOG}
              title={tr("گزارش تجمیعی · ویجت‌ها")}
              renderWidget={renderPlatformWidget}
            />
          ) : null}

          <p className="admin-section-label">{tr('آخرین فعالیت‌ها')}</p>
          <div className="admin-dash-grid">
            <section className="admin-card">
              <div className="admin-card-head">
                <h2>{tr('آخرین پت‌ها')}</h2>
                <Link to="/admin/pets">{tr('همه')}</Link>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{tr('آیدی')}</th>
                      <th>{tr('نام')}</th>
                      <th>{tr('گونه')}</th>
                      <th>{tr('مالک')}</th>
                      <th>{tr('شهر')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.recentPets ?? []).map((pet) => (
                      <tr key={pet.id}>
                        <td>
                          <AdminIdChip publicId={petPublicIdOf(pet)} />
                        </td>
                        <td>
                          <AdminEntityCell
                            thumb={
                              <AdminThumb
                                src={pet.imageUrl}
                                petId={pet.id}
                                kind="pet"
                                label={pet.name}
                                alt={pet.name}
                              />
                            }
                            title={<strong>{pet.name}</strong>}
                            subtitle={pet.breed || '—'}
                          />
                        </td>
                        <td>{pet.species}</td>
                        <td>
                          <code className="admin-mono admin-id-public" dir="ltr">
                            {userPublicIdOf({ id: pet.ownerId })}
                          </code>
                        </td>
                        <td>{pet.city || '—'}</td>
                      </tr>
                    ))}
                    {!data?.recentPets?.length ? (
                      <tr>
                        <td colSpan={5} className="admin-muted">{tr('موردی نیست')}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="admin-card">
              <div className="admin-card-head">
                <h2>{tr('سفارش فروشگاه')}</h2>
                <Link to="/admin/shop/orders">{tr('همه')}</Link>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{tr('آیدی سفارش')}</th>
                      <th>{tr('کاربر')}</th>
                      <th>{tr('مبلغ')}</th>
                      <th>{tr('وضعیت')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.recentShopOrders ?? []).map((o) => (
                      <tr key={o.id}>
                        <td>
                          <AdminIdChip publicId={orderPublicIdOf(o)} />
                        </td>
                        <td>
                          <AdminEntityCell
                            thumb={
                              <AdminThumb
                                src={o.userAvatarUrl}
                                label={o.userName || o.customerName}
                                kind="user"
                              />
                            }
                            title={
                              o.userId != null ? (
                                <code className="admin-mono admin-id-public" dir="ltr">
                                  {userPublicIdOf({ id: o.userId })}
                                </code>
                              ) : (
                                '—'
                              )
                            }
                            subtitle={o.userName || o.customerName || null}
                          />
                        </td>
                        <td>{formatTomanFa(o.totalToman)}</td>
                        <td>
                          <span className="admin-badge">{o.status}</span>
                        </td>
                      </tr>
                    ))}
                    {!data?.recentShopOrders?.length ? (
                      <tr>
                        <td colSpan={4} className="admin-muted">{tr('سفارشی نیست')}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="admin-card">
              <div className="admin-card-head">
                <h2>{tr('مشاوره دامپزشک')}</h2>
                <Link to="/admin/consults">{tr('صف')}</Link>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{tr('آیدی')}</th>
                      <th>{tr('بیمار')}</th>
                      <th>{tr('پزشک')}</th>
                      <th>{tr('پت')}</th>
                      <th>{tr('وضعیت')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.recentConsults ?? []).map((c) => (
                      <tr key={c.id}>
                        <td>
                          <AdminIdChip publicId={consultPublicIdOf(c)} />
                        </td>
                        <td>
                          <AdminEntityCell
                            thumb={<AdminThumb src={c.patientAvatarUrl} label={c.patientName} kind="user" />}
                            title={c.patientName || '—'}
                            subtitle={
                              <code className="admin-mono admin-id-public" dir="ltr">
                                {userPublicIdOf({ id: c.patientUserId })}
                              </code>
                            }
                          />
                        </td>
                        <td>
                          <AdminEntityCell
                            thumb={<AdminThumb src={c.vetAvatarUrl} label={c.vetName} kind="user" />}
                            title={c.vetName || '—'}
                            subtitle={
                              <code className="admin-mono admin-id-public" dir="ltr">
                                {userPublicIdOf({ id: c.vetUserId })}
                              </code>
                            }
                          />
                        </td>
                        <td>
                          <AdminEntityCell
                            thumb={
                              <AdminThumb
                                src={c.petImageUrl}
                                petId={c.petId ?? undefined}
                                kind="pet"
                                label={c.petName}
                              />
                            }
                            title={c.petName || '—'}
                            subtitle={
                              c.petId != null ? (
                                <code className="admin-mono admin-id-public" dir="ltr">
                                  {petPublicIdOf({ id: c.petId })}
                                </code>
                              ) : null
                            }
                          />
                        </td>
                        <td>
                          <span className="admin-badge">{c.status}</span>
                        </td>
                      </tr>
                    ))}
                    {!data?.recentConsults?.length ? (
                      <tr>
                        <td colSpan={5} className="admin-muted">{tr('موردی نیست')}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="admin-card">
              <div className="admin-card-head">
                <h2>{tr('کیف پول کل')}</h2>
                <Link to="/admin/finance/wallet">{tr('کیف پول')}</Link>
              </div>
              {s ? (
                <ul className="admin-kv">
                  <li>
                    <span>{tr('سکه')}</span>
                    <strong>{formatNumFa(s.walletTotals.coins)}</strong>
                  </li>
                  <li>
                    <span>{tr('تومان')}</span>
                    <strong>{formatNumFa(s.walletTotals.toman)}</strong>
                  </li>
                  <li>
                    <span>TON</span>
                    <strong>{formatNumFa(s.walletTotals.ton)}</strong>
                  </li>
                  <li>
                    <span>Stars</span>
                    <strong>{formatNumFa(s.walletTotals.stars)}</strong>
                  </li>
                </ul>
              ) : (
                <p className="admin-dash-chart-empty">{tr('داده‌ای نیست')}</p>
              )}
            </section>
          </div>
        </>
      )}
    </AdminDashPage>
  );
}
