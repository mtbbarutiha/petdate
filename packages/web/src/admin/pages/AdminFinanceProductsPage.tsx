import { useCallback, useEffect, useState } from 'react';
import { adminFetch, formatNumFa, formatTomanFa } from '../api';
import { AdminBarChart, PeriodFilter, type FinancePeriod } from '../FinanceCharts';
import { tr } from '../../i18n';

type Top = {
  period: FinancePeriod;
  products: Array<{ productId: string; title: string; categorySlug: string; qty: number; revenue: number }>;
  categories: Array<{ slug: string; label: string; qty: number; revenue: number }>;
};

export function AdminFinanceProductsPage() {
  const [period, setPeriod] = useState<FinancePeriod>('month');
  const [data, setData] = useState<Top | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await adminFetch<Top>(`/api/admin/finance/top-products?period=${period}`));
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
          <h1>{tr('محصولات و دسته‌های برتر')}</h1>
          <p>{tr('رتبه‌بندی درآمد پت دیت شاپ')}</p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      {data ? (
        <div className="admin-dash-grid">
          <section className="admin-card">
            <div className="admin-card-head"><h2>{tr('برترین محصولات')}</h2></div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>{tr('محصول')}</th><th>{tr('دسته')}</th><th>{tr('تعداد')}</th><th>{tr('درآمد')}</th></tr></thead>
                <tbody>
                  {data.products.map((p) => (
                    <tr key={p.productId}>
                      <td>{tr(p.title)}</td>
                      <td className="admin-muted">{p.categorySlug}</td>
                      <td>{formatNumFa(p.qty)}</td>
                      <td className="admin-mono">{formatTomanFa(p.revenue)}</td>
                    </tr>
                  ))}
                  {!data.products.length ? <tr><td colSpan={4} className="admin-muted">{tr('فروشی نیست')}</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
          <section className="admin-card">
            <div className="admin-card-head"><h2>{tr('دسته‌ها بر اساس درآمد')}</h2></div>
            <div className="admin-chart-box" style={{ padding: 8 }}>
              <AdminBarChart
                color="#5c4d91"
                points={data.categories.slice(0, 8).map((c) => ({ label: c.label, value: c.revenue }))}
              />
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>{tr('دسته')}</th><th>{tr('تعداد')}</th><th>{tr('درآمد')}</th></tr></thead>
                <tbody>
                  {data.categories.map((c) => (
                    <tr key={c.slug}>
                      <td>{tr(c.label)}</td>
                      <td>{formatNumFa(c.qty)}</td>
                      <td className="admin-mono">{formatTomanFa(c.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
