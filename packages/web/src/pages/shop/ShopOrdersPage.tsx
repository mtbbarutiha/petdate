import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatToman } from '../../data/shopCatalog';
import { useAuthStore } from '../../hooks/useAuthStore';
import {
  fetchMyShopOrders,
  type MyShopOrder,
} from '../../lib/api';
import { loginPath } from '../../lib/authRedirect';
import { ShopChrome } from '../../components/shop/ShopChrome';

const STATUS_FA: Record<string, string> = {
  pending: 'در انتظار',
  paid: 'پرداخت‌شده',
  shipped: 'ارسال‌شده',
  completed: 'تکمیل‌شده',
  cancelled: 'لغوشده',
};

function payLabel(o: MyShopOrder): string {
  const cur = o.paymentCurrency || 'toman';
  const amt = o.paymentAmount ?? o.totalToman;
  if (cur === 'stars_xtr') return `⭐ ${Number(amt).toLocaleString('fa-IR')} Stars تلگرام`;
  if (cur === 'stars') return `⭐ ${Number(amt).toLocaleString('fa-IR')} ستاره`;
  if (cur === 'coins') return `🪙 ${Number(amt).toLocaleString('fa-IR')} سکه`;
  if (cur === 'ton') return `◆ ${Number(amt).toLocaleString('fa-IR')} TON`;
  return formatToman(o.totalToman);
}

function itemsLine(o: MyShopOrder): string {
  const items = Array.isArray(o.items) ? o.items : [];
  if (!items.length) return '—';
  return items
    .map((it) => {
      const title = String((it as { title?: string }).title || (it as { productId?: string }).productId || 'کالا');
      const qty = Math.max(1, Number((it as { qty?: number }).qty) || 1);
      return qty > 1 ? `${title} ×${qty.toLocaleString('fa-IR')}` : title;
    })
    .join(' · ');
}

export function ShopOrdersPage() {
  const { isLoggedIn, token } = useAuthStore();
  const [orders, setOrders] = useState<MyShopOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchMyShopOrders(token);
      setOrders(data.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دریافت سفارش‌ها');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isLoggedIn && token) void load();
  }, [isLoggedIn, token, load]);

  return (
    <ShopChrome bannerTitle="سفارش‌های من" bannerLead="پیگیری خریدهای پت شاپ — وب و ربات">
      <div className="pepito-container pd-shop-cart">
        {!isLoggedIn ? (
          <div className="pd-shop-order-ok">
            <p>برای دیدن لیست سفارش‌ها وارد حساب شوید.</p>
            <Link to={loginPath('/shop/orders')} className="pepito-btn button-1">
              ورود
            </Link>
          </div>
        ) : (
          <div className="pd-shop-orders">
            <div className="pd-shop-orders-head">
              <h2>سفارش‌های من</h2>
              <div className="pd-shop-pay-actions">
                <Link to="/shop" className="pepito-btn button-2">
                  ادامه خرید
                </Link>
                <Link to="/shop/cart" className="pepito-btn button-1">
                  سبد خرید
                </Link>
              </div>
            </div>
            {error ? <p className="pd-shop-form-error">{error}</p> : null}
            {loading ? <p className="pd-shop-empty">در حال بارگذاری…</p> : null}
            {!loading && !orders.length ? (
              <p className="pd-shop-empty">
                هنوز سفارشی نداری.{' '}
                <Link to="/shop">برو به پت شاپ</Link>
              </p>
            ) : null}
            <ul className="pd-shop-orders-list">
              {orders.map((o) => (
                <li key={o.id} className="pd-shop-order-card">
                  <div className="pd-shop-order-card-top">
                    <strong dir="ltr">#{o.id}</strong>
                    <span className={`pd-shop-order-status pd-shop-order-status--${o.status}`}>
                      {STATUS_FA[o.status] || o.status}
                    </span>
                  </div>
                  <p className="pd-shop-order-items">{itemsLine(o)}</p>
                  <p>
                    مبلغ: <strong>{formatToman(o.totalToman)}</strong>
                  </p>
                  <p>
                    پرداخت: <strong>{payLabel(o)}</strong>
                  </p>
                  {o.customerName ? <p className="pd-shop-muted">گیرنده: {o.customerName}</p> : null}
                  <p className="pd-shop-muted" dir="ltr">
                    {o.createdAt}
                  </p>
                  {o.paymentCurrency === 'stars_xtr' ? (
                    <p className="pd-shop-muted">⭐ پرداخت با Stars واقعی تلگرام (واریز به ربات)</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ShopChrome>
  );
}
