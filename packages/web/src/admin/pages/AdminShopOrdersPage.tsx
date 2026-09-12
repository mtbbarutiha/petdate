import { Fragment, useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { orderPublicIdOf, userPublicIdOf } from '@petdate/shared';
import { adminFetch, formatNumFa, formatTomanFa } from '../api';
import { formatAdminFaDateTime } from '../JalaliDateSelect';
import { AdminIdChip } from '../AdminIds';
import { AdminEntityCell, AdminThumb } from '../AdminThumb';
import { tr } from '../../i18n';

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
  if (cur === 'stars_xtr') return `⭐ ${formatNumFa(amt)}${tr(' Stars تلگرام')}`;
  if (cur === 'stars') return `⭐ ${formatNumFa(amt)}${tr(' ستاره کیف‌پول')}`;
  if (cur === 'coins') return `🪙 ${formatNumFa(amt)}${tr(' سکه')}`;
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

function itemUnitPrice(it: OrderItem): string {
  if (it.priceToman != null && Number.isFinite(Number(it.priceToman))) {
    return formatTomanFa(Number(it.priceToman));
  }
  if (it.stars != null && Number(it.stars) > 0) {
    return `⭐ ${formatNumFa(Number(it.stars))}`;
  }
  if (it.coins != null && Number(it.coins) > 0) {
    return `🪙 ${formatNumFa(Number(it.coins))}`;
  }
  return '—';
}

function OrderItemsList({ items }: { items: OrderItem[] }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="admin-muted">{tr('بدون آیتم')}</p>;
  }
  return (
    <ul className="admin-order-detail__items">
      {items.map((it, idx) => {
        const title = it.title || it.productId || tr('کالا');
        const qty = Math.max(1, Number(it.qty) || 1);
        return (
          <li key={`${it.productId || title}-${idx}`} className="admin-order-detail__item">
            <span className="admin-order-detail__item-title">{title}</span>
            <span className="admin-order-detail__item-qty" dir="ltr">
              ×{formatNumFa(qty)}
            </span>
            <span className="admin-order-detail__item-price">{itemUnitPrice(it)}</span>
          </li>
        );
      })}
    </ul>
  );
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
          <h1>{tr('سفارش‌های فروشگاه')}</h1>
          <p>{formatNumFa(orders.length)} {tr('سفارش · جدول shop_orders')}</p>
        </div>
        <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{tr('همه')}</option>
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
            placeholder={tr("آیدی PD-O، نام مشتری، موبایل…")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          {tr('جستجو')}
        </button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-table-wrap admin-card">
        <table className="admin-table admin-table--dense">
          <thead>
            <tr>
              <th>{tr('آیدی سفارش')}</th>
              <th>{tr('کاربر / مشتری')}</th>
              <th>{tr('پرداخت')}</th>
              <th>{tr('مبلغ تومان')}</th>
              <th>{tr('کالا')}</th>
              <th>{tr('وضعیت')}</th>
              <th>{tr('زمان')}</th>
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
                    <td className="admin-cell-nowrap">{formatAdminFaDateTime(o.createdAt)}</td>
                    <td>
                      <button type="button" className="admin-btn ghost" onClick={() => setOpenId(open ? null : o.id)}>
                        {open ? tr('بستن') : tr('جزئیات')}
                      </button>
                    </td>
                  </tr>
                  {open ? (
                    <tr className="admin-order-detail-row">
                      <td colSpan={8}>
                        <div className="admin-order-detail" dir="rtl">
                          <section className="admin-order-detail__block">
                            <h3 className="admin-order-detail__label">{tr('آدرس / یادداشت')}</h3>
                            <p className="admin-order-detail__address">
                              {o.note?.trim() ? o.note : tr('بدون یادداشت / آدرس')}
                            </p>
                            {(o.customerName || o.customerPhone) && (
                              <p className="admin-order-detail__meta">
                                {o.customerName ? <span>{o.customerName}</span> : null}
                                {o.customerPhone ? (
                                  <span className="admin-mono" dir="ltr">
                                    {o.customerPhone}
                                  </span>
                                ) : null}
                              </p>
                            )}
                          </section>
                          <section className="admin-order-detail__block">
                            <h3 className="admin-order-detail__label">{tr('آیتم‌ها')}</h3>
                            <OrderItemsList items={o.items} />
                            <details className="admin-order-detail__raw">
                              <summary>{tr('JSON خام')}</summary>
                              <pre dir="ltr">{JSON.stringify(o.items, null, 2)}</pre>
                            </details>
                          </section>
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
                  {tr('سفارشی نیست')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
