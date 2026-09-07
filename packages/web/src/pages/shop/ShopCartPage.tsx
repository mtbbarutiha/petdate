import { type FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { COIN_PRICE_TOMAN, STAR_PRICE_TOMAN, walletFromUserFields } from '@petdate/shared';
import { formatShopCoins, formatShopStars, formatToman } from '../../data/shopCatalog';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useShopCart } from '../../hooks/useShopCart';
import { checkoutShopWithCoins, checkoutShopWithStars } from '../../lib/api';
import { loginPath } from '../../lib/authRedirect';
import { ShopChrome } from '../../components/shop/ShopChrome';

type PayMethod = 'coins' | 'stars';

export function ShopCartPage() {
  const navigate = useNavigate();
  const { lines, itemCount, totalToman, totalCoins, totalStars, setQty, remove, clear, rememberPaidOrder } =
    useShopCart();
  const { isLoggedIn, token, user, refreshMe } = useAuthStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paidCoins, setPaidCoins] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<PayMethod | null>(null);
  const [error, setError] = useState('');

  const coinBalance = useMemo(() => {
    if (!user) return 0;
    return user.wallet?.coins ?? walletFromUserFields(user).coins ?? user.coins ?? 0;
  }, [user]);

  const canAffordCoins = coinBalance >= totalCoins && totalCoins > 0;
  const telegramLinked = Boolean(user?.telegramId);

  const pay = async (method: PayMethod) => {
    setError('');
    if (!isLoggedIn || !token) {
      setError(method === 'stars' ? 'برای پرداخت با ستاره وارد حساب شوید.' : 'برای پرداخت با سکه وارد حساب شوید.');
      return;
    }
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError('نام، موبایل و آدرس لازم است.');
      return;
    }
    if (lines.length === 0) {
      setError('سبد خالی است.');
      return;
    }
    if (method === 'coins' && !canAffordCoins) {
      setError(
        `موجودی سکه کافی نیست. نیاز: ${totalCoins.toLocaleString('fa-IR')} — موجودی: ${coinBalance.toLocaleString('fa-IR')}`
      );
      return;
    }
    if (method === 'stars' && !telegramLinked) {
      setError('برای پرداخت با Stars تلگرام، حساب وب را به ربات وصل کن (از کیف پول).');
      return;
    }

    setSubmitting(method);
    const payload = {
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
      customerName: name.trim(),
      customerPhone: phone.trim(),
      address: address.trim(),
      note: note.trim() || undefined,
    };
    try {
      if (method === 'coins') {
        const result = await checkoutShopWithCoins(token, payload);
        rememberPaidOrder({
          id: String(result.orderId),
          createdAt: new Date().toISOString(),
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          note: note.trim() || undefined,
          items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
          totalToman: result.totalToman,
          totalCoins: result.coinsSpent,
          status: 'paid',
          paymentCurrency: 'coins',
        });
        clear();
        setPaidCoins(result.coinsSpent);
        setOrderId(String(result.orderId));
      } else {
        const result = await checkoutShopWithStars(token, payload);
        clear();
        navigate(`/shop/stars-pay/${result.paymentOrderId}`, { replace: true });
        return;
      }
      try {
        await refreshMe();
      } catch {
        /* wallet chip may lag */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'پرداخت ناموفق بود.');
    } finally {
      setSubmitting(null);
    }
  };

  const onSubmitCoins = (e: FormEvent) => {
    e.preventDefault();
    void pay('coins');
  };

  return (
    <ShopChrome bannerTitle="سبد خرید" bannerLead="سکه از کیف پول — ستاره با فاکتور واقعی تلگرام به ربات">
      <div className="pepito-container pd-shop-cart">
        {orderId ? (
          <div className="pd-shop-order-ok">
            <h2>پرداخت با سکه انجام شد</h2>
            <p>
              شماره سفارش: <strong dir="ltr">#{orderId}</strong>
            </p>
            {paidCoins != null ? (
              <p>
                مبلغ پرداختی: <strong>{formatShopCoins(paidCoins)}</strong>
              </p>
            ) : null}
            <p>سفارش به‌عنوان «پرداخت‌شده با سکه» در سرور ثبت شد.</p>
            <Link to="/shop" className="pepito-btn button-1">
              بازگشت به پت شاپ
            </Link>
            <Link to="/shop/orders" className="pepito-btn button-2" style={{ marginInlineStart: 8 }}>
              سفارش‌های من
            </Link>
          </div>
        ) : (
          <div className="pd-shop-cart-layout">
            <section className="pd-shop-cart-lines">
              <h2>
                سبد شما ({itemCount.toLocaleString('fa-IR')} قلم)
              </h2>
              {lines.length === 0 ? (
                <p className="pd-shop-empty">
                  سبد خالی است.{' '}
                  <Link to="/shop">شروع خرید</Link>
                </p>
              ) : (
                <ul className="pd-shop-cart-list">
                  {lines.map((l) => (
                    <li key={l.productId} className="pd-shop-cart-row">
                      <Link to={`/shop/product/${l.product.slug}`} className="pd-shop-cart-thumb">
                        <img src={l.product.image} alt="" />
                      </Link>
                      <div className="pd-shop-cart-meta">
                        <Link to={`/shop/product/${l.product.slug}`}>
                          <h3>{l.product.title}</h3>
                        </Link>
                        <p>{formatToman(l.product.priceToman)}</p>
                        <p className="pd-shop-line-coins">{formatShopCoins(l.lineCoins)}</p>
                        <p className="pd-shop-line-coins">{formatShopStars(l.lineStars)}</p>
                        <div className="pd-shop-qty">
                          <button type="button" onClick={() => setQty(l.productId, l.qty - 1)}>
                            −
                          </button>
                          <span>{l.qty.toLocaleString('fa-IR')}</span>
                          <button type="button" onClick={() => setQty(l.productId, l.qty + 1)}>
                            +
                          </button>
                          <button type="button" className="pd-shop-remove" onClick={() => remove(l.productId)}>
                            حذف
                          </button>
                        </div>
                      </div>
                      <div className="pd-shop-cart-line-total">
                        <span>{formatToman(l.lineTotal)}</span>
                        <span className="pd-shop-line-coins">{formatShopCoins(l.lineCoins)}</span>
                        <span className="pd-shop-line-coins">{formatShopStars(l.lineStars)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="pd-shop-checkout">
              <h2>تکمیل سفارش</h2>
              <p className="pd-shop-checkout-total">
                جمع: <strong>{formatToman(totalToman)}</strong>
              </p>
              <p className="pd-shop-checkout-coins">
                معادل سکه: <strong>{formatShopCoins(totalCoins)}</strong>
                <span className="pd-shop-checkout-rate">
                  (هر سکه ≈ {COIN_PRICE_TOMAN.toLocaleString('fa-IR')} تومان)
                </span>
              </p>
              <p className="pd-shop-checkout-coins">
                معادل ستاره: <strong>{formatShopStars(totalStars)}</strong>
                <span className="pd-shop-checkout-rate">
                  (هر ستاره ≈ {STAR_PRICE_TOMAN.toLocaleString('fa-IR')} تومان — پرداخت XTR)
                </span>
              </p>
              {!isLoggedIn ? (
                <div className="pd-shop-soft-gate">
                  <p>مرور سبد آزاد است. برای پرداخت با سکه یا ستاره وارد شوید.</p>
                  <Link to={loginPath('/shop/cart')} className="pepito-btn button-1">
                    ورود برای پرداخت
                  </Link>
                </div>
              ) : (
                <form className="pd-shop-checkout-form" onSubmit={onSubmitCoins}>
                  <p className="pd-shop-checkout-balance" role="status">
                    موجودی سکه:{' '}
                    <strong className={canAffordCoins || lines.length === 0 ? undefined : 'pd-shop-balance-low'}>
                      {formatShopCoins(coinBalance)}
                    </strong>
                    {!canAffordCoins && lines.length > 0 ? (
                      <span className="pd-shop-afford-warn"> — کافی نیست</span>
                    ) : null}
                  </p>
                  <p className="pd-shop-checkout-balance" role="status">
                    {!telegramLinked ? (
                      <span className="pd-shop-afford-warn">برای Stars تلگرام، حساب وب را به ربات وصل کن</span>
                    ) : (
                      <span className="pd-shop-checkout-rate">پرداخت ستاره = فاکتور واقعی تلگرام (XTR → ربات)</span>
                    )}
                  </p>
                  <label>
                    نام گیرنده
                    <input value={name} onChange={(e) => setName(e.target.value)} required />
                  </label>
                  <label>
                    موبایل
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      dir="ltr"
                      inputMode="tel"
                      required
                    />
                  </label>
                  <label>
                    آدرس ارسال
                    <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} required />
                  </label>
                  <label>
                    توضیحات (اختیاری)
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
                  </label>
                  {error ? <p className="pd-shop-form-error">{error}</p> : null}
                  <div className="pd-shop-pay-actions">
                    <button
                      type="submit"
                      className="pepito-btn button-1"
                      disabled={lines.length === 0 || submitting != null || !canAffordCoins}
                    >
                      {submitting === 'coins' ? 'در حال پرداخت…' : 'پرداخت با سکه'}
                    </button>
                    <button
                      type="button"
                      className="pepito-btn button-2"
                      disabled={lines.length === 0 || submitting != null || !telegramLinked}
                      onClick={() => void pay('stars')}
                    >
                      {submitting === 'stars' ? 'در حال آماده‌سازی…' : 'پرداخت با Stars تلگرام'}
                    </button>
                  </div>
                  <p className="pd-shop-soon">
                    سکه از کیف پول مشترک کسر می‌شود. ستاره با فاکتور XTR از اکانت تلگرام کسر و به ربات واریز
                    می‌شود.
                  </p>
                </form>
              )}
            </section>
          </div>
        )}
      </div>
    </ShopChrome>
  );
}
