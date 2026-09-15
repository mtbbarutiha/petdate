import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { orderPublicIdOf } from '@petdate/shared';
import { useAuthStore } from '../../hooks/useAuthStore';
import { fetchMyShopOrder, type MyShopOrder } from '../../lib/api';
import { loginPath } from '../../lib/authRedirect';
import { ShopChrome } from '../../components/shop/ShopChrome';
import { ShopInvoice } from '../../components/shop/ShopInvoice';

export function ShopOrderDetailPage() {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const { isLoggedIn, token } = useAuthStore();
  const [order, setOrder] = useState<MyShopOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token || !orderId) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchMyShopOrder(token, orderId);
      setOrder(data.order);
    } catch (err) {
      setOrder(null);
      setError(err instanceof Error ? err.message : 'خطا در دریافت فاکتور');
    } finally {
      setLoading(false);
    }
  }, [token, orderId]);

  useEffect(() => {
    if (isLoggedIn && token) void load();
  }, [isLoggedIn, token, load]);

  const title = order ? `فاکتور ${orderPublicIdOf(order)}` : 'فاکتور سفارش';

  return (
    <ShopChrome bannerTitle={title} bannerLead="جزئیات خرید پت‌شاپ — قابل پیگیری با شناسه PD-O">
      <div className="pepito-container pd-shop-cart">
        {!isLoggedIn ? (
          <div className="pd-shop-order-ok">
            <p>برای دیدن فاکتور وارد حساب شوید.</p>
            <Link
              to={loginPath(`/shop/orders/${encodeURIComponent(orderId)}`)}
              className="pepito-btn button-1"
            >
              ورود
            </Link>
          </div>
        ) : (
          <div className="pd-shop-order-detail">
            <div className="pd-shop-orders-head">
              <h2>فاکتور خرید</h2>
              <div className="pd-shop-pay-actions">
                <Link to="/shop/orders" className="pepito-btn button-2">
                  همه سفارش‌ها
                </Link>
                <Link to="/shop" className="pepito-btn button-1">
                  ادامه خرید
                </Link>
              </div>
            </div>
            {error ? <p className="pd-shop-form-error">{error}</p> : null}
            {loading ? <p className="pd-shop-empty">در حال بارگذاری فاکتور…</p> : null}
            {!loading && order ? (
              <ShopInvoice
                order={{
                  id: order.id,
                  publicId: order.publicId,
                  status: order.status,
                  totalToman: order.totalToman,
                  paymentCurrency: order.paymentCurrency,
                  paymentAmount: order.paymentAmount,
                  customerName: order.customerName,
                  customerPhone: order.customerPhone,
                  note: order.note,
                  items: order.items,
                  createdAt: order.createdAt,
                }}
              />
            ) : null}
          </div>
        )}
      </div>
    </ShopChrome>
  );
}
