import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { formatToman } from '../../data/shopCatalog';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useShopCart } from '../../hooks/useShopCart';
import {
  fetchShopCardPaymentStatus,
  type ShopCardPaymentStatus,
} from '../../lib/api';
import { loginPath } from '../../lib/authRedirect';
import { ShopChrome } from '../../components/shop/ShopChrome';

function groupCard(num: string): string {
  const d = String(num || '').replace(/\D/g, '');
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function ShopCardPayPage() {
  const { paymentOrderId: rawId } = useParams();
  const [search] = useSearchParams();
  const receiptToken = search.get('t') || search.get('token') || '';
  const paymentOrderId = Number(rawId);
  const { isLoggedIn, token, refreshMe } = useAuthStore();
  const { rememberPaidOrder } = useShopCart();
  const [status, setStatus] = useState<ShopCardPaymentStatus | null>(null);
  const [error, setError] = useState('');
  const remembered = useRef(false);

  const canTrack = Boolean((isLoggedIn && token) || receiptToken);

  useEffect(() => {
    if (!canTrack) return;
    if (!Number.isFinite(paymentOrderId) || paymentOrderId <= 0) {
      setError('شناسه فاکتور نامعتبر است.');
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const next = await fetchShopCardPaymentStatus(
          token,
          paymentOrderId,
          receiptToken || undefined
        );
        if (cancelled) return;
        setStatus(next);
        setError('');
        if (next.paid) {
          if (!remembered.current && next.shopOrderId != null) {
            remembered.current = true;
            rememberPaidOrder({
              id: String(next.shopOrderId),
              createdAt: next.paidAt || new Date().toISOString(),
              name: '',
              phone: '',
              address: '',
              items: [],
              totalToman: next.totalToman,
              status: 'paid',
              paymentCurrency: 'toman',
            });
            try {
              await refreshMe();
            } catch {
              /* ignore */
            }
          }
          return;
        }
        timer = setTimeout(() => void tick(), 3000);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'خطا در پیگیری پرداخت');
        timer = setTimeout(() => void tick(), 5000);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [canTrack, token, paymentOrderId, receiptToken, rememberPaidOrder, refreshMe]);

  if (!canTrack) {
    return (
      <ShopChrome bannerTitle="پرداخت کارت‌به‌کارت" bannerLead="برای پیگیری وارد شوید">
        <div className="pepito-container pd-shop-cart">
          <div className="pd-shop-order-ok">
            <p>برای دیدن وضعیت پرداخت وارد حساب شوید.</p>
            <Link to={loginPath(`/shop/card-pay/${paymentOrderId}`)} className="pepito-btn button-1">
              ورود
            </Link>
          </div>
        </div>
      </ShopChrome>
    );
  }

  const paid = Boolean(status?.paid);

  return (
    <ShopChrome
      bannerTitle={paid ? 'تراکنش موفق' : 'واریز کارت‌به‌کارت'}
      bannerLead={
        paid
          ? 'رسید تأیید شد — سفارش ثبت شد'
          : 'مبلغ را واریز کن و عکس رسید را در ربات بفرست'
      }
    >
      <div className="pepito-container pd-shop-cart">
        <div className="pd-shop-order-ok">
          {error ? <p className="pd-shop-form-error">{error}</p> : null}

          {paid && status ? (
            <>
              <h2>✅ پرداخت تأیید شد — سفارش نهایی شد</h2>
              {status.shopOrderId != null ? (
                <p>
                  شماره سفارش: <strong dir="ltr">#{status.shopOrderId}</strong>
                </p>
              ) : null}
              <p>
                مبلغ: <strong>{formatToman(status.totalToman)}</strong>
              </p>
              <Link to="/shop/orders" className="pepito-btn button-1">
                سفارش‌های من
              </Link>
            </>
          ) : status ? (
            <>
              <h2>💳 واریز کارت‌به‌کارت</h2>
              <p>
                مبلغ واریز: <strong>{formatToman(status.totalToman)}</strong>
              </p>
              <p dir="ltr">
                شماره کارت: <strong>{groupCard(status.cardNumber)}</strong>
              </p>
              <p>
                به‌نام: <strong>{status.cardHolder}</strong>
              </p>
              <p className="pd-shop-soon">
                بعد از واریز، در ربات عکس رسید را بفرست. پس از تأیید ادمین همین صفحه به‌روز می‌شود.
              </p>
              <a
                className="pepito-btn button-1"
                href={status.botDeepLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                ارسال رسید در ربات
              </a>
              <p className="pd-shop-soon" style={{ marginTop: 12 }}>
                وضعیت فعلی: {status.status === 'pending' ? 'در انتظار بررسی ادمین' : 'منتظر رسید'}
              </p>
            </>
          ) : (
            <p>در حال بارگذاری…</p>
          )}
        </div>
      </div>
    </ShopChrome>
  );
}
