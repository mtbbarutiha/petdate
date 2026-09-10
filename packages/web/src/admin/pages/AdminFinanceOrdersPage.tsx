import { useCallback, useEffect, useState } from 'react';
import { orderPublicIdOf } from '@petdate/shared';
import { adminFetch, formatNumFa, formatTomanFa } from '../api';
import { AdminIdChip } from '../AdminIds';

type OrdersRes = {
  orders: Array<{
    id: number;
    publicId?: string;
    status: string;
    totalToman: number;
    paymentCurrency: string;
    customerName?: string;
    createdAt: string;
    items: unknown[];
  }>;
  statusTotals: Array<{ status: string; count: number; revenue: number }>;
  paidRevenue: number;
};

const CUR: Record<string, string> = {
  toman: 'تومان', coins: 'سکه', stars: 'Stars', ton: 'TON',
};

export function AdminFinanceOrdersPage() {
  const [status, setStatus] = useState('');
  const [data, setData] = useState<OrdersRes | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      setData(await adminFetch<OrdersRes>(`/api/admin/finance/orders${qs}`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>درآمد سفارش‌ها</h1>
          <p>لیست سفارش‌های پت دیت شاپ و جمع وضعیت‌ها</p>
        </div>
        <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">همه وضعیت‌ها</option>
          <option value="pending">pending</option>
          <option value="paid">paid</option>
          <option value="shipped">shipped</option>
          <option value="completed">completed</option>
          <option value="cancelled">cancelled</option>
        </select>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      {data ? (
        <>
          <div className="admin-stats admin-stats--dense">
            <div className="admin-stat admin-stat--mint">
              <div>
                <div className="admin-stat-value">{formatTomanFa(data.paidRevenue)}</div>
                <div className="admin-stat-label">درآمد پرداخت‌شده</div>
              </div>
            </div>
            {data.statusTotals.map((s) => (
              <div key={s.status} className="admin-stat admin-stat--slate">
                <div>
                  <div className="admin-stat-value">{formatTomanFa(s.revenue)}</div>
                  <div className="admin-stat-label">{s.status} · {formatNumFa(s.count)}</div>
                </div>
              </div>
            ))}
          </div>

          <section className="admin-card">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>آیدی سفارش</th><th>مشتری</th><th>مبلغ</th><th>پرداخت</th><th>وضعیت</th><th>تاریخ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id}>
                      <td><AdminIdChip publicId={orderPublicIdOf(o)} /></td>
                      <td>{o.customerName || '—'}</td>
                      <td>{formatTomanFa(o.totalToman)}</td>
                      <td>{CUR[o.paymentCurrency] || o.paymentCurrency}</td>
                      <td><span className="admin-badge">{o.status}</span></td>
                      <td className="admin-mono">{o.createdAt.slice(0, 16)}</td>
                    </tr>
                  ))}
                  {!data.orders.length ? (
                    <tr><td colSpan={6} className="admin-muted">سفارشی نیست</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
