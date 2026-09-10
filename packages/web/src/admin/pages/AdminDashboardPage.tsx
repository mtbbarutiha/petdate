import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Briefcase,
  HeartHandshake,
  Inbox,
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
import {
  AdminBarChart,
  AdminDonutChart,
  AdminLineChart,
  AdminMultiLineChart,
} from '../FinanceCharts';
import { AdminIdChip } from '../AdminIds';
import { AdminEntityCell, AdminThumb } from '../AdminThumb';

type ChartPoint = { label: string; value: number };
type ChartSlice = { label: string; value: number; color: string };

type Dash = {
  generatedAt: string;
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

const PAY_COLORS = ['#5c4d91', '#15cca0', '#f59e0b', '#0ea5e9', '#ec4899'];

export function AdminDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const dash = await adminFetch<Dash>('/api/admin/dashboard');
      setData(dash);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const s = data?.stats;
  const m = data?.modules;
  const series = data?.series;
  const links = data?.links;

  const platformKpis = s
    ? [
        { label: 'کاربران', value: formatNumFa(s.users), icon: Users, tone: 'violet', to: links?.users || '/admin/users' },
        { label: 'پت‌ها', value: formatNumFa(s.pets), icon: PawPrint, tone: 'mint', to: links?.pets || '/admin/pets' },
        {
          label: 'همبازی (باز)',
          value: formatNumFa(s.playdatesPending),
          icon: HeartHandshake,
          tone: 'orange',
          to: links?.playdates || '/admin/playdates',
        },
        {
          label: 'مشاوره باز',
          value: formatNumFa(s.vetConsultsOpen),
          icon: Stethoscope,
          tone: 'sky',
          to: links?.consults || '/admin/consults',
        },
        {
          label: 'سفارش فروشگاه',
          value: formatNumFa(s.shopOrders),
          icon: Package,
          tone: 'slate',
          to: links?.shopOrders || '/admin/shop/orders',
        },
        {
          label: 'درآمد فروشگاه',
          value: formatTomanFa(s.shopRevenueToman),
          icon: Wallet,
          tone: 'mint',
          to: links?.finance || '/admin/finance',
        },
        {
          label: 'پرداخت در انتظار',
          value: formatNumFa(s.paymentOrdersPending),
          icon: Wallet,
          tone: 'orange',
          to: links?.payments || '/admin/payments',
        },
        {
          label: 'خطای ۲۴س',
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
          title: 'پیوند · منابع انسانی',
          to: links?.hr || '/admin/hr',
          icon: Building2,
          tone: 'mint',
          items: [
            { label: 'پرسنل', value: formatNumFa(m.hr.personnel) },
            { label: 'درخواست باز', value: formatNumFa(m.hr.openRequests) },
            { label: 'کارتابل', value: formatNumFa(m.hr.cockpitTasks) },
            { label: 'آنبوردینگ', value: formatNumFa(m.hr.openOnboarding) },
          ],
        },
        {
          key: 'sales',
          title: 'فروش · CRM',
          to: links?.sales || '/admin/sales',
          icon: Briefcase,
          tone: 'orange',
          items: [
            { label: 'لید فعال', value: formatNumFa(m.sales.activeLeads) },
            { label: 'فروش امروز', value: formatNumFa(m.sales.salesTodayCount) },
            { label: 'پیگیری سررسید', value: formatNumFa(m.sales.overdueFollowups) },
            { label: 'در انتظار مالی', value: formatNumFa(m.sales.pendingFinance) },
          ],
        },
        {
          key: 'crm',
          title: 'باشگاه مشتریان',
          to: links?.crm || '/admin/crm',
          icon: Headphones,
          tone: 'sky',
          items: [
            { label: 'تیکت باز', value: formatNumFa(m.crm.openTickets) },
            { label: 'نقض SLA', value: formatNumFa(m.crm.breachedSla) },
            { label: 'شکایت باز', value: formatNumFa(m.crm.openComplaints) },
            {
              label: 'CSAT',
              value: m.crm.avgCsat != null ? formatNumFa(m.crm.avgCsat) : '—',
            },
          ],
        },
        {
          key: 'mail',
          title: 'صندوق ایمیل',
          to: links?.mail || '/admin/mail',
          icon: Mail,
          tone: m.mail.configured ? 'violet' : 'slate',
          items: [
            { label: 'خوانده‌نشده', value: formatNumFa(m.mail.unread) },
            { label: 'کل پیام', value: formatNumFa(m.mail.total) },
            { label: 'وضعیت', value: m.mail.configured ? 'فعال' : 'خاموش' },
            { label: 'آدرس', value: m.mail.address || '—' },
          ],
        },
      ]
    : [];

  const trendSeries =
    series
      ? [
          { key: 'users', label: 'کاربران', color: '#5c4d91', points: series.usersTrend },
          { key: 'pets', label: 'پت‌ها', color: '#15cca0', points: series.petsTrend },
          { key: 'playdates', label: 'همبازی', color: '#f59e0b', points: series.playdatesTrend },
          { key: 'consults', label: 'مشاوره', color: '#0ea5e9', points: series.consultsTrend },
        ]
      : [];

  return (
    <div className="admin-page admin-page--exec">
      <header className="admin-header">
        <div>
          <h1>داشبورد پلتفرم</h1>
          <p>
            <span className="admin-live-pulse">زنده</span>
            {' '}
            گزارش یکپارچهٔ پلتفرم · پیوند · فروش · باشگاه مشتریان · ایمیل
            {data?.generatedAt ? ` · ${new Date(data.generatedAt).toLocaleString('fa-IR')}` : ''}
          </p>
        </div>
        <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void load()}>
          بروزرسانی
        </button>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}

      <p className="admin-section-label">شاخص‌های زندهٔ پلتفرم</p>
      <div className="admin-stats admin-stats--dense">
        {platformKpis.map((k) => (
          <Link
            key={k.label}
            to={k.to}
            className={`admin-stat admin-stat--${k.tone}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className="admin-stat-icon">
              <k.icon size={18} />
            </div>
            <div>
              <div className="admin-stat-value">{k.value}</div>
              <div className="admin-stat-label">{k.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {moduleCards.length ? (
        <>
          <p className="admin-section-label">ماژول‌های سازمانی</p>
          <div className="admin-module-kpi-grid">
            {moduleCards.map((card) => (
              <Link
                key={card.key}
                to={card.to}
                className={`admin-module-kpi admin-module-kpi--${card.tone}`}
              >
                <div className="admin-module-kpi-head">
                  <card.icon size={18} />
                  <strong>{card.title}</strong>
                  <span>باز کردن</span>
                </div>
                <div className="admin-module-kpi-body">
                  {card.items.map((it) => (
                    <div key={it.label}>
                      <em>{it.value}</em>
                      <span>{it.label}</span>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      {series ? (
        <>
          <p className="admin-section-label">گزارش تجمیعی · نمودارها</p>
          <div className="admin-report-grid admin-report-grid--hero">
            <section className="admin-card admin-card--chart">
              <div className="admin-card-head">
                <h2>روند ۱۴روزهٔ فعالیت پلتفرم</h2>
                <Link to="/admin/users">جزئیات</Link>
              </div>
              <div className="admin-chart-panel">
                <AdminMultiLineChart series={trendSeries} />
              </div>
            </section>
            <section className="admin-card admin-card--chart">
              <div className="admin-card-head">
                <h2>ترکیب بار ماژول‌ها</h2>
                <Link to="/admin/crm">CRM</Link>
              </div>
              <div className="admin-chart-panel">
                <AdminDonutChart slices={series.moduleMix} size={180} />
              </div>
            </section>
          </div>

          <div className="admin-report-grid admin-report-grid--3">
            <section className="admin-card admin-card--chart">
              <div className="admin-card-head">
                <h2>درآمد فروشگاه (ماه)</h2>
                <Link to="/admin/finance/sales">مالی</Link>
              </div>
              <div className="admin-chart-panel">
                <AdminLineChart points={series.revenueTrend} color="#5c4d91" />
              </div>
            </section>
            <section className="admin-card admin-card--chart">
              <div className="admin-card-head">
                <h2>مراحل قیف فروش</h2>
                <Link to="/admin/sales">فروش</Link>
              </div>
              <div className="admin-chart-panel">
                <AdminBarChart points={series.salesStages} color="#f59e0b" />
              </div>
            </section>
            <section className="admin-card admin-card--chart">
              <div className="admin-card-head">
                <h2>ترکیب پرداخت</h2>
                <Link to="/admin/payments">پرداخت‌ها</Link>
              </div>
              <div className="admin-chart-panel">
                <AdminDonutChart
                  slices={series.paymentMix.map((p, i) => ({
                    label: p.label,
                    value: p.value,
                    color: PAY_COLORS[i % PAY_COLORS.length],
                  }))}
                />
              </div>
            </section>
          </div>

          <div className="admin-report-grid">
            <section className="admin-card admin-card--chart">
              <div className="admin-card-head">
                <h2>تیکت‌های باشگاه مشتریان</h2>
                <Link to="/admin/crm/reports">گزارش CRM</Link>
              </div>
              <div className="admin-chart-panel">
                <AdminLineChart
                  points={
                    series.crmDailyTickets.length
                      ? series.crmDailyTickets
                      : series.crmReasons.map((r) => ({ label: r.label, value: r.value }))
                  }
                  color="#0ea5e9"
                />
              </div>
            </section>
            <section className="admin-card admin-card--chart">
              <div className="admin-card-head">
                <h2>دلایل تماس / تعامل CRM</h2>
                <Link to="/admin/crm/inbox">
                  <Inbox size={14} /> اینباکس
                </Link>
              </div>
              <div className="admin-chart-panel">
                <AdminBarChart
                  points={
                    series.crmReasons.length
                      ? series.crmReasons
                      : series.activityBreakdown
                  }
                  color="#15cca0"
                />
              </div>
            </section>
          </div>

          <div className="admin-report-grid">
            <section className="admin-card admin-card--chart">
              <div className="admin-card-head">
                <h2>درآمد روزانهٔ فروش CRM</h2>
                <Link to="/admin/sales/reports">گزارش فروش</Link>
              </div>
              <div className="admin-chart-panel">
                <AdminLineChart points={series.salesDailyRevenue} color="#ec4899" />
              </div>
            </section>
            <section className="admin-card admin-card--chart">
              <div className="admin-card-head">
                <h2>تماس‌های فروش (۱۴ روز)</h2>
                <Link to="/admin/sales">داشبورد فروش</Link>
              </div>
              <div className="admin-chart-panel">
                <AdminBarChart points={series.salesDailyCalls} color="#5c4d91" />
              </div>
            </section>
          </div>
        </>
      ) : null}

      <p className="admin-section-label">آخرین فعالیت‌ها</p>
      <div className="admin-dash-grid">
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>آخرین پت‌ها</h2>
            <Link to="/admin/pets">همه</Link>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>آیدی</th>
                  <th>نام</th>
                  <th>گونه</th>
                  <th>مالک</th>
                  <th>شهر</th>
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
                    <td colSpan={5} className="admin-muted">
                      موردی نیست
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>سفارش فروشگاه</h2>
            <Link to="/admin/shop/orders">همه</Link>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>آیدی سفارش</th>
                  <th>کاربر</th>
                  <th>مبلغ</th>
                  <th>وضعیت</th>
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
                    <td colSpan={4} className="admin-muted">
                      سفارشی نیست
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>مشاوره دامپزشک</h2>
            <Link to="/admin/consults">صف</Link>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>آیدی</th>
                  <th>بیمار</th>
                  <th>پزشک</th>
                  <th>پت</th>
                  <th>وضعیت</th>
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
                    <td colSpan={5} className="admin-muted">
                      موردی نیست
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>کیف پول کل</h2>
            <Link to="/admin/finance/wallet">کیف پول</Link>
          </div>
          {s ? (
            <ul className="admin-kv">
              <li>
                <span>سکه</span>
                <strong>{formatNumFa(s.walletTotals.coins)}</strong>
              </li>
              <li>
                <span>تومان</span>
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
              <li>
                <span>پرداخت در انتظار</span>
                <strong>{formatNumFa(s.paymentOrdersPending)}</strong>
              </li>
              <li>
                <span>پیام چت همبازی</span>
                <strong>{formatNumFa(s.botRelated.chatMessages)}</strong>
              </li>
              <li>
                <span>بازی باز</span>
                <strong>{formatNumFa(s.botRelated.openGames)}</strong>
              </li>
            </ul>
          ) : (
            <p className="admin-muted">…</p>
          )}
        </section>
      </div>
    </div>
  );
}
