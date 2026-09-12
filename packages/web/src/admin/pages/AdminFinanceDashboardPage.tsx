import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight, ArrowUpRight, Download, LineChart, PieChart,
  ShoppingBag, TrendingUp, Wallet,
} from 'lucide-react';
import { adminDownload, adminFetch, formatNumFa, formatTomanFa } from '../api';
import { PeriodFilter, type FinancePeriod } from '../FinanceCharts';
import {
  CategoryBarWidget,
  CategoryDonutWidget,
  FINANCE_WIDGET_CATALOG,
  TimeLineWidget,
  WidgetDashboard,
  WidgetEmpty,
  type WidgetRenderContext,
} from '../widgets';
import { AdminDashPage, AdminKpiStrip, type AdminKpiItem } from '../dash';
import { tr } from '../../i18n';

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
  const kpiItems: AdminKpiItem[] = k ? [
    { key: 'rev', label: tr('درآمد'), value: formatTomanFa(k.revenue), icon: TrendingUp, tone: 'mint', wide: true },
    { key: 'exp', label: tr('هزینه'), value: formatTomanFa(k.expense), icon: ArrowDownRight, tone: 'orange' },
    { key: 'net', label: tr('سود خالص'), value: formatTomanFa(k.netProfit), icon: ArrowUpRight, tone: 'violet' },
    { key: 'orders', label: tr('سفارش‌ها'), value: formatNumFa(k.orders), icon: ShoppingBag, tone: 'sky' },
    { key: 'aov', label: tr('میانگین سفارش (AOV)'), value: formatTomanFa(k.aov), icon: Wallet, tone: 'slate' },
    {
      key: 'growth',
      label: tr('نرخ رشد'),
      value: `${formatNumFa(k.growthRate)}٪`,
      icon: LineChart,
      tone: k.growthRate >= 0 ? 'mint' : 'orange',
    },
  ] : [];

  const pnlPoints = charts?.pnlCompare?.length
    ? charts.pnlCompare
    : k
      ? [
          { label: tr('درآمد'), value: k.revenue },
          { label: tr('هزینه'), value: k.expense },
          { label: tr('سود'), value: Math.max(0, k.netProfit) },
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

  const renderFinanceWidget = (id: string, ctx: WidgetRenderContext) => {
    if (loading && !charts && !k) return <p className="admin-dash-chart-empty">{tr('در حال بارگذاری نمودار…')}</p>;
    switch (id) {
      case 'salesTrend':
        return salesTrend.length ? (
          <TimeLineWidget points={salesTrend} color="#5c4d91" ctx={ctx} />
        ) : (
          <WidgetEmpty />
        );
      case 'pnlCompare':
        return pnlPoints.length ? (
          <CategoryBarWidget points={pnlPoints} color="#15cca0" ctx={ctx} />
        ) : (
          <WidgetEmpty />
        );
      case 'categories':
        return (charts?.categories?.length ?? 0) ? (
          <CategoryBarWidget points={charts!.categories} color="#0ba5f2" ctx={ctx} />
        ) : (
          <WidgetEmpty />
        );
      case 'revenueMix': {
        const mix = charts?.revenueMix?.length ? charts.revenueMix : charts?.paymentMix ?? [];
        const colors = charts?.revenueMix?.length ? REV_COLORS : PAY_COLORS;
        return mix.length ? (
          <CategoryDonutWidget
            ctx={ctx}
            slices={mix.map((s, i) => ({
              label: s.label,
              value: s.value,
              color: colors[i % colors.length]!,
            }))}
          />
        ) : (
          <WidgetEmpty />
        );
      }
      default:
        return <WidgetEmpty />;
    }
  };

  return (
    <AdminDashPage
      title={tr("داشبورد مالی")}
      subtitle="آنالیتیکس پلتفرم · Finance OS (حساب‌ها، تراکنش‌ها، تخصیص هزینه)"
      onRefresh={() => void load()}
      error={error}
      actions={
        <>
          <PeriodFilter value={period} onChange={setPeriod} />
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => exportCsv('pnl')}>
            <Download size={16} /> {tr('خروجی P&L')}
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => exportCsv('sales')}>
            <Download size={16} /> {tr('خروجی فروش')}
          </button>
        </>
      }
    >
      {kpiItems.length ? (
        <AdminKpiStrip items={kpiItems} ariaLabel="شاخص‌های مالی" />
      ) : loading ? (
        <p className="admin-muted" style={{ padding: 8 }}>{tr('در حال بارگذاری شاخص‌ها…')}</p>
      ) : null}

      <WidgetDashboard
        dashboardId="finance"
        catalog={FINANCE_WIDGET_CATALOG}
        title={tr("نمودارهای اصلی · ویجت‌ها")}
        renderWidget={renderFinanceWidget}
      />

      {data ? (
        <section className="admin-card" style={{ marginTop: 16, padding: 16 }}>
          <div className="admin-card-head">
            <h2>{tr('جزئیات درآمد / هزینه')}</h2>
            <span className="admin-muted">{tr('حاشیه')} {formatNumFa(data.kpis.marginPct)}{tr('٪')}</span>
          </div>
          <ul className="admin-kv">
            <li><span>{tr('فروشگاه')}</span><strong>{formatTomanFa(data.breakdown.shopRevenue)}</strong></li>
            <li><span>{tr('شارژ کیف پول')}</span><strong>{formatTomanFa(data.breakdown.paymentTopups)}</strong></li>
            <li><span>{tr('مشاوره دامپزشک')}</span><strong>{formatTomanFa(data.breakdown.vetFees)}</strong></li>
            <li><span>{tr('همبازی')}</span><strong>{formatTomanFa(data.breakdown.playdateFees)}</strong></li>
            <li><span>COGS</span><strong>{formatTomanFa(data.breakdown.cogs)}</strong></li>
            <li><span>{tr('هزینه عملیاتی')}</span><strong>{formatTomanFa(data.breakdown.operatingExpense)}</strong></li>
          </ul>
        </section>
      ) : null}

      <p className="admin-section-label" style={{ marginTop: 20 }}>{tr('ماژول‌های Finance OS')}</p>
      <div className="admin-finance-links">
        <Link to="/admin/finance/accounts" className="admin-card admin-finance-link">
          <TrendingUp size={20} /><div><strong>{tr('حساب‌ها و داده‌های پایه')}</strong><span>{tr('بانک · اسنپ‌پی · طبقه‌بندی · افراد')}</span></div>
        </Link>
        <Link to="/admin/finance/transactions" className="admin-card admin-finance-link">
          <LineChart size={20} /><div><strong>{tr('تراکنش‌ها و دفتر')}</strong><span>{tr('ایمپورت · صف · مشکوک · Ledger')}</span></div>
        </Link>
        <Link to="/admin/finance/allocation" className="admin-card admin-finance-link">
          <PieChart size={20} /><div><strong>{tr('تخصیص هزینه')}</strong><span>{tr('دفاتر · تجهیزات · فاکتور هلدینگ')}</span></div>
        </Link>
        <Link to="/admin/finance/pnl" className="admin-card admin-finance-link">
          <PieChart size={20} /><div><strong>{tr('سود و زیان')}</strong><span>{tr('درآمد در برابر هزینه و حاشیه سود')}</span></div>
        </Link>
        <Link to="/admin/finance/sales" className="admin-card admin-finance-link">
          <LineChart size={20} /><div><strong>{tr('نمودارهای فروش')}</strong><span>{tr('روزانه / ماهانه · دسته · پرداخت')}</span></div>
        </Link>
        <Link to="/admin/finance/orders" className="admin-card admin-finance-link">
          <ShoppingBag size={20} /><div><strong>{tr('درآمد سفارش‌ها')}</strong><span>{tr('لیست و جمع وضعیت‌ها')}</span></div>
        </Link>
        <Link to="/admin/finance/wallet" className="admin-card admin-finance-link">
          <Wallet size={20} /><div><strong>{tr('دفتر کیف پول')}</strong><span>{tr('تومان · سکه · Stars · TON')}</span></div>
        </Link>
        <Link to="/admin/payments" className="admin-card admin-finance-link">
          <Wallet size={20} /><div><strong>{tr('صف تأیید واریز')}</strong><span>{tr('رسید کارت‌به‌کارت سکه و شاپ')}</span></div>
        </Link>
        <Link to="/admin/finance/products" className="admin-card admin-finance-link">
          <TrendingUp size={20} /><div><strong>{tr('محصولات برتر')}</strong><span>{tr('رتبه‌بندی درآمد')}</span></div>
        </Link>
      </div>
    </AdminDashPage>
  );
}
