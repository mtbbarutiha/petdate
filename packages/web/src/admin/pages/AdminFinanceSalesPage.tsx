import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { adminDownload, adminFetch, formatTomanFa } from '../api';
import {
  AdminBarChart, AdminDonutChart, AdminLineChart, PeriodFilter, type FinancePeriod,
} from '../FinanceCharts';

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

          <p className="admin-section-label">۱ · روند زمانی</p>
          <section className="admin-card" style={{ marginBottom: 14 }}>
            <div className="admin-card-head">
              <h2>{period === 'year' ? 'فروش ماهانه' : 'فروش روزانه'}</h2>
            </div>
            <div className="admin-chart-panel">
              <AdminLineChart points={data.dailyOrMonthly} color="#5c4d91" height={220} />
            </div>
          </section>

          <p className="admin-section-label">۲ · ترکیب</p>
          <div className="admin-dash-grid">
            <section className="admin-card">
              <div className="admin-card-head"><h2>فروش بر اساس دسته</h2></div>
              <div className="admin-chart-panel">
                <AdminBarChart
                  color="#0ba5f2"
                  height={200}
                  points={data.categories.slice(0, 8).map((c) => ({ label: c.label, value: c.value }))}
                />
              </div>
            </section>
            <section className="admin-card">
              <div className="admin-card-head"><h2>ترکیب روش پرداخت</h2></div>
              <div className="admin-chart-panel">
                <AdminDonutChart
                  slices={data.paymentMix.map((p, i) => ({
                    label: p.label,
                    value: p.value,
                    color: PAY_COLORS[i % PAY_COLORS.length],
                  }))}
                />
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
