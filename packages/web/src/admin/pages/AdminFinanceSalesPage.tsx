import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { adminDownload, adminFetch, formatTomanFa } from '../api';
import { PeriodFilter, type FinancePeriod } from '../FinanceCharts';
import {
  CategoryBarWidget,
  CategoryDonutWidget,
  FINANCE_SALES_WIDGET_CATALOG,
  TimeLineWidget,
  WidgetDashboard,
  WidgetEmpty,
  type WidgetRenderContext,
} from '../widgets';

type Sales = {
  period: FinancePeriod;
  totalRevenue: number;
  dailyOrMonthly: Array<{ label: string; value: number }>;
  categories: Array<{ slug: string; label: string; value: number }>;
  paymentMix: Array<{ currency: string; label: string; value: number }>;
};

const PAY_COLORS = ['#5c4d91', '#15cca0', '#fd961e', '#0ba5f2', '#db89ca'];

export function AdminFinanceSalesPage() {
  const [period, setPeriod] = useState<FinancePeriod>('month');
  const [data, setData] = useState<Sales | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await adminFetch<Sales>(`/api/admin/finance/sales?period=${period}`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const renderSalesWidget = (id: string, ctx: WidgetRenderContext) => {
    if (!data) return <WidgetEmpty />;
    switch (id) {
      case 'dailyOrMonthly':
        return data.dailyOrMonthly.length ? (
          <TimeLineWidget points={data.dailyOrMonthly} color="#5c4d91" ctx={ctx} />
        ) : (
          <WidgetEmpty />
        );
      case 'salesCategories':
        return data.categories.length ? (
          <CategoryBarWidget
            ctx={ctx}
            color="#0ba5f2"
            points={data.categories.slice(0, 8).map((c) => ({ label: c.label, value: c.value }))}
          />
        ) : (
          <WidgetEmpty />
        );
      case 'salesPaymentMix':
        return data.paymentMix.length ? (
          <CategoryDonutWidget
            ctx={ctx}
            slices={data.paymentMix.map((p, i) => ({
              label: p.label,
              value: p.value,
              color: PAY_COLORS[i % PAY_COLORS.length]!,
            }))}
          />
        ) : (
          <WidgetEmpty />
        );
      default:
        return <WidgetEmpty />;
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>نمودارهای فروش</h1>
          <p>لایو از سفارش‌ها و payment_orders · روزانه / ماهانه / دسته / پرداخت</p>
        </div>
        <div className="admin-header-actions">
          <PeriodFilter value={period} onChange={setPeriod} />
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => {
              void adminDownload(
                `/api/admin/finance/export?kind=sales&period=${period}`,
                `petdate-sales-${period}.csv`
              ).catch((err) => {
                alert(err instanceof Error ? err.message : 'خروجی ناموفق بود');
              });
            }}
          >
            <Download size={16} /> CSV
          </button>
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      {data ? (
        <>
          <div className="admin-stats admin-stats--dense" style={{ marginBottom: 14 }}>
            <div className="admin-stat admin-stat--violet">
              <div>
                <div className="admin-stat-value">{formatTomanFa(data.totalRevenue)}</div>
                <div className="admin-stat-label">جمع فروش پرداخت‌شده</div>
              </div>
            </div>
          </div>

          <WidgetDashboard
            dashboardId="finance-sales"
            catalog={FINANCE_SALES_WIDGET_CATALOG}
            title={period === 'year' ? 'فروش ماهانه · ویجت‌ها' : 'فروش روزانه · ویجت‌ها'}
            renderWidget={renderSalesWidget}
          />
        </>
      ) : null}
    </div>
  );
}
