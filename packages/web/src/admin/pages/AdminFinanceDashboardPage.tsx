import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight, ArrowUpRight, Download, LineChart, PieChart,
  ShoppingBag, TrendingUp, Wallet,
} from 'lucide-react';
import { adminDownload, adminFetch, formatNumFa, formatTomanFa } from '../api';
import { PeriodFilter, type FinancePeriod } from '../FinanceCharts';

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
};

export function AdminFinanceDashboardPage() {
  const [period, setPeriod] = useState<FinancePeriod>('month');
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await adminFetch<Dash>(`/api/admin/finance/dashboard?period=${period}`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const k = data?.kpis;
  const cards = k ? [
    { label: 'درآمد', value: formatTomanFa(k.revenue), icon: TrendingUp, tone: 'mint' },
    { label: 'هزینه', value: formatTomanFa(k.expense), icon: ArrowDownRight, tone: 'orange' },
    { label: 'سود خالص', value: formatTomanFa(k.netProfit), icon: ArrowUpRight, tone: 'violet' },
    { label: 'سفارش‌ها', value: formatNumFa(k.orders), icon: ShoppingBag, tone: 'sky' },
    { label: 'میانگین سفارش (AOV)', value: formatTomanFa(k.aov), icon: Wallet, tone: 'slate' },
    { label: 'نرخ رشد', value: `${formatNumFa(k.growthRate)}٪`, icon: LineChart, tone: k.growthRate >= 0 ? 'mint' : 'orange' },
  ] : [];

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
          <p>آنالیتیکس پلتفرم · Finance OS (حساب‌ها، تراکنش‌ها، تخصیص SBG)</p>
        </div>
        <div className="admin-header-actions">
          <PeriodFilter value={period} onChange={setPeriod} />
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => exportCsv('pnl')}>
            <Download size={16} /> خروجی P&L
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
      </div>

      <div className="admin-finance-links">
        <Link to="/admin/finance/accounts" className="admin-card admin-finance-link">
          <TrendingUp size={20} /><div><strong>حساب‌ها و داده‌های پایه</strong><span>بانک · اسنپ‌پی · طبقه‌بندی · افراد</span></div>
        </Link>
        <Link to="/admin/finance/transactions" className="admin-card admin-finance-link">
          <LineChart size={20} /><div><strong>تراکنش‌ها و دفتر</strong><span>ایمپورت · صف · مشکوک · Ledger</span></div>
        </Link>
        <Link to="/admin/finance/allocation" className="admin-card admin-finance-link">
          <PieChart size={20} /><div><strong>تخصیص هزینه SBG</strong><span>دفاتر · تجهیزات · فاکتور هلدینگ</span></div>
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

      {data ? (
        <section className="admin-card" style={{ marginTop: 16, padding: 16 }}>
          <div className="admin-card-head"><h2>جزئیات درآمد / هزینه</h2><span className="admin-muted">حاشیه {formatNumFa(data.kpis.marginPct)}٪</span></div>
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
    </div>
  );
}
