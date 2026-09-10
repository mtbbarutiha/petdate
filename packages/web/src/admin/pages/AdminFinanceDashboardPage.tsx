import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight, ArrowUpRight, Download, LineChart, PieChart,
  ShoppingBag, TrendingUp, Wallet,
} from 'lucide-react';
import { adminDownload, adminFetch, formatNumFa, formatTomanFa } from '../api';
import {
  AdminBarChart,
  AdminDonutChart,
  AdminLineChart,
  PeriodFilter,
  type FinancePeriod,
} from '../FinanceCharts';

type ChartPoint = { label: string; value: number };
type ChartSlice = { label: string; value: number; currency?: string };

type Dash = {
  period: FinancePeriod;
  kpis: {
    revenue: number; expense: number; netProfit: number; orders: number;
    aov: number; growthRate: number; marginPct: number;
  };
  breakdown: {
    shopRevenue: number; paymentTopups: number; vetFees: number; playdateFees: number;
    cogs: number; operatingExpense: number;
  };
  charts?: {
    salesTrend: ChartPoint[];
    categories: ChartPoint[];
    paymentMix: ChartSlice[];
    pnlCompare: ChartPoint[];
    revenueMix: ChartPoint[];
  };
};

const PAY_COLORS = ['#5c4d91', '#15cca0', '#fd961e', '#0ba5f2', '#db89ca'];
const REV_COLORS = ['#5c4d91', '#15cca0', '#0ba5f2', '#fd961e'];

function shortDayLabel(label: string): string {
  // 2026-09-10 → 09-10 ; 2026-09 → 09
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return label.slice(5);
  if (/^\d{4}-\d{2}$/.test(label)) return label.slice(5);
  return label;
}

export function AdminFinanceDashboardPage() {
  const [period, setPeriod] = useState<FinancePeriod>('month');
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminFetch<Dash>(`/api/admin/finance/dashboard?period=${period}`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const k = data?.kpis;
  const charts = data?.charts;
  const cards = k ? [
    { label: 'درآمد', value: formatTomanFa(k.revenue), icon: TrendingUp, tone: 'mint' },
    { label: 'هزینه', value: formatTomanFa(k.expense), icon: ArrowDownRight, tone: 'orange' },
    { label: 'سود خالص', value: formatTomanFa(k.netProfit), icon: ArrowUpRight, tone: 'violet' },
    { label: 'سفارش‌ها', value: formatNumFa(k.orders), icon: ShoppingBag, tone: 'sky' },
    { label: 'میانگین سفارش (AOV)', value: formatTomanFa(k.aov), icon: Wallet, tone: 'slate' },
    { label: 'نرخ رشد', value: `${formatNumFa(k.growthRate)}٪`, icon: LineChart, tone: k.growthRate >= 0 ? 'mint' : 'orange' },
  ] : [];

  const pnlPoints = charts?.pnlCompare?.length
    ? charts.pnlCompare
    : k
      ? [
          { label: 'درآمد', value: k.revenue },
          { label: 'هزینه', value: k.expense },
          { label: 'سود', value: Math.max(0, k.netProfit) },
        ]
      : [];

  const salesTrend = (charts?.salesTrend ?? []).map((p) => ({
    ...p,
    label: shortDayLabel(p.label),
  }));

  const exportCsv = (kind: 'pnl' | 'sales') => {
    void adminDownload(
      `/api/admin/finance/export?kind=${kind}&period=${period}`,
      `petdate-${kind}-${period}.csv`
    ).catch((err) => {
      console.error(err);
      alert(err instanceof Error ? err.message : 'خروجی ناموفق بود');
    });
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>داشبورد مالی</h1>
          <p>آنالیتیکس پلتفرم · Finance OS (حساب‌ها، تراکنش‌ها، تخصیص هزینه)</p>
        </div>
        <div className="admin-header-actions">
          <PeriodFilter value={period} onChange={setPeriod} />
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => exportCsv('pnl')}>
            <Download size={16} /> خروجی P&L
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => exportCsv('sales')}>
            <Download size={16} /> خروجی فروش
          </button>
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-stats admin-stats--dense">
        {cards.map((c) => (
          <div key={c.label} className={`admin-stat admin-stat--${c.tone}`}>
            <div className="admin-stat-icon"><c.icon size={18} /></div>
            <div>
              <div className="admin-stat-value">{c.value}</div>
              <div className="admin-stat-label">{c.label}</div>
            </div>
          </div>
        ))}
        {!cards.length && loading ? (
          <p className="admin-muted" style={{ padding: 8 }}>در حال بارگذاری شاخص‌ها…</p>
        ) : null}
      </div>

      <p className="admin-section-label">نمودارهای اصلی</p>
      <div className="admin-dash-charts">
        <section className="admin-card admin-card--chart-lg">
          <div className="admin-card-head">
            <h2>{period === 'year' ? 'روند فروش ماهانه' : 'روند فروش روزانه'}</h2>
            <Link to="/admin/finance/sales" className="admin-link">جزئیات فروش</Link>
          </div>
          <div className="admin-chart-panel">
            {loading && !charts ? (
              <p className="admin-muted">در حال بارگذاری نمودار…</p>
            ) : (
              <AdminLineChart points={salesTrend} color="#5c4d91" height={220} />
            )}
          </div>
        </section>
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>سود و زیان</h2>
            <Link to="/admin/finance/pnl" className="admin-link">گزارش P&amp;L</Link>
          </div>
          <div className="admin-chart-panel">
            {loading && !k ? (
              <p className="admin-muted">در حال بارگذاری نمودار…</p>
            ) : (
              <AdminBarChart points={pnlPoints} color="#15cca0" height={200} />
            )}
          </div>
        </section>
      </div>

      <div className="admin-dash-grid" style={{ marginTop: 14 }}>
        <section className="admin-card">
          <div className="admin-card-head"><h2>فروش بر اساس دسته</h2></div>
          <div className="admin-chart-panel">
            <AdminBarChart
              color="#0ba5f2"
              height={180}
              points={charts?.categories ?? []}
            />
          </div>
        </section>
        <section className="admin-card">
          <div className="admin-card-head"><h2>ترکیب درآمد / پرداخت</h2></div>
          <div className="admin-chart-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <AdminDonutChart
              size={160}
              slices={(charts?.revenueMix?.length ? charts.revenueMix : charts?.paymentMix ?? []).map((s, i) => ({
                label: s.label,
                value: s.value,
                color: (charts?.revenueMix?.length ? REV_COLORS : PAY_COLORS)[i % 5]!,
              }))}
            />
          </div>
        </section>
      </div>

      {data ? (
        <section className="admin-card" style={{ marginTop: 16, padding: 16 }}>
          <div className="admin-card-head">
            <h2>جزئیات درآمد / هزینه</h2>
            <span className="admin-muted">حاشیه {formatNumFa(data.kpis.marginPct)}٪</span>
          </div>
          <ul className="admin-kv">
            <li><span>فروشگاه</span><strong>{formatTomanFa(data.breakdown.shopRevenue)}</strong></li>
            <li><span>شارژ کیف پول</span><strong>{formatTomanFa(data.breakdown.paymentTopups)}</strong></li>
            <li><span>مشاوره دامپزشک</span><strong>{formatTomanFa(data.breakdown.vetFees)}</strong></li>
            <li><span>همبازی</span><strong>{formatTomanFa(data.breakdown.playdateFees)}</strong></li>
            <li><span>COGS</span><strong>{formatTomanFa(data.breakdown.cogs)}</strong></li>
            <li><span>هزینه عملیاتی</span><strong>{formatTomanFa(data.breakdown.operatingExpense)}</strong></li>
          </ul>
        </section>
      ) : null}

      <p className="admin-section-label" style={{ marginTop: 20 }}>ماژول‌های Finance OS</p>
      <div className="admin-finance-links">
        <Link to="/admin/finance/accounts" className="admin-card admin-finance-link">
          <TrendingUp size={20} /><div><strong>حساب‌ها و داده‌های پایه</strong><span>بانک · اسنپ‌پی · طبقه‌بندی · افراد</span></div>
        </Link>
        <Link to="/admin/finance/transactions" className="admin-card admin-finance-link">
          <LineChart size={20} /><div><strong>تراکنش‌ها و دفتر</strong><span>ایمپورت · صف · مشکوک · Ledger</span></div>
        </Link>
        <Link to="/admin/finance/allocation" className="admin-card admin-finance-link">
          <PieChart size={20} /><div><strong>تخصیص هزینه</strong><span>دفاتر · تجهیزات · فاکتور هلدینگ</span></div>
        </Link>
        <Link to="/admin/finance/pnl" className="admin-card admin-finance-link">
          <PieChart size={20} /><div><strong>سود و زیان</strong><span>درآمد در برابر هزینه و حاشیه سود</span></div>
        </Link>
        <Link to="/admin/finance/sales" className="admin-card admin-finance-link">
          <LineChart size={20} /><div><strong>نمودارهای فروش</strong><span>روزانه / ماهانه · دسته · پرداخت</span></div>
        </Link>
        <Link to="/admin/finance/orders" className="admin-card admin-finance-link">
          <ShoppingBag size={20} /><div><strong>درآمد سفارش‌ها</strong><span>لیست و جمع وضعیت‌ها</span></div>
        </Link>
        <Link to="/admin/finance/wallet" className="admin-card admin-finance-link">
          <Wallet size={20} /><div><strong>دفتر کیف پول</strong><span>تومان · سکه · Stars · TON</span></div>
        </Link>
        <Link to="/admin/finance/products" className="admin-card admin-finance-link">
          <TrendingUp size={20} /><div><strong>محصولات برتر</strong><span>رتبه‌بندی درآمد</span></div>
        </Link>
      </div>
    </div>
  );
}
