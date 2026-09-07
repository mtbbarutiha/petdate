import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatShopStars, formatToman } from '../../data/shopCatalog';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useShopCart } from '../../hooks/useShopCart';
import {
  fetchShopStarsPaymentStatus,
  type ShopStarsPaymentStatus,
} from '../../lib/api';
import { loginPath } from '../../lib/authRedirect';
import { ShopChrome } from '../../components/shop/ShopChrome';

/**
 * صفحه انتظار/رسید پرداخت Stars شاپ.
 * بعد از فاکتور XTR، وضعیت را پول می‌کند؛ وقتی paid شد رسید تراکنش را نشان می‌دهد.
 */
export function ShopStarsPayPage() {
  const { paymentOrderId: rawId } = useParams();
  const paymentOrderId = Number(rawId);
  const navigate = useNavigate();
  const { isLoggedIn, token, refreshMe } = useAuthStore();
  const { rememberPaidOrder } = useShopCart();
  const [status, setStatus] = useState<ShopStarsPaymentStatus | null>(null);
  const [error, setError] = useState('');
  const remembered = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || !token) return;
    if (!Number.isFinite(paymentOrderId) || paymentOrderId <= 0) {
      setError('شناسه فاکتور نامعتبر است.');
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const next = await fetchShopStarsPaymentStatus(token, paymentOrderId);
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
              totalStars: next.stars,
              status: 'paid',
              paymentCurrency: 'stars',
            });
            try {
              await refreshMe();
            } catch {
              /* ignore */
            }
          }
          return;
        }
        timer = setTimeout(() => void tick(), 2500);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'خطا در پیگیری پرداخت');
        timer = setTimeout(() => void tick(), 4000);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isLoggedIn, token, paymentOrderId, rememberPaidOrder, refreshMe]);

  if (!isLoggedIn) {
    return (
      <ShopChrome bannerTitle="پرداخت Stars" bannerLead="برای پیگیری پرداخت وارد شوید">
        <div className="pepito-container pd-shop-cart">
          <div className="pd-shop-order-ok">
            <p>برای دیدن وضعیت پرداخت وارد حساب شوید.</p>
            <Link to={loginPath(`/shop/stars-pay/${paymentOrderId}`)} className="pepito-btn button-1">
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
      bannerTitle={paid ? 'تراکنش موفق' : 'در انتظار پرداخت'}
      bannerLead={
        paid
          ? 'ستاره‌ها به ربات واریز شد و سفارش ثبت شد'
          : 'فاکتور را در تلگرام پرداخت کن — همین صفحه به‌روز می‌شود'
      }
    >
      <div className="pepito-container pd-shop-cart">
        <div className="pd-shop-order-ok">
          {error ? <p className="pd-shop-form-error">{error}</p> : null}

          {paid && status ? (
            <>
              <h2>✅ پرداخت موفق</h2>
              <p>تراکنش Stars تلگرام تأیید شد و سفارش شاپ ثبت گردید.</p>
              <ul className="pd-shop-receipt" style={{ listStyle: 'none', padding: 0, textAlign: 'start' }}>
                {status.shopOrderId != null ? (
                  <li>
                    شماره سفارش شاپ: <strong dir="ltr">#{status.shopOrderId}</strong>
                  </li>
                ) : null}
                <li>
                  شماره فاکتور: <strong dir="ltr">#{status.paymentOrderId}</strong>
                </li>
                <li>
                  مبلغ: <strong>{formatShopStars(status.stars)}</strong>
                </li>
                <li>
                  معادل: <strong>{formatToman(status.totalToman)}</strong>
                </li>
                {status.titleHint ? (
                  <li>
                    کالا: <strong>{status.titleHint}</strong>
                  </li>
                ) : null}
                {status.chargeId ? (
                  <li>
                    شناسه تراکنش تلگرام:{' '}
                    <strong dir="ltr" style={{ wordBreak: 'break-all' }}>
                      {status.chargeId}
                    </strong>
                  </li>
                ) : null}
                {status.paidAt ? (
                  <li>
                    زمان: <strong dir="ltr">{status.paidAt}</strong>
                  </li>
                ) : null}
              </ul>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                <Link to="/shop" className="pepito-btn button-1">
                  بازگشت به پت شاپ
                </Link>
                <button type="button" className="pepito-btn button-2" onClick={() => navigate('/shop/cart')}>
                  سبد خرید
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>در انتظار پرداخت Stars…</h2>
              <p>
                فاکتور <strong dir="ltr">#{paymentOrderId}</strong>
                {status ? (
                  <>
                    {' '}
                    — مبلغ <strong>{formatShopStars(status.stars)}</strong> (
                    {formatToman(status.totalToman)})
                  </>
                ) : null}
              </p>
              <p>بعد از پرداخت در تلگرام، این صفحه خودکار رسید موفق را نشان می‌دهد.</p>
              {status?.botDeepLink ? (
                <a href={status.botDeepLink} className="pepito-btn button-1" target="_blank" rel="noreferrer">
                  باز کردن فاکتور در تلگرام
                </a>
              ) : null}
              <p style={{ marginTop: 12, opacity: 0.75 }}>در حال بررسی وضعیت پرداخت…</p>
            </>
          )}
        </div>
      </div>
    </ShopChrome>
  );
}
