import { Fragment, useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { orderPublicIdOf, userPublicIdOf, SHOP_ORDER_STATUSES, SHOP_ORDER_STATUS_FA } from '@petdate/shared';
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

/** Dev-only: `localStorage.setItem('petdate.admin.devRawJson','1')` then reload. */
function adminWantsRawJson(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('petdate.admin.devRawJson') === '1';
  } catch {
    return false;
  }
}

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
  username?: string;
  shippingCarrier?: string;
  trackingCode?: string;
  paymentActor?: string;
  paidFinal?: boolean | number;
  paymentStatus?: string;
  refundedAt?: string;
  refund?: { toman?: number; coins?: number; stars?: number };
};

const STATUSES = [...SHOP_ORDER_STATUSES];
const STATUS_FA: Record<string, string> = SHOP_ORDER_STATUS_FA;

function ShippingEditor({ order, onSaved }: { order: Order; onSaved: () => void }) {
  const [carrier, setCarrier] = useState(order.shippingCarrier || '');
  const [tracking, setTracking] = useState(order.trackingCode || '');
  const [actor, setActor] = useState(order.paymentActor || '');
  const [paid, setPaid] = useState(Boolean(order.paidFinal));
  return (
    <form className="admin-toolbar" onSubmit={(e) => {
      e.preventDefault();
      void adminFetch(`/api/admin/shop/orders/${order.id}/shipping`, {
        method: 'PATCH',
        body: JSON.stringify({ shippingCarrier: carrier, trackingCode: tracking, paymentActor: actor, paidFinal: paid }),
      }).then(onSaved);
    }}>
      <input className="admin-input" placeholder={tr('حامل')} value={carrier} onChange={(e) => setCarrier(e.target.value)} />
      <input className="admin-input" placeholder={tr('کد رهگیری')} value={tracking} onChange={(e) => setTracking(e.target.value)} />
      <input className="admin-input" placeholder={tr('بازیگر درگاه')} value={actor} onChange={(e) => setActor(e.target.value)} />
      <label className="admin-check"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> {tr('پرداخت نهایی')}</label>
      <button type="submit" className="admin-btn">{tr('ذخیره ارسال')}</button>
    </form>
  );
}

function payLabel(o: Order): string {
  const cur = o.paymentCurrency || 'toman';
  const amt = o.paymentAmount ?? o.totalToman;
  if (cur === 'stars_xtr') return `⭐ ${formatNumFa(amt)}${tr(' Stars تلگرام')}`;
  if (cur === 'stars') return `⭐ ${formatNumFa(amt)}${tr(' ستاره کیف‌پول')}`;
  if (cur === 'coins') return `🪙 ${formatNumFa(amt)}${tr(' سکه')}`;
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

function itemLineTotal(it: OrderItem): string | null {
  const qty = Math.max(1, Number(it.qty) || 1);
  if (it.priceToman != null && Number.isFinite(Number(it.priceToman))) {
    return formatTomanFa(Number(it.priceToman) * qty);
  }
  if (it.stars != null && Number(it.stars) > 0) {
    return `⭐ ${formatNumFa(Number(it.stars) * qty)}`;
  }
  if (it.coins != null && Number(it.coins) > 0) {
    return `🪙 ${formatNumFa(Number(it.coins) * qty)}`;
  }
  return null;
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
        const lineTotal = itemLineTotal(it);
        const unit = itemUnitPrice(it);
        return (
          <li key={`${it.productId || title}-${idx}`} className="admin-order-detail__item">
            <div className="admin-order-detail__item-main">
              <span className="admin-order-detail__item-title">{title}</span>
              {it.productId ? (
                <span className="admin-order-detail__item-sku admin-muted" dir="ltr">
                  {it.productId}
                </span>
              ) : null}
            </div>
            <span className="admin-order-detail__item-qty" dir="ltr">
              ×{formatNumFa(qty)}
            </span>
            <span className="admin-order-detail__item-price">
              {qty > 1 && lineTotal ? (
                <>
                  <span className="admin-order-detail__item-unit admin-muted">{unit}</span>
                  <strong>{lineTotal}</strong>
                </>
              ) : (
                unit
              )}
            </span>
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
  const [username, setUsername] = useState('');
  const [mobile, setMobile] = useState('');
  const [product, setProduct] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [showRawJson] = useState(adminWantsRawJson);
  const [refundBusy, setRefundBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (q.trim()) qs.set('q', q.trim());
      if (username.trim()) qs.set('username', username.trim());
      if (mobile.trim()) qs.set('mobile', mobile.trim());
      if (product.trim()) qs.set('product', product.trim());
      if (paymentStatus) qs.set('paymentStatus', paymentStatus);
      const data = await adminFetch<{ orders: Order[] }>(`/api/admin/shop/orders?${qs}`);
      setOrders(data.orders);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [status, q, username, mobile, product, paymentStatus]);

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

  const refund = async (id: number) => {
    setRefundBusy(id);
    try {
      const result = await adminFetch<{
        alreadyRefunded: boolean;
        order: Order;
        credits: { toman: number; coins: number; stars: number };
      }>(`/api/admin/shop/orders/${id}/refund`, { method: 'POST', body: '{}' });
      if (result.alreadyRefunded) {
        setError(tr('این سفارش قبلاً برگشت خورده است'));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setRefundBusy(null);
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
        <input className="admin-input" placeholder={tr('نام کاربری')} value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className="admin-input" placeholder={tr('موبایل')} value={mobile} onChange={(e) => setMobile(e.target.value)} />
        <input className="admin-input" placeholder={tr('محصول')} value={product} onChange={(e) => setProduct(e.target.value)} />
        <select className="admin-select" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
          <option value="">{tr('وضعیت پرداخت')}</option>
          <option value="paid">{tr('پرداخت شده')}</option>
          <option value="unpaid">{tr('پرداخت نشده')}</option>
        </select>
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
                      <div className="admin-row-actions">
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
                        {o.refundedAt ? null : (
                          <button
                            type="button"
                            className="admin-btn admin-btn--danger"
                            disabled={refundBusy === o.id}
                            onClick={() => void refund(o.id)}
                            data-testid={`admin-order-refund-${o.id}`}
                          >
                            {refundBusy === o.id ? tr('در حال برگشت…') : tr('لغو و برگشت به کیف پول')}
                          </button>
                        )}
                      </div>
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
                            <h3 className="admin-order-detail__label">{tr('ارسال و پرداخت')}</h3>
                            <p>{tr('حامل:')} {o.shippingCarrier || '—'} · {tr('رهگیری:')} {o.trackingCode || '—'}</p>
                            <p>{tr('بازیگر درگاه:')} {o.paymentActor || '—'} · {tr('پرداخت نهایی:')} {o.paidFinal ? tr('بله') : tr('خیر')} · {o.paymentStatus || '—'}</p>
                            <ShippingEditor order={o} onSaved={() => void load()} />
                            {o.refundedAt || o.refund ? (
                              <p data-testid="admin-order-refund-note">
                                <strong>{tr('برگشت به کیف پول')}:</strong>{' '}
                                {o.refund?.toman ? formatTomanFa(o.refund.toman) : null}
                                {o.refund?.coins ? ` ${formatNumFa(o.refund.coins)} ${tr('سکه')}` : null}
                                {o.refund?.stars ? ` ⭐ ${formatNumFa(o.refund.stars)}` : null}
                                {!o.refund?.toman && !o.refund?.coins && !o.refund?.stars ? tr('وجهی برای برگشت نبود') : null}
                                {o.refundedAt ? ` · ${formatAdminFaDateTime(o.refundedAt)}` : null}
                              </p>
                            ) : null}
                          </section>
                          <section className="admin-order-detail__block">
                            <h3 className="admin-order-detail__label">{tr('آیتم‌ها')}</h3>
                            <OrderItemsList items={o.items} />
                            {showRawJson ? (
                              <details className="admin-order-detail__raw">
                                <summary>{tr('JSON خام')}</summary>
                                <pre dir="ltr">{JSON.stringify(o.items, null, 2)}</pre>
                              </details>
                            ) : null}
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
