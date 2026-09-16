import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  COIN_PRICE_TOMAN,
  STAR_PRICE_TOMAN,
  buyCoinsPath,
  walletFromUserFields,
  orderPublicIdOf,
} from '@petdate/shared';
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
import { appConfirm } from '../../components/AppDialog';
import { ShopChrome } from '../../components/shop/ShopChrome';
import { ShopInvoice, type ShopInvoiceOrder } from '../../components/shop/ShopInvoice';
import { fetchPublicPlatformConfig, usePlatformConfig } from '../../hooks/usePlatformConfig';
import { useI18n } from '../../i18n';

type PayMethod = 'coins' | 'wallet_stars' | 'telegram_stars' | 'toman' | 'card';

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

export function ShopCartPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lines, itemCount, totalToman, totalCoins, totalStars, setQty, remove, clear, rememberPaidOrder } =
    useShopCart();
  const { isLoggedIn, token, user, refreshMe } = useAuthStore();
  const platform = usePlatformConfig();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('coins');
  const [completedInvoice, setCompletedInvoice] = useState<ShopInvoiceOrder | null>(null);
  const [paidLabel, setPaidLabel] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [cardCopied, setCardCopied] = useState(false);
  const nextPath = `${location.pathname}${location.search}`;

  // Checkout needs live payment-card destination ASAP (platform hook is LCP-deferred elsewhere).
  useEffect(() => {
    void fetchPublicPlatformConfig(true);
  }, []);

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

  const depositCard = platform.paymentCardConfigured ? platform.paymentCard : null;
  const cardConfigured = Boolean(depositCard?.cardNumber && depositCard?.cardHolder);
  const cardDisplay =
    depositCard?.cardGrouped ||
    (depositCard?.cardNumber || '').replace(/(\d{4})(?=\d)/g, '$1 ').trim();

  const payDisabled =
    lines.length === 0 ||
    submitting ||
    (payMethod === 'wallet_stars' && !canAffordWalletStars) ||
    (payMethod === 'toman' && !canAffordToman) ||
    (payMethod === 'telegram_stars' && !telegramLinked) ||
    (payMethod === 'card' && !cardConfigured);

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
      navigate(buyCoinsPath({ need: totalCoins || 1, next: nextPath }));
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
    if (payMethod === 'card' && !cardConfigured) {
      setError(platform.paymentCardError || 'شماره کارت واریز پیکربندی نشده.');
      return;
    }

    if (payMethod === 'coins') {
      const ok = await appConfirm(
        `مطمئنی می‌خوای ${totalCoins.toLocaleString('fa-IR')} سکه برای خرید کسر بشه؟`,
      );
      if (!ok) return;
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

        const invoice: ShopInvoiceOrder = {
          id: result.order?.id ?? result.orderId,
          publicId: result.order?.publicId,
          status: result.order?.status ?? 'paid',
          totalToman: result.totalToman,
          paymentCurrency: 'coins',
          paymentAmount: result.coinsSpent,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          note: [`آدرس ارسال: ${address.trim()}`, note.trim()].filter(Boolean).join('\n'),
          items: lines.map((l) => ({
            productId: l.productId,
            title: l.product.title,
            qty: l.qty,
            unitPriceToman: l.product.priceToman,
            lineTotalToman: l.product.priceToman * l.qty,
          })),
          createdAt: new Date().toISOString(),
        };

        clear();
        setPaidLabel(formatShopCoins(result.coinsSpent));
        setCompletedInvoice(invoice);
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

        const invoice: ShopInvoiceOrder = {
          id: result.order?.id ?? result.orderId,
          publicId: result.order?.publicId,
          status: result.order?.status ?? 'paid',
          totalToman: result.totalToman,
          paymentCurrency: 'stars',
          paymentAmount: result.starsSpent,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          note: [`آدرس ارسال: ${address.trim()}`, note.trim()].filter(Boolean).join('\n'),
          items: lines.map((l) => ({
            productId: l.productId,
            title: l.product.title,
            qty: l.qty,
            unitPriceToman: l.product.priceToman,
            lineTotalToman: l.product.priceToman * l.qty,
          })),
          createdAt: new Date().toISOString(),
        };

        clear();
        setPaidLabel(formatShopStars(result.starsSpent));
        setCompletedInvoice(invoice);
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

        const invoice: ShopInvoiceOrder = {
          id: result.order?.id ?? result.orderId,
          publicId: result.order?.publicId,
          status: result.order?.status ?? 'paid',
          totalToman: result.totalToman,
          paymentCurrency: 'toman',
          paymentAmount: result.tomanSpent,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          note: [`آدرس ارسال: ${address.trim()}`, note.trim()].filter(Boolean).join('\n'),
          items: lines.map((l) => ({
            productId: l.productId,
            title: l.product.title,
            qty: l.qty,
            unitPriceToman: l.product.priceToman,
            lineTotalToman: l.product.priceToman * l.qty,
          })),
          createdAt: new Date().toISOString(),
        };

        clear();
        setPaidLabel(formatToman(result.tomanSpent));
        setCompletedInvoice(invoice);
      } else if (payMethod === 'card') {
        const result = await checkoutShopWithCard(token, payload);
        clear();
        const qs = result.receiptToken ? `?t=${encodeURIComponent(result.receiptToken)}` : '';
        navigate(`/shop/card-pay/${result.paymentOrderId}${qs}`, { replace: true });
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
      const msg = err instanceof Error ? err.message : 'پرداخت ناموفق بود.';
      setError(msg);
      if (payMethod === 'coins' && /سکه|coins|موجودی/i.test(msg)) {
        navigate(buyCoinsPath({ need: totalCoins || 1, next: nextPath }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void pay();
  };

  const onCopyCard = async () => {
    const raw = (depositCard?.cardNumber || '').replace(/\D/g, '');
    if (!raw) return;
    const ok = await copyText(raw);
    if (ok) {
      setCardCopied(true);
      window.setTimeout(() => setCardCopied(false), 2000);
    }
  };

  return (
    <ShopChrome bannerTitle="سبد خرید" bannerLead="روش پرداخت را انتخاب کن — سکه، ستاره، ریال یا فاکتور تلگرام">
      <div className="pepito-container pd-shop-cart">
        {completedInvoice ? (
          <div className="pd-shop-order-ok pd-shop-order-ok--invoice">
            <h2>پرداخت انجام شد</h2>
            <p>فاکتور خریدت آماده است — با شناسه فروشگاه قابل پیگیری است.</p>
            <ShopInvoice order={completedInvoice} paidLabelOverride={paidLabel} />
            <div className="pd-shop-pay-actions" style={{ marginTop: 16 }}>
              <Link
                to={`/shop/orders/${encodeURIComponent(orderPublicIdOf(completedInvoice))}`}
                className="pepito-btn button-1"
              >
                مشاهده در سفارش‌های من
              </Link>
              <Link to="/shop" className="pepito-btn button-2">
                بازگشت به پت‌شاپ
              </Link>
            </div>
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

                  <div className="pd-shop-pay-methods">
                    <label className="pd-shop-pay-select-label" htmlFor="shop-pay-method">
                      روش پرداخت
                    </label>
                    <select
                      id="shop-pay-method"
                      className="pd-shop-pay-select"
                      name="payMethod"
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value as PayMethod)}
                      aria-describedby="shop-pay-method-hint"
                    >
                      <option value="coins">
                        {`سکه پنل پت‌دیت — ${formatShopCoins(totalCoins)}${
                          !canAffordCoins && lines.length > 0 ? ' — موجودی کافی نیست' : ''
                        }`}
                      </option>
                      {platform.paymentStarsEnabled ? (
                        <option value="wallet_stars">
                          {`ستاره پنل پت‌دیت — ${formatShopStars(totalStars)}${
                            !canAffordWalletStars && lines.length > 0 ? ' — موجودی کافی نیست' : ''
                          }`}
                        </option>
                      ) : null}
                      <option value="toman">
                        {`ریال / تومان پنل — ${formatToman(totalToman)}${
                          !canAffordToman && lines.length > 0 ? ' — موجودی کافی نیست' : ''
                        }`}
                      </option>
                      {platform.paymentCardEnabled ? (
                        <option value="card">کارت‌به‌کارت (ریال) — واریز و آپلود فیش در سایت</option>
                      ) : null}
                      {platform.paymentStarsEnabled ? (
                        <option value="telegram_stars">
                          {`فاکتور Stars تلگرام — صدور اینوویس و پرداخت مستقیم در تلگرام${
                            !telegramLinked ? ' — اول حساب را به ربات وصل کن' : ''
                          }`}
                        </option>
                      ) : null}
                    </select>
                    <p id="shop-pay-method-hint" className="pd-shop-pay-select-hint">
                      {payMethod === 'coins'
                        ? `${formatShopCoins(totalCoins)}${
                            !canAffordCoins && lines.length > 0 ? ' — موجودی کافی نیست' : ''
                          }`
                        : payMethod === 'wallet_stars'
                          ? `${formatShopStars(totalStars)}${
                              !canAffordWalletStars && lines.length > 0 ? ' — موجودی کافی نیست' : ''
                            }`
                          : payMethod === 'toman'
                            ? `${formatToman(totalToman)}${
                                !canAffordToman && lines.length > 0 ? ' — موجودی کافی نیست' : ''
                              }`
                            : payMethod === 'card'
                              ? 'مبلغ را به کارت زیر واریز کن؛ بعد از ثبت، فایل فیش را در صفحه بعد آپلود کن'
                              : `صدور اینوویس و پرداخت مستقیم در تلگرام${
                                  !telegramLinked ? ' — اول حساب را به ربات وصل کن' : ''
                                }`}
                    </p>
                    {!platform.paymentCardEnabled ? (
                      <p className="admin-muted">{t('platform.cardOff')}</p>
                    ) : null}
                  </div>

                  {payMethod === 'card' ? (
                    <div className="pd-shop-card-deposit" role="region" aria-label="اطلاعات کارت واریز">
                      {cardConfigured && depositCard ? (
                        <>
                          <p className="pd-shop-card-deposit-title">کارت مقصد واریز</p>
                          <p className="pd-shop-card-deposit-number">
                            <strong>
                              <bdi className="pepito-card-pan" dir="ltr">
                                {cardDisplay}
                              </bdi>
                            </strong>
                          </p>
                          <p className="pd-shop-card-deposit-holder">
                            به‌نام: <strong>{depositCard.cardHolder}</strong>
                          </p>
                          <div className="pd-shop-card-deposit-actions">
                            <button type="button" className="pepito-btn button-2" onClick={() => void onCopyCard()}>
                              {cardCopied ? 'کپی شد' : 'کپی شماره کارت'}
                            </button>
                          </div>
                          <p className="pd-shop-card-deposit-hint">
                            بعد از زدن «پرداخت»، مبلغ را واریز کن و عکس یا PDF فیش را در همان صفحه آپلود کن.
                            ارسال از ربات اختیاری است.
                          </p>
                        </>
                      ) : (
                        <p className="pd-shop-form-error">
                          {platform.paymentCardError ||
                            'شماره کارت واریز پیکربندی نشده. PAYMENT_CARD_NUMBER و PAYMENT_CARD_HOLDER را در محیط سرور تنظیم کنید.'}
                        </p>
                      )}
                    </div>
                  ) : null}

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
                      {submitting
                        ? 'در حال پرداخت…'
                        : payMethod === 'card'
                          ? 'ادامه — واریز و آپلود فیش'
                          : 'پرداخت'}
                    </button>
                  </div>
                  <p className="pd-shop-soon">
                    سکه، ستاره و تومان پنل از کیف‌پول کسر می‌شوند. کارت‌به‌کارت با آپلود فیش در
                    همین سایت تأیید می‌شود (ربات اختیاری است). فاکتور Stars داخل تلگرام پرداخت می‌شود.
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
