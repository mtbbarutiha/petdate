import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Link2, Receipt, RefreshCw, Sparkles, Wallet } from 'lucide-react';
import {
  BRAND,
  WALLET_CURRENCY_LABELS_FA,
  WALLET_CURRENCY_STATUS,
  WALLET_CURRENCY_SYMBOLS,
  toPersianDigits,
  walletFromUserFields,
  type WalletBalances,
  type WalletCurrency,
} from '@petdate/shared';
import { InviteFriendsCard } from '../components/InviteFriendsCard';
import { useAuthStore } from '../hooks/useAuthStore';
import { useAppToast } from '../hooks/useAppToast';
import { useI18n } from '../i18n';
import {
  createCoinCardPayment,
  fetchBuyCoinsCatalog,
  fetchMyWalletPayments,
  fetchWallet,
  fetchWalletTransactions,
  resolvePublicMediaUrl,
  startTelegramAttach,
  uploadWalletPaymentReceipt,
  type CoinPackageDto,
  type WalletPaymentOrderDto,
  type WalletTransactionDto,
} from '../lib/api';

const ORDER: WalletCurrency[] = ['coins', 'stars', 'toman', 'ton'];

function formatBal(n: number): string {
  const x = Math.floor(Number(n));
  const safe = Number.isFinite(x) && x > 0 ? x : 0;
  return toPersianDigits(new Intl.NumberFormat('en-US').format(safe));
}

function formatDelta(tx: WalletTransactionDto): string {
  const abs = Math.abs(Math.floor(tx.delta || tx.amount || 0));
  const num = toPersianDigits(new Intl.NumberFormat('en-US').format(abs));
  const sign = tx.direction === 'debit' || tx.delta < 0 ? '−' : '+';
  return `${sign}${num}`;
}

function formatTxDate(iso: string): string {
  const raw = String(iso || '').trim();
  if (!raw) return '—';
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const d = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  if (Number.isNaN(d.getTime())) return toPersianDigits(raw.slice(0, 16));
  try {
    return toPersianDigits(
      new Intl.DateTimeFormat('fa-IR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(d)
    );
  } catch {
    return toPersianDigits(raw.slice(0, 16));
  }
}

function sameWallet(a: WalletBalances | null, b: WalletBalances): boolean {
  if (!a) return false;
  return a.ton === b.ton && a.stars === b.stars && a.coins === b.coins && a.toman === b.toman;
}
function paymentStatusFa(status: string): string {
  if (status === 'awaiting_receipt') return 'منتظر رسید';
  if (status === 'pending') return 'در صف تأیید';
  if (status === 'approved' || status === 'paid') return 'تأیید شده';
  if (status === 'rejected') return 'رد شده';
  return status;
}

/**
 * Dedicated wallet page — multi-currency balances (same source as WalletChip).
 * Includes Telegram attach + Stars sync (bot wallet_stars, not Telegram Payment API).
 * Route is auth-gated via AuthGuard; landing dock sends guests through login?next=/wallet.
 *
 * Layout stability: soft refresh updates state in place (no remount), TG body uses a
 * fixed slot grid so linked/unlinked swaps cannot shift the page, and fetch runs once
 * per token (not on every loadWallet identity change).
 *
 * Visual: Pepito “currency folio” — brand-forward hero, one balance ribbon (4 rails),
 * compact TG strip, ledger transactions. Balances stay visible on this page.
 */
export function WalletPage() {
  const { t } = useI18n();
  const { user, token, refreshMe } = useAuthStore();
  const { toastError, toastInfo, toastSuccess } = useAppToast();
  const [wallet, setWallet] = useState<WalletBalances | null>(null);
  const [telegramLinked, setTelegramLinked] = useState<boolean>(() => Boolean(user?.telegramId));
  const [telegramId, setTelegramId] = useState<string | null>(user?.telegramId ?? null);
  const [topUpDeepLink, setTopUpDeepLink] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(() => !user);
  const [syncing, setSyncing] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkHint, setLinkHint] = useState('');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionDto[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState('');
  const [packages, setPackages] = useState<CoinPackageDto[]>([]);
  const [cardInfo, setCardInfo] = useState<{ number: string; masked: string; grouped: string; holder: string } | null>(null);
  const [activeOrder, setActiveOrder] = useState<WalletPaymentOrderDto | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<WalletPaymentOrderDto[]>([]);
  const [buyBusy, setBuyBusy] = useState(false);
  const [transferRef, setTransferRef] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);
  const hasLocalRef = useRef(Boolean(user));
  const tokenRef = useRef(token);
  const refreshMeRef = useRef(refreshMe);
  tokenRef.current = token;
  refreshMeRef.current = refreshMe;

  useEffect(() => {
    if (user?.telegramId) {
      setTelegramLinked(true);
      setTelegramId(user.telegramId);
    }
  }, [user?.telegramId]);

  const loadTransactions = useCallback(async () => {
    const tok = tokenRef.current;
    if (!tok) return;
    setTxLoading(true);
    try {
      const res = await fetchWalletTransactions(tok, { limit: 40 });
      setTransactions(res.transactions ?? []);
      setTxError('');
    } catch {
      setTxError(t('wallet.txLoadError'));
    } finally {
      setTxLoading(false);
    }
  }, []);

  const loadBuyCoins = useCallback(async () => {
    const tok = tokenRef.current;
    if (!tok) return;
    try {
      const [catalog, payments] = await Promise.all([
        fetchBuyCoinsCatalog(tok),
        fetchMyWalletPayments(tok, { limit: 20, method: 'card' }),
      ]);
      setPackages(catalog.packages ?? []);
      setCardInfo(catalog.card ?? null);
      const open = (catalog.openOrders ?? []).find((o) => (o.status === 'awaiting_receipt' || o.status === 'pending') && !String(o.packageId).startsWith('shop')) ?? null;
      setActiveOrder(open);
      setPaymentHistory((payments.orders ?? []).filter((o) => !String(o.packageId).startsWith('shop')));
    } catch { /* optional */ }
  }, []);

  const loadWallet = useCallback(async (opts?: { soft?: boolean }) => {
    const tok = tokenRef.current;
    if (!tok || inFlightRef.current) return;
    const soft = opts?.soft ?? hasLocalRef.current;
    inFlightRef.current = true;
    if (!soft) setLoading(true);
    else setSyncing(true);
    try {
      const res = await fetchWallet(tok);
      setWallet((prev) => (sameWallet(prev, res.wallet) ? prev : res.wallet));
      hasLocalRef.current = true;
      setTopUpDeepLink(res.telegramStars?.topUpDeepLink ?? null);
      if (res.telegram) {
        setTelegramLinked(Boolean(res.telegram.linked));
        setTelegramId(res.telegram.telegramId);
      } else if (!soft) {
        const me = await refreshMeRef.current().catch(() => null);
        setTelegramLinked(Boolean(me?.telegramId));
        setTelegramId(me?.telegramId ?? null);
      }
      if (!soft && res.telegram) {
        await refreshMeRef.current().catch(() => undefined);
      }
      setSyncedAt(new Date().toISOString());
      setError('');
      void loadTransactions();
      void loadBuyCoins();
    } catch {
      const msg = t('wallet.balanceStale');
      setError(msg);
      if (!soft) toastError(msg);
    } finally {
      setLoading(false);
      setSyncing(false);
      inFlightRef.current = false;
    }
  }, [loadBuyCoins, loadTransactions, toastError]);

  useEffect(() => {
    if (!token) return;
    void loadWallet({ soft: hasLocalRef.current });
  }, [token, loadWallet]);

  const balances: WalletBalances =
    wallet ?? (user ? user.wallet ?? walletFromUserFields(user) : { ton: 0, stars: 0, coins: 0, toman: 0 });

  const linked = telegramLinked || Boolean(user?.telegramId);
  const tgDisplay = telegramId || user?.telegramId || null;
  const statusText = error
    ? error
    : loading
      ? t('wallet.loadingBalance')
      : syncing
        ? 'در حال همگام‌سازی…'
        : '';

  async function onLinkTelegram() {
    if (!token) return;
    setLinkBusy(true);
    setLinkHint('');
    try {
      const res = await startTelegramAttach(token);
      if (res.alreadyLinked) {
        setTelegramLinked(true);
        setTelegramId(res.telegramId ?? null);
        const msg = 'حساب شما از قبل به تلگرام وصل است.';
        setLinkHint(msg); toastInfo(msg);
        await loadWallet({ soft: true });
        return;
      }
      const msg = 'ربات را باز کن، دکمه Start را بزن، بعد اینجا «همگام‌سازی» را بزن.';
      setLinkHint(msg); toastInfo(msg);
      window.open(res.deepLink, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ساخت لینک اتصال ناموفق بود';
      setLinkHint(msg); toastError(msg);
    } finally {
      setLinkBusy(false);
    }
  }

  async function onBuyPackage(pkg: CoinPackageDto) {
    if (!token) return;
    setBuyBusy(true);
    try {
      const res = await createCoinCardPayment(token, pkg.id);
      setActiveOrder(res.order); setCardInfo(res.card);
      toastInfo(res.message || 'سفارش ثبت شد — مبلغ را واریز و رسید را آپلود کن.');
      await loadBuyCoins();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'ثبت سفارش ناموفق بود');
      await loadBuyCoins();
    } finally { setBuyBusy(false); }
  }
  async function onUploadReceipt(file: File | null) {
    if (!token || !activeOrder || !file) return;
    setUploadBusy(true);
    try {
      const order = await uploadWalletPaymentReceipt(token, activeOrder.id, file, transferRef || undefined);
      setActiveOrder(order);
      toastSuccess('رسید ثبت شد — پس از تأیید ادمین سکه واریز می‌شود.');
      await loadBuyCoins();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'آپلود ناموفق بود');
    } finally {
      setUploadBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="pepito-wallet-page pepito-wallet-page--folio">
      <header className="pepito-wallet-hero">
        <div className="pepito-wallet-hero-wash" aria-hidden />
        <div className="pepito-wallet-hero-orb pepito-wallet-hero-orb--a" aria-hidden />
        <div className="pepito-wallet-hero-orb pepito-wallet-hero-orb--b" aria-hidden />
        <div className="pepito-wallet-hero-inner">
          <p className="pepito-wallet-brand">
            <Wallet size={18} aria-hidden />
            {BRAND.displayName}
          </p>
          <h1>{t('wallet.title')}</h1>
          <p className="pepito-wallet-lead">{t('wallet.lead')}</p>
        </div>
      </header>

      <section
        className={`pepito-wallet-balances${loading && !wallet ? ' is-pending' : ''}`}
        aria-label={t('wallet.balances')}
      >
        <div className="pepito-wallet-folio">
          <div className="pepito-wallet-folio-top">
            <div className="pepito-wallet-folio-title">
              <span className="pepito-wallet-folio-mark" aria-hidden>
                <Wallet size={16} />
              </span>
              <div>
                <h2>{t('wallet.balances')}</h2>
                <p>چهار ارز فعال در پنل</p>
              </div>
            </div>
            <button
              type="button"
              className="pepito-wallet-folio-refresh"
              onClick={() => void loadWallet({ soft: true })}
              disabled={syncing || loading}
              aria-busy={syncing || loading}
              aria-label={t('wallet.syncBalances')}
            >
              <RefreshCw size={15} aria-hidden className={syncing ? 'pepito-spin' : undefined} />
              تازه کردن
            </button>
          </div>

          <div className="pepito-wallet-rail" role="list">
            {ORDER.map((key) => (
              <article
                key={key}
                role="listitem"
                className={`pepito-wallet-cell pepito-wallet-cell--${key}`}
                aria-live={key === 'stars' ? 'polite' : undefined}
              >
                <span className="pepito-wallet-cell-rail" aria-hidden />
                <div className="pepito-wallet-cell-head">
                  <p className="pepito-wallet-cell-label">{WALLET_CURRENCY_LABELS_FA[key]}</p>
                  <span className="pepito-wallet-cell-sym" aria-hidden>
                    {key === 'toman' ? '﷼' : WALLET_CURRENCY_SYMBOLS[key]}
                  </span>
                </div>
                <p className="pepito-wallet-cell-val">
                  {formatBal(balances[key])}
                  {key === 'toman' ? <span className="pepito-wallet-cell-unit"> ت</span> : null}
                </p>
                <p className="pepito-wallet-cell-note">{WALLET_CURRENCY_STATUS[key].noteFa}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {statusText ? (
        <p
          className={`pepito-wallet-status${error ? ' pepito-wallet-status--warn' : ''}`}
          aria-live="polite"
        >
          {statusText}
        </p>
      ) : (
        <p className="pepito-wallet-status pepito-wallet-status--idle" aria-live="polite">
          {'\u00a0'}
        </p>
      )}

      <section className="pepito-wallet-tg" aria-labelledby="wallet-tg-title">
        <div className="pepito-wallet-tg-head">
          <span className="pepito-wallet-tg-mark" aria-hidden>
            <Sparkles size={18} />
          </span>
          <div>
            <h2 id="wallet-tg-title">{t('wallet.starsTitle')}</h2>
            <p className="pepito-wallet-tg-lead">
              {t('wallet.starsLead')}
            </p>
          </div>
        </div>

        <div className="pepito-wallet-tg-body">
          {linked ? (
            <p className="pepito-wallet-tg-status">
              <span className="pepito-wallet-tg-dot" aria-hidden />
              متصل به تلگرام
              {tgDisplay ? (
                <span className="pepito-wallet-tg-id"> · شناسه {toPersianDigits(tgDisplay)}</span>
              ) : null}
            </p>
          ) : (
            <p className="pepito-wallet-tg-status pepito-wallet-tg-status--off">
              برای صدور فاکتور و پرداخت در تلگرام، اول حساب را وصل کن.
            </p>
          )}

          <div className="pepito-wallet-tg-actions">
            <div className="pepito-wallet-tg-slot pepito-wallet-tg-slot--secondary">
              {linked && topUpDeepLink ? (
                <a
                  className="pepito-btn button-1 pepito-wallet-tg-link"
                  href={topUpDeepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Sparkles size={16} aria-hidden />
                  {t('wallet.starsInvoice')}
                </a>
              ) : linked ? (
                <p className="pepito-wallet-tg-meta-inline">
                  در ربات /start wstars را بزن تا فاکتور Stars برایت ارسال شود.
                </p>
              ) : (
                <button
                  type="button"
                  className="pepito-btn button-1 pepito-wallet-tg-link"
                  onClick={() => void onLinkTelegram()}
                  disabled={linkBusy}
                >
                  <Link2 size={16} aria-hidden />
                  {linkBusy ? 'در حال ساخت لینک…' : 'اتصال / سینک تلگرام'}
                </button>
              )}
            </div>

            <div className="pepito-wallet-tg-slot pepito-wallet-tg-slot--action">
              <button
                type="button"
                className="pepito-btn button-2 pepito-wallet-tg-sync"
                onClick={() => void loadWallet({ soft: true })}
                disabled={syncing || loading}
                aria-busy={syncing || loading}
              >
                <RefreshCw size={16} aria-hidden className={syncing ? 'pepito-spin' : undefined} />
                {linked
                  ? syncing
                    ? 'در حال همگام‌سازی…'
                    : t('wallet.syncWallet')
                  : 'بعد از Start در ربات — همگام‌سازی'}
              </button>
            </div>
          </div>

          <p
            className={linked ? 'pepito-wallet-tg-meta' : 'pepito-wallet-tg-hint'}
            aria-live="polite"
          >
            {linked
              ? syncedAt
                ? 'بعد از پرداخت فاکتور در تلگرام، همگام‌سازی بزن تا ستارهٔ پنل تازه شود.'
                : '\u00a0'
              : linkHint || '\u00a0'}
          </p>
        </div>
      </section>

      <section className="pepito-wallet-tx" aria-labelledby="wallet-tx-title">
        <div className="pepito-wallet-tx-head">
          <span className="pepito-wallet-tx-mark" aria-hidden>
            <Receipt size={18} />
          </span>
          <div>
            <h2 id="wallet-tx-title">{t('wallet.txTitle')}</h2>
            <p className="pepito-wallet-tx-lead">کسر و واریز سکه و سایر ارزها — مشترک با ربات</p>
          </div>
        </div>

        {txError ? (
          <p className="pepito-wallet-tx-empty pepito-wallet-tx-empty--warn" role="status">
            {txError}
          </p>
        ) : null}

        {txLoading && !transactions.length ? (
          <p className="pepito-wallet-tx-empty" aria-live="polite">
            {t('wallet.loadingTx')}
          </p>
        ) : null}

        {!txLoading && !txError && !transactions.length ? (
          <p className="pepito-wallet-tx-empty" role="status">
            {t('wallet.emptyTx')}
          </p>
        ) : null}

        {transactions.length > 0 ? (
          <ul className="pepito-wallet-tx-list">
            {transactions.map((tx) => (
              <li key={tx.id} className={`pepito-wallet-tx-row pepito-wallet-tx-row--${tx.direction}`}>
                <div className="pepito-wallet-tx-main">
                  <p className="pepito-wallet-tx-label">{tx.labelFa || tx.reason}</p>
                  <p className="pepito-wallet-tx-meta">
                    {WALLET_CURRENCY_LABELS_FA[tx.currency]}
                    <span aria-hidden> · </span>
                    {formatTxDate(tx.createdAt)}
                  </p>
                </div>
                <p
                  className={`pepito-wallet-tx-delta pepito-wallet-tx-delta--${tx.direction}`}
                  aria-label={`${tx.direction === 'debit' ? 'کسر' : 'واریز'} ${formatDelta(tx)}`}
                >
                  {formatDelta(tx)}
                  <span className="pepito-wallet-tx-unit" aria-hidden>
                    {tx.currency === 'toman' ? ' ت' : ` ${WALLET_CURRENCY_SYMBOLS[tx.currency]}`}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="pepito-wallet-tg pepito-wallet-buy" aria-labelledby="wallet-buy-title">
        <div className="pepito-wallet-tg-head">
          <span className="pepito-wallet-tg-mark" aria-hidden><Receipt size={18} /></span>
          <div>
            <h2 id="wallet-buy-title">{t('wallet.cardTitle')}</h2>
            <p className="pepito-wallet-tg-lead">{t('wallet.cardLead')}</p>
          </div>
        </div>
        <div className="pepito-wallet-tg-body">
          {activeOrder ? (
            <div className="pepito-wallet-buy-active">
              <p>سفارش فعال: <strong dir="ltr">#{activeOrder.id}</strong> · {toPersianDigits(activeOrder.coins)} سکه · {toPersianDigits(activeOrder.amountToman ?? 0)} تومان · {paymentStatusFa(activeOrder.status)}</p>
              {cardInfo ? (<><p dir="ltr">کارت: <strong>{cardInfo.grouped || cardInfo.number}</strong></p><p>به‌نام: <strong>{cardInfo.holder}</strong></p></>) : null}
              {activeOrder.status === 'awaiting_receipt' ? (
                <>
                  <label className="pepito-wallet-buy-ref"><span>شماره پیگیری (اختیاری)</span>
                    <input value={transferRef} onChange={(e) => setTransferRef(e.target.value)} placeholder="کد پیگیری بانک" dir="ltr" />
                  </label>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => void onUploadReceipt(e.target.files?.[0] ?? null)} />
                  <button type="button" className="pepito-btn button-1" disabled={uploadBusy} onClick={() => fileRef.current?.click()}>{uploadBusy ? 'در حال ارسال…' : 'آپلود عکس رسید'}</button>
                </>
              ) : (<p className="pepito-wallet-tg-meta">رسید ثبت شد — منتظر تأیید ادمین در پنل مالی.</p>)}
              {activeOrder.receiptUrl ? <img className="pepito-wallet-buy-receipt" src={resolvePublicMediaUrl(activeOrder.receiptUrl)} alt="رسید پرداخت" /> : null}
            </div>
          ) : (
            <ul className="pepito-wallet-buy-packages">
              {packages.map((pkg) => (
                <li key={pkg.id}>
                  <button type="button" className="pepito-wallet-buy-pkg" disabled={buyBusy} onClick={() => void onBuyPackage(pkg)}>
                    <strong>{pkg.label}</strong>
                    <span>{toPersianDigits(pkg.toman)} تومان · ⭐{toPersianDigits(pkg.stars)}</span>
                  </button>
                </li>
              ))}
              {!packages.length ? <li className="pepito-wallet-tg-meta">در حال بارگذاری بسته‌ها…</li> : null}
            </ul>
          )}
          {paymentHistory.length ? (
            <ul className="pepito-wallet-buy-history" aria-label="درخواست‌های کارت‌به‌کارت">
              {paymentHistory.slice(0, 6).map((o) => (
                <li key={o.id}><span dir="ltr">#{o.id}</span><span>{toPersianDigits(o.coins)} سکه · {paymentStatusFa(o.status)}</span><span>{formatTxDate(o.createdAt)}</span></li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <InviteFriendsCard variant="card" className="pepito-wallet-invite" />

      <div className="pepito-wallet-actions">
        <Link to="/wallet/earn" className="pepito-btn button-1">
          کسب درآمد / برداشت
        </Link>
        <Link to="/shop" className="pepito-btn button-2">
          رفتن به شاپ
        </Link>
        <Link to="/profile" className="pepito-btn button-2 pepito-wallet-back">
          <ArrowRight size={16} aria-hidden />
          پروفایل
        </Link>
      </div>
    </div>
  );
}
