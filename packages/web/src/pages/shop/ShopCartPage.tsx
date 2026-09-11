import { type FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { COIN_PRICE_TOMAN, STAR_PRICE_TOMAN, walletFromUserFields } from '@petdate/shared';
import { formatShopCoins, formatShopStars, formatToman } from '../../data/shopCatalog';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useShopCart } from '../../hooks/useShopCart';
import {
  checkoutShopWithCard,
  checkoutShopWithCoins,
  checkoutShopWithStars,
  checkoutShopWithToman,
  checkoutShopWithWalletStars,
} from '../../lib/api';
import { loginPath } from '../../lib/authRedirect';
import { trackBeginCheckout, trackPurchase } from '../../lib/siteAnalytics';
import { ShopChrome } from '../../components/shop/ShopChrome';

type PayMethod = 'coins' | 'wallet_stars' | 'telegram_stars' | 'toman' | 'card';

export function ShopCartPage() {
  const navigate = useNavigate();
  const { lines, itemCount, totalToman, totalCoins, totalStars, setQty, remove, clear, rememberPaidOrder } =
    useShopCart();
  const { isLoggedIn, token, user, refreshMe } = useAuthStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('coins');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paidLabel, setPaidLabel] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const coinBalance = useMemo(() => {
    if (!user) return 0;
    return user.wallet?.coins ?? walletFromUserFields(user).coins ?? user.coins ?? 0;
  }, [user]);

  const starsBalance = useMemo(() => {
    if (!user) return 0;
    return user.wallet?.stars ?? walletFromUserFields(user).stars ?? user.walletStars ?? 0;
  }, [user]);

  const tomanBalance = useMemo(() => {
    if (!user) return 0;
    return user.wallet?.toman ?? walletFromUserFields(user).toman ?? user.walletToman ?? 0;
  }, [user]);

  const canAffordCoins = coinBalance >= totalCoins && totalCoins > 0;
  const canAffordWalletStars = starsBalance >= totalStars && totalStars > 0;
  const canAffordToman = tomanBalance >= totalToman && totalToman > 0;
  const telegramLinked = Boolean(user?.telegramId);

  const payDisabled =
    lines.length === 0 ||
    submitting ||
    (payMethod === 'coins' && !canAffordCoins) ||
    (payMethod === 'wallet_stars' && !canAffordWalletStars) ||
    (payMethod === 'toman' && !canAffordToman) ||
    (payMethod === 'telegram_stars' && !telegramLinked);

  const pay = async () => {
    setError('');
    if (!isLoggedIn || !token) {
      setError('برای پرداخت وارد حساب شوید.');
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
    if (payMethod === 'coins' && !canAffordCoins) {
      setError(
        `موجودی سکه کافی نیست. نیاز: ${totalCoins.toLocaleString('fa-IR')} — موجودی: ${coinBalance.toLocaleString('fa-IR')}`
      );
      return;
    }
    if (payMethod === 'wallet_stars' && !canAffordWalletStars) {
      setError(
        `موجودی ستاره پنل کافی نیست. نیاز: ${totalStars.toLocaleString('fa-IR')} — موجودی: ${starsBalance.toLocaleString('fa-IR')}`
      );
      return;
    }
    if (payMethod === 'toman' && !canAffordToman) {
      setError(
        `موجودی تومان کافی نیست. نیاز: ${totalToman.toLocaleString('fa-IR')} — موجودی: ${tomanBalance.toLocaleString('fa-IR')}`
      );
      return;
    }
    if (payMethod === 'telegram_stars' && !telegramLinked) {
      setError('برای پرداخت با Stars تلگرام، حساب وب را به ربات وصل کن (از کیف پول).');
      return;
    }

    setSubmitting(true);
    const payload = {
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
      customerName: name.trim(),
      customerPhone: phone.trim(),
      address: address.trim(),
      note: note.trim() || undefined,
    };
    const ecomItems = lines.map((l) => ({
      item_id: l.productId,
      item_name: l.product.title,
      price: l.product.priceToman,
      quantity: l.qty,
      item_category: l.product.categorySlug,
    }));
    trackBeginCheckout({ value: totalToman, items: ecomItems });
    try {
      if (payMethod === 'coins') {
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
        trackPurchase({
          transactionId: String(result.orderId),
          value: result.totalToman,
          items: ecomItems,
          paymentType: 'coins',
        });
        clear();
        setPaidLabel(formatShopCoins(result.coinsSpent));
        setOrderId(String(result.orderId));
      } else if (payMethod === 'wallet_stars') {
        const result = await checkoutShopWithWalletStars(token, payload);
        rememberPaidOrder({
          id: String(result.orderId),
          createdAt: new Date().toISOString(),
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          note: note.trim() || undefined,
          items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
          totalToman: result.totalToman,
          totalStars: result.starsSpent,
          status: 'paid',
          paymentCurrency: 'stars',
        });
        trackPurchase({
          transactionId: String(result.orderId),
          value: result.totalToman,
          items: ecomItems,
          paymentType: 'wallet_stars',
        });
        clear();
        setPaidLabel(formatShopStars(result.starsSpent));
        setOrderId(String(result.orderId));
      } else if (payMethod === 'toman') {
        const result = await checkoutShopWithToman(token, payload);
        rememberPaidOrder({
          id: String(result.orderId),
          createdAt: new Date().toISOString(),
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          note: note.trim() || undefined,
          items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
          totalToman: result.totalToman,
          status: 'paid',
          paymentCurrency: 'toman',
        });
        trackPurchase({
          transactionId: String(result.orderId),
          value: result.totalToman,
          items: ecomItems,
          paymentType: 'toman',
        });
        clear();
        setPaidLabel(formatToman(result.tomanSpent));
        setOrderId(String(result.orderId));
      } else if (payMethod === 'card') {
        const result = await checkoutShopWithCard(token, payload);
        clear();
        navigate(`/shop/card-pay/${result.paymentOrderId}`, { replace: true });
        return;
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
      setSubmitting(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void pay();
  };

  return (
    <ShopChrome bannerTitle="سبد خرید" bannerLead="روش پرداخت را انتخاب کن — سکه، ستاره، ریال یا فاکتور تلگرام">
      <div className="pepito-container pd-shop-cart">
        {orderId ? (
          <div className="pd-shop-order-ok">
            <h2>پرداخت انجام شد</h2>
            <p>
              شماره سفارش: <strong dir="ltr">#{orderId}</strong>
            </p>
            {paidLabel != null ? (
              <p>
                مبلغ پرداختی: <strong>{paidLabel}</strong>
              </p>
            ) : null}
            <p>سفارش در سیستم ثبت شد و در «سفارش‌های من» قابل پیگیری است.</p>
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
                  (هر ستاره ≈ {STAR_PRICE_TOMAN.toLocaleString('fa-IR')} تومان)
                </span>
              </p>
              {!isLoggedIn ? (
                <div className="pd-shop-soft-gate">
                  <p>مرور سبد آزاد است. برای پرداخت وارد شوید.</p>
                  <Link to={loginPath('/shop/cart')} className="pepito-btn button-1">
                    ورود برای پرداخت
                  </Link>
                </div>
              ) : (
                <form className="pd-shop-checkout-form" onSubmit={onSubmit}>
                  <p className="pd-shop-checkout-balance" role="status">
                    موجودی سکه پنل:{' '}
                    <strong className={canAffordCoins || lines.length === 0 ? undefined : 'pd-shop-balance-low'}>
                      {formatShopCoins(coinBalance)}
                    </strong>
                  </p>
                  <p className="pd-shop-checkout-balance" role="status">
                    موجودی ستاره پنل:{' '}
                    <strong
                      className={canAffordWalletStars || lines.length === 0 ? undefined : 'pd-shop-balance-low'}
                    >
                      {formatShopStars(starsBalance)}
                    </strong>
                  </p>
                  <p className="pd-shop-checkout-balance" role="status">
                    موجودی تومان پنل:{' '}
                    <strong className={canAffordToman || lines.length === 0 ? undefined : 'pd-shop-balance-low'}>
                      {formatToman(tomanBalance)}
                    </strong>
                  </p>

                  <fieldset className="pd-shop-pay-methods">
                    <legend>روش پرداخت</legend>
                    <label className={`pd-shop-pay-option${payMethod === 'coins' ? ' is-active' : ''}`}>
                      <input
                        type="radio"
                        name="payMethod"
                        value="coins"
                        checked={payMethod === 'coins'}
                        onChange={() => setPayMethod('coins')}
                      />
                      <span>
                        <strong>سکه پنل پت‌دیت</strong>
                        <small>
                          {formatShopCoins(totalCoins)}
                          {!canAffordCoins && lines.length > 0 ? ' — موجودی کافی نیست' : ''}
                        </small>
                      </span>
                    </label>
                    <label className={`pd-shop-pay-option${payMethod === 'wallet_stars' ? ' is-active' : ''}`}>
                      <input
                        type="radio"
                        name="payMethod"
                        value="wallet_stars"
                        checked={payMethod === 'wallet_stars'}
                        onChange={() => setPayMethod('wallet_stars')}
                      />
                      <span>
                        <strong>ستاره پنل پت‌دیت</strong>
                        <small>
                          {formatShopStars(totalStars)}
                          {!canAffordWalletStars && lines.length > 0 ? ' — موجودی کافی نیست' : ''}
                        </small>
                      </span>
                    </label>
                    <label className={`pd-shop-pay-option${payMethod === 'toman' ? ' is-active' : ''}`}>
                      <input
                        type="radio"
                        name="payMethod"
                        value="toman"
                        checked={payMethod === 'toman'}
                        onChange={() => setPayMethod('toman')}
                      />
                      <span>
                        <strong>ریال / تومان پنل</strong>
                        <small>
                          {formatToman(totalToman)}
                          {!canAffordToman && lines.length > 0 ? ' — موجودی کافی نیست' : ''}
                        </small>
                      </span>
                    </label>
                    <label className={`pd-shop-pay-option${payMethod === 'card' ? ' is-active' : ''}`}>
                      <input
                        type="radio"
                        name="payMethod"
                        value="card"
                        checked={payMethod === 'card'}
                        onChange={() => setPayMethod('card')}
                      />
                      <span>
                        <strong>کارت‌به‌کارت (ریال)</strong>
                        <small>واریز ریالی و ارسال رسید در ربات</small>
                      </span>
                    </label>
                    <label
                      className={`pd-shop-pay-option${payMethod === 'telegram_stars' ? ' is-active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="payMethod"
                        value="telegram_stars"
                        checked={payMethod === 'telegram_stars'}
                        onChange={() => setPayMethod('telegram_stars')}
                      />
                      <span>
                        <strong>فاکتور Stars تلگرام</strong>
                        <small>
                          صدور اینوویس و پرداخت مستقیم در تلگرام
                          {!telegramLinked ? ' — اول حساب را به ربات وصل کن' : ''}
                        </small>
                      </span>
                    </label>
                  </fieldset>

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
                    <button type="submit" className="pepito-btn button-1" disabled={payDisabled}>
                      {submitting ? 'در حال پرداخت…' : 'پرداخت'}
                    </button>
                  </div>
                  <p className="pd-shop-soon">
                    سکه، ستاره و تومان پنل از کیف‌پول کسر می‌شوند. کارت‌به‌کارت با ارسال رسید در ربات تأیید
                    می‌شود. فاکتور Stars هم داخل تلگرام پرداخت می‌شود.
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
