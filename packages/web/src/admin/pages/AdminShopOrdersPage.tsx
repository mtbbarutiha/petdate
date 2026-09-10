import { Fragment, useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { orderPublicIdOf, userPublicIdOf } from '@petdate/shared';
import { adminFetch, formatNumFa, formatTomanFa } from '../api';
import { AdminIdChip } from '../AdminIds';
import { AdminEntityCell, AdminThumb } from '../AdminThumb';

type OrderItem = {
  productId?: string;
  title?: string;
  qty?: number;
  priceToman?: number;
  stars?: number;
  coins?: number;
};

type Order = {
  id: number;
  publicId?: string;
  userId?: number;
  status: string;
  totalToman: number;
  items: OrderItem[];
  customerName?: string;
  customerPhone?: string;
  note?: string;
  paymentCurrency?: string;
  paymentAmount?: number;
  createdAt: string;
  userAvatarUrl?: string;
  userName?: string;
};

const STATUSES = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];
const STATUS_FA: Record<string, string> = {
  pending: 'در انتظار',
  paid: 'پرداخت‌شده',
  shipped: 'ارسال‌شده',
  completed: 'تکمیل',
  cancelled: 'لغو',
};

function payLabel(o: Order): string {
  const cur = o.paymentCurrency || 'toman';
  const amt = o.paymentAmount ?? o.totalToman;
  if (cur === 'stars_xtr') return `⭐ ${formatNumFa(amt)} Stars تلگرام`;
  if (cur === 'stars') return `⭐ ${formatNumFa(amt)} ستاره کیف‌پول`;
  if (cur === 'coins') return `🪙 ${formatNumFa(amt)} سکه`;
  if (cur === 'ton') return `◆ ${formatNumFa(amt)} TON`;
  return formatTomanFa(amt);
}

function itemsSummary(items: OrderItem[]): string {
  if (!Array.isArray(items) || items.length === 0) return '—';
  return items
    .map((it) => {
      const title = it.title || it.productId || 'کالا';
      const qty = Math.max(1, Number(it.qty) || 1);
      return qty > 1 ? `${title} ×${formatNumFa(qty)}` : title;
    })
    .join(' · ');
}

export function AdminShopOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (q.trim()) qs.set('q', q.trim());
      const data = await adminFetch<{ orders: Order[] }>(`/api/admin/shop/orders?${qs}`);
      setOrders(data.orders);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [status, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (id: number, next: string) => {
    try {
      await adminFetch(`/api/admin/shop/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>سفارش‌های فروشگاه</h1>
          <p>{formatNumFa(orders.length)} سفارش · جدول shop_orders</p>
        </div>
        <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">همه</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_FA[s] || s}
            </option>
          ))}
        </select>
      </header>
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={16} />
          <input
            placeholder="آیدی PD-O، نام مشتری، موبایل…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          جستجو
        </button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-table-wrap admin-card">
        <table className="admin-table admin-table--dense">
          <thead>
            <tr>
              <th>آیدی سفارش</th>
              <th>کاربر / مشتری</th>
              <th>پرداخت</th>
              <th>مبلغ تومان</th>
              <th>کالا</th>
              <th>وضعیت</th>
              <th>زمان</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const open = openId === o.id;
              const publicId = orderPublicIdOf(o);
              return (
                <Fragment key={o.id}>
                  <tr>
                    <td>
                      <AdminIdChip publicId={publicId} />
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
                        title={o.customerName || o.userName || '—'}
                        subtitle={
                          <div className="admin-cell-compact">
                            {o.userId != null ? (
                              <code className="admin-mono admin-id-public" dir="ltr">
                                {userPublicIdOf({ id: o.userId })}
                              </code>
                            ) : null}
                            {o.customerPhone ? (
                              <span className="admin-muted admin-mono" dir="ltr">{o.customerPhone}</span>
                            ) : null}
                          </div>
                        }
                      />
                    </td>
                    <td className="admin-cell-nowrap"><strong>{payLabel(o)}</strong></td>
                    <td className="admin-cell-nowrap">{formatTomanFa(o.totalToman)}</td>
                    <td>{itemsSummary(o.items)}</td>
                    <td>
                      <select
                        className="admin-select admin-select--compact"
                        value={o.status}
                        onChange={(e) => void patch(o.id, e.target.value)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_FA[s] || s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="admin-cell-nowrap">{new Date(o.createdAt).toLocaleString('fa-IR')}</td>
                    <td>
                      <button type="button" className="admin-btn ghost" onClick={() => setOpenId(open ? null : o.id)}>
                        {open ? 'بستن' : 'جزئیات'}
                      </button>
                    </td>
                  </tr>
                  {open ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="admin-muted" style={{ whiteSpace: 'pre-wrap', textAlign: 'start', padding: 8 }}>
                          <div dir="ltr" style={{ marginBottom: 8 }}>
                            <code className="admin-mono admin-id-public">{publicId}</code>
                          </div>
                          {o.note || 'بدون یادداشت / آدرس'}
                          {'\n\n'}
                          آیتم‌ها: {JSON.stringify(o.items, null, 2)}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {!orders.length ? (
              <tr>
                <td colSpan={8} className="admin-muted">
                  سفارشی نیست
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
