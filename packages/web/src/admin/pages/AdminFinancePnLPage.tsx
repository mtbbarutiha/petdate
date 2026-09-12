import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { adminDownload, adminFetch, formatNumFa, formatTomanFa } from '../api';
import { AdminBarChart, PeriodFilter, type FinancePeriod } from '../FinanceCharts';
import { tr } from '../../i18n';

type PnL = {
  period: FinancePeriod;
  revenue: number;
  expense: number;
  netProfit: number;
  marginPct: number;
  grossProfit: number;
  grossMarginPct: number;
  lines: Array<{ key: string; label: string; type: 'income' | 'expense'; amount: number }>;
  settings: Record<string, number>;
};

export function AdminFinancePnLPage() {
  const [period, setPeriod] = useState<FinancePeriod>('month');
  const [data, setData] = useState<PnL | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await adminFetch<PnL>(`/api/admin/finance/pnl?period=${period}`));
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
          <h1>{tr('سود و زیان')}</h1>
          <p>{tr('گزارش P&amp;L بر اساس سفارش‌ها، شارژ کیف پول و کارمزدها')}</p>
        </div>
        <div className="admin-header-actions">
          <PeriodFilter value={period} onChange={setPeriod} />
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => {
              void adminDownload(
                `/api/admin/finance/export?kind=pnl&period=${period}`,
                `petdate-pnl-${period}.csv`
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
          <div className="admin-stats admin-stats--dense">
            <div className="admin-stat admin-stat--mint">
              <div><div className="admin-stat-value">{formatTomanFa(data.revenue)}</div><div className="admin-stat-label">{tr('درآمد')}</div></div>
            </div>
            <div className="admin-stat admin-stat--orange">
              <div><div className="admin-stat-value">{formatTomanFa(data.expense)}</div><div className="admin-stat-label">{tr('هزینه')}</div></div>
            </div>
            <div className="admin-stat admin-stat--violet">
              <div><div className="admin-stat-value">{formatTomanFa(data.netProfit)}</div><div className="admin-stat-label">{tr('سود خالص')}</div></div>
            </div>
            <div className="admin-stat admin-stat--sky">
              <div><div className="admin-stat-value">{formatNumFa(data.marginPct)}{tr('٪')}</div><div className="admin-stat-label">{tr('حاشیه سود خالص')}</div></div>
            </div>
            <div className="admin-stat admin-stat--slate">
              <div><div className="admin-stat-value">{formatNumFa(data.grossMarginPct)}{tr('٪')}</div><div className="admin-stat-label">{tr('حاشیه ناخالص فروشگاه')}</div></div>
            </div>
          </div>

          <div className="admin-dash-grid">
            <section className="admin-card">
              <div className="admin-card-head"><h2>{tr('اقلام صورت سود و زیان')}</h2></div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>{tr('عنوان')}</th><th>{tr('نوع')}</th><th>{tr('مبلغ')}</th></tr></thead>
                  <tbody>
                    {data.lines.map((l) => (
                      <tr key={l.key}>
                        <td>{tr(l.label)}</td>
                        <td><span className={`admin-badge admin-badge--${l.type === 'income' ? 'ok' : 'warn'}`}>{l.type === 'income' ? tr('درآمد') : tr('هزینه')}</span></td>
                        <td className="admin-mono">{formatTomanFa(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="admin-muted" style={{ margin: '12px 16px' }}>
                {tr('COGS از فیلد cost محصولات یا حاشیه پیش‌فرض')} {formatNumFa(data.settings.financeMarginPercent)}{tr(`٪
                محاسبه می‌شود. کارمزد مشاوره =`)} {formatNumFa(data.settings.vetConsultFeePercent ?? 20)}{tr(`٪ از مبلغ فاکتور
                (سکه × نرخ تومان).`)}
              </p>
            </section>
            <section className="admin-card">
              <div className="admin-card-head"><h2>{tr('مقایسه درآمد و هزینه')}</h2></div>
              <div style={{ padding: 16 }}>
                <AdminBarChart
                  color="#5c4d91"
                  points={[
                    { label: 'درآمد', value: data.revenue },
                    { label: 'هزینه', value: data.expense },
                    { label: 'سود', value: Math.max(0, data.netProfit) },
                  ]}
                />
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
