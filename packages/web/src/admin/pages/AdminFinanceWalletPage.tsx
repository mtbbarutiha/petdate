import { useCallback, useEffect, useState } from 'react';
import { adminFetch, formatNumFa, formatTomanFa } from '../api';
import { formatAdminFaDateTime } from '../JalaliDateSelect';
import { AdminDonutChart } from '../FinanceCharts';
import { tr } from '../../i18n';

type Wallet = {
  balances: { coins: number; toman: number; ton: number; stars: number };
  byCurrency: Record<string, { credits: number; debits: number; creditCount: number; debitCount: number }>;
  recent: Array<{
    id: number; userId: number | null; currency: string; amount: number;
    direction: string; reason: string; createdAt: string;
  }>;
  coinLedgerEntries: number;
};

const LABELS: Record<string, string> = {
  toman: 'تومان', coins: 'سکه', stars: 'Stars', ton: 'TON',
};
const COLORS = ['#0f766e', '#5c4d91', '#c2410c', '#0369a1'];

export function AdminFinanceWalletPage() {
  const [data, setData] = useState<Wallet | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await adminFetch<Wallet>('/api/admin/finance/wallet'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const currencies = data ? Object.keys(data.byCurrency) : [];

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>{tr('دفتر کیف پول')}</h1>
          <p>{tr('خلاصه اعتبار / بدهکار در ارزهای تومان، سکه، Stars و TON')}</p>
        </div>
        <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void load()}>{tr('بروزرسانی')}</button>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      {data ? (
        <>
          <div className="admin-stats admin-stats--dense">
            <div className="admin-stat admin-stat--mint">
              <div><div className="admin-stat-value">{formatTomanFa(data.balances.toman)}</div><div className="admin-stat-label">{tr('موجودی تومان کاربران')}</div></div>
            </div>
            <div className="admin-stat admin-stat--violet">
              <div><div className="admin-stat-value">{formatNumFa(data.balances.coins)}</div><div className="admin-stat-label">{tr('سکه')}</div></div>
            </div>
            <div className="admin-stat admin-stat--orange">
              <div><div className="admin-stat-value">{formatNumFa(data.balances.stars)}</div><div className="admin-stat-label">Stars</div></div>
            </div>
            <div className="admin-stat admin-stat--sky">
              <div><div className="admin-stat-value">{formatNumFa(data.balances.ton)}</div><div className="admin-stat-label">TON</div></div>
            </div>
          </div>

          <div className="admin-dash-grid">
            <section className="admin-card">
              <div className="admin-card-head"><h2>{tr('اعتبار در برابر بدهکار')}</h2></div>
              <div style={{ padding: 16 }}>
                <AdminDonutChart
                  slices={currencies.map((c, i) => ({
                    label: LABELS[c] || c,
                    value: data.byCurrency[c].credits + data.byCurrency[c].debits,
                    color: COLORS[i % COLORS.length],
                  }))}
                />
              </div>
            </section>
            <section className="admin-card">
              <div className="admin-card-head"><h2>{tr('خلاصه ارزها')}</h2></div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>{tr('ارز')}</th><th>{tr('واریز')}</th><th>{tr('برداشت')}</th><th>{tr('تعداد')}</th></tr></thead>
                  <tbody>
                    {currencies.map((c) => {
                      const row = data.byCurrency[c];
                      return (
                        <tr key={c}>
                          <td>{tr(LABELS[c] || c)}</td>
                          <td className="admin-mono">{formatNumFa(row.credits)}</td>
                          <td className="admin-mono">{formatNumFa(row.debits)}</td>
                          <td>{formatNumFa(row.creditCount + row.debitCount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="admin-muted" style={{ margin: '12px 16px' }}>
                {tr('ثبت‌های coin_ledger:')} {formatNumFa(data.coinLedgerEntries)}
              </p>
            </section>
          </div>

          <section className="admin-card" style={{ marginTop: 16 }}>
            <div className="admin-card-head"><h2>{tr('آخرین تراکنش‌ها')}</h2></div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>{tr('ارز')}</th><th>{tr('مبلغ')}</th><th>{tr('جهت')}</th><th>{tr('دلیل')}</th><th>{tr('تاریخ')}</th></tr></thead>
                <tbody>
                  {data.recent.map((r) => (
                    <tr key={r.id}>
                      <td>{tr(LABELS[r.currency] || r.currency)}</td>
                      <td className="admin-mono">{formatNumFa(r.amount)}</td>
                      <td><span className={`admin-badge admin-badge--${r.direction === 'credit' ? 'ok' : 'warn'}`}>{r.direction === 'credit' ? tr('واریز') : tr('برداشت')}</span></td>
                      <td>{r.reason || '—'}</td>
                      <td className="admin-cell-nowrap">{formatAdminFaDateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                  {!data.recent.length ? <tr><td colSpan={5} className="admin-muted">{tr('تراکنشی نیست')}</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
