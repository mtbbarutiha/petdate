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
import { useAuthStore } from '../hooks/useAuthStore';
import {
  fetchWallet,
  fetchWalletTransactions,
  startTelegramAttach,
  type WalletTransactionDto,
} from '../lib/api';

const ORDER: WalletCurrency[] = ['coins', 'stars', 'toman', 'ton'];
const HERO: WalletCurrency[] = ['coins', 'stars'];

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

/**
 * Dedicated wallet page — multi-currency balances (same source as WalletChip).
 * Includes Telegram attach + Stars sync (bot wallet_stars, not Telegram Payment API).
 * Route is auth-gated via AuthGuard; landing dock sends guests through login?next=/wallet.
 *
 * Layout stability: soft refresh updates state in place (no remount), TG body uses a
 * fixed slot grid so linked/unlinked swaps cannot shift the page, and fetch runs once
 * per token (not on every loadWallet identity change).
 */
export function WalletPage() {
  const { user, token, refreshMe } = useAuthStore();
  const [wallet, setWallet] = useState<WalletBalances | null>(null);
  const [telegramLinked, setTelegramLinked] = useState<boolean>(() => Boolean(user?.telegramId));
  const [telegramId, setTelegramId] = useState<string | null>(user?.telegramId ?? null);
  const [telegramStarsMeta, setTelegramStarsMeta] = useState<{
    nativeReadable: boolean;
    reasonFa: string;
    topUpDeepLink: string | null;
    viewStarsDeepLink: string | null;
    connectBusinessDeepLink: string | null;
    telegramAccountLabelFa: string;
    petdateLabelFa: string;
    petdateBalance: number;
    telegramAccountBalance: number | null;
    businessConnected: boolean;
    businessCanViewStars: boolean;
    botBusinessReady: boolean;
    syncErrorFa: string | null;
  } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(() => !user);
  const [syncing, setSyncing] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkHint, setLinkHint] = useState('');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionDto[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState('');
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
      setTxError('نتوانستیم تراکنش‌ها را بارگذاری کنیم.');
    } finally {
      setTxLoading(false);
    }
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
      if (res.telegramStars) {
        const tgBal =
          res.telegramStars.telegramAccountBalance ?? res.telegramStars.nativeBalance ?? null;
        setTelegramStarsMeta({
          nativeReadable: Boolean(res.telegramStars.nativeReadable),
          reasonFa: res.telegramStars.reasonFa,
          topUpDeepLink: res.telegramStars.topUpDeepLink,
          viewStarsDeepLink:
            res.telegramStars.viewStarsDeepLink ||
            res.telegramStars.viewStarsHttpsHint ||
            'tg://stars',
          connectBusinessDeepLink: res.telegramStars.connectBusinessDeepLink || 'tg://settings/business',
          telegramAccountLabelFa:
            res.telegramStars.telegramAccountLabelFa || 'موجودی Stars شما در تلگرام',
          petdateLabelFa:
            res.telegramStars.petdateLabelFa || 'موجودی ستاره پنل پت‌دیت (خریداری‌شده)',
          petdateBalance: Math.max(
            0,
            Math.floor(
              Number(res.telegramStars.petdateBalance ?? res.telegramStars.walletStars ?? res.wallet.stars) || 0
            )
          ),
          telegramAccountBalance:
            tgBal != null && Number.isFinite(Number(tgBal)) ? Math.max(0, Math.floor(Number(tgBal))) : null,
          businessConnected: Boolean(res.telegramStars.businessConnected),
          businessCanViewStars: Boolean(res.telegramStars.businessCanViewStars),
          botBusinessReady: Boolean(res.telegramStars.botBusinessReady),
          syncErrorFa: res.telegramStars.syncErrorFa ?? null,
        });
      }
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
    } catch {
      setError('نتوانستیم موجودی را از سرور تازه کنیم؛ آخرین موجودی محلی نمایش داده شد.');
    } finally {
      setLoading(false);
      setSyncing(false);
      inFlightRef.current = false;
    }
  }, [loadTransactions]);

  useEffect(() => {
    if (!token) return;
    void loadWallet({ soft: hasLocalRef.current });
  }, [token, loadWallet]);

  const balances: WalletBalances =
    wallet ?? (user ? user.wallet ?? walletFromUserFields(user) : { ton: 0, stars: 0, coins: 0, toman: 0 });
  const starsCount = Math.max(0, Math.floor(Number(balances.stars) || 0));
  const coinsCount = Math.max(0, Math.floor(Number(balances.coins) || 0));

  const linked = telegramLinked || Boolean(user?.telegramId);
  const tgDisplay = telegramId || user?.telegramId || null;
  const statusText = error
    ? error
    : loading
      ? 'در حال بارگذاری موجودی…'
      : syncing
        ? 'در حال همگام‌سازی…'
        : '\u00a0';

  async function onLinkTelegram() {
    if (!token) return;
    setLinkBusy(true);
    setLinkHint('');
    try {
      const res = await startTelegramAttach(token);
      if (res.alreadyLinked) {
        setTelegramLinked(true);
        setTelegramId(res.telegramId ?? null);
        setLinkHint('حساب شما از قبل به تلگرام وصل است.');
        await loadWallet({ soft: true });
        return;
      }
      setLinkHint('ربات را باز کن، دکمه Start را بزن، بعد اینجا «همگام‌سازی» را بزن.');
      window.open(res.deepLink, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ساخت لینک اتصال ناموفق بود';
      setLinkHint(msg);
    } finally {
      setLinkBusy(false);
    }
  }

  const secondary = ORDER.filter((k) => !HERO.includes(k));

  return (
    <div className="pepito-wallet-page">
      <header className="pepito-wallet-hero">
        <div className="pepito-wallet-hero-wash" aria-hidden />
        <div className="pepito-wallet-hero-inner">
          <p className="pepito-kicker pepito-wallet-kicker">
            <span className="pepito-kicker-dot" aria-hidden>
              <Wallet size={16} />
            </span>
            {BRAND.displayName}
          </p>
          <h1>کیف پول</h1>
          <p className="pepito-wallet-lead">موجودی چندارزی — مشترک بین وب و ربات تلگرام</p>
        </div>
      </header>

      <section
        className={`pepito-wallet-featured pepito-wallet-featured--dual${loading && !wallet ? ' is-pending' : ''}`}
        aria-label="موجودی اصلی"
      >
        <div className="pepito-wallet-featured-main pepito-wallet-featured-main--coins">
          <span className="pepito-wallet-featured-label">{WALLET_CURRENCY_LABELS_FA.coins}</span>
          <p className="pepito-wallet-featured-val">
            <span aria-hidden>{WALLET_CURRENCY_SYMBOLS.coins}</span>
            {formatBal(coinsCount)}
          </p>
          <p className="pepito-wallet-featured-note">{WALLET_CURRENCY_STATUS.coins.noteFa}</p>
        </div>
        <div className="pepito-wallet-featured-main pepito-wallet-featured-main--stars" aria-live="polite">
          <span className="pepito-wallet-featured-label">ستاره پنل پت‌دیت</span>
          <p className="pepito-wallet-featured-val">
            <span aria-hidden>{WALLET_CURRENCY_SYMBOLS.stars}</span>
            {formatBal(telegramStarsMeta?.petdateBalance ?? starsCount)}
          </p>
          <p className="pepito-wallet-featured-unit">خریداری‌شده در پنل</p>
          <p className="pepito-wallet-featured-note">{WALLET_CURRENCY_STATUS.stars.noteFa}</p>
        </div>
        <ul className="pepito-wallet-featured-side" aria-label="سایر موجودی‌ها">
          {secondary.map((key) => (
            <li key={key} className={`pepito-wallet-mini pepito-wallet-mini--${key}`}>
              <span className="pepito-wallet-mini-sym" aria-hidden>
                {key === 'toman' ? '﷼' : WALLET_CURRENCY_SYMBOLS[key]}
              </span>
              <div>
                <p className="pepito-wallet-mini-label">{WALLET_CURRENCY_LABELS_FA[key]}</p>
                <p className="pepito-wallet-mini-val">
                  {formatBal(balances[key])}
                  {key === 'toman' ? <span className="pepito-wallet-row-unit"> ت</span> : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p
        className={`pepito-wallet-status${error ? ' pepito-wallet-status--warn' : ''}`}
        aria-live="polite"
      >
        {statusText}
      </p>

      <section className="pepito-wallet-tg" aria-labelledby="wallet-tg-title">
        <div className="pepito-wallet-tg-head">
          <span className="pepito-wallet-tg-mark" aria-hidden>
            <Sparkles size={18} />
          </span>
          <div>
            <h2 id="wallet-tg-title">ستاره‌ها — تلگرام و پنل پت‌دیت</h2>
            <p className="pepito-wallet-tg-lead">
              {telegramStarsMeta?.reasonFa ||
                'موجودی Stars حساب تلگرام جدا از ستاره خریداری‌شده در پنل پت‌دیت است.'}
            </p>
          </div>
        </div>

        <div className="pepito-wallet-tg-body">
          <div className="pepito-wallet-stars-split" role="group" aria-label="دو نوع موجودی ستاره">
            <p className="pepito-wallet-tg-stars pepito-wallet-tg-stars--hero pepito-wallet-tg-stars--panel">
              <span className="pepito-wallet-tg-stars-badge" aria-hidden>
                ⭐
              </span>
              <span className="pepito-wallet-tg-stars-copy">
                <span className="pepito-wallet-tg-stars-label">
                  {telegramStarsMeta?.petdateLabelFa || 'موجودی ستاره پنل پت‌دیت (خریداری‌شده)'}
                </span>
                <strong className="pepito-wallet-tg-stars-val">
                  {formatBal(telegramStarsMeta?.petdateBalance ?? starsCount)}
                  <span className="pepito-wallet-tg-stars-unit"> ستاره</span>
                </strong>
              </span>
            </p>
            <p className="pepito-wallet-tg-stars pepito-wallet-tg-stars--hero pepito-wallet-tg-stars--telegram">
              <span className="pepito-wallet-tg-stars-badge" aria-hidden>
                📱
              </span>
              <span className="pepito-wallet-tg-stars-copy">
                <span className="pepito-wallet-tg-stars-label">
                  {telegramStarsMeta?.telegramAccountLabelFa || 'موجودی Stars شما در تلگرام'}
                </span>
                {telegramStarsMeta?.nativeReadable && telegramStarsMeta.telegramAccountBalance != null ? (
                  <strong className="pepito-wallet-tg-stars-val">
                    {formatBal(telegramStarsMeta.telegramAccountBalance)}
                    <span className="pepito-wallet-tg-stars-unit"> ستاره</span>
                  </strong>
                ) : linked && telegramStarsMeta?.connectBusinessDeepLink ? (
                  <a
                    className="pepito-wallet-tg-stars-val pepito-wallet-tg-stars-open"
                    href={telegramStarsMeta.connectBusinessDeepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    اتصال Business برای خواندن عدد
                  </a>
                ) : (
                  <strong className="pepito-wallet-tg-stars-val pepito-wallet-tg-stars-val--muted">
                    بعد از اتصال
                  </strong>
                )}
                <span className="pepito-wallet-tg-stars-hint">
                  {telegramStarsMeta?.syncErrorFa ||
                    (telegramStarsMeta?.nativeReadable
                      ? 'از تلگرام با اجازهٔ Business خوانده شد.'
                      : 'با اتصال Business و دسترسی Gifts and Stars، عدد اینجا نشان داده می‌شود.')}
                </span>
              </span>
            </p>
          </div>

          {linked ? (
            <p className="pepito-wallet-tg-status">
              <span className="pepito-wallet-tg-dot" aria-hidden />
              متصل به تلگرام — پرداخت Stars فعال
              {tgDisplay ? (
                <span className="pepito-wallet-tg-id"> · شناسه {toPersianDigits(tgDisplay)}</span>
              ) : null}
            </p>
          ) : (
            <p className="pepito-wallet-tg-status pepito-wallet-tg-status--off">
              برای پرداخت با Stars واقعی تلگرام، اول حساب را سینک کن.
            </p>
          )}

          <div className="pepito-wallet-tg-slot pepito-wallet-tg-slot--secondary">
            {linked && telegramStarsMeta?.topUpDeepLink ? (
              <a
                className="pepito-btn button-1 pepito-wallet-tg-link"
                href={telegramStarsMeta.topUpDeepLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Sparkles size={16} aria-hidden />
                شارژ ستاره پنل با Stars تلگرام
              </a>
            ) : linked ? (
              <p className="pepito-wallet-tg-meta-inline">
                از ربات /start wstars برای شارژ پنل با فاکتور تلگرام استفاده کن.
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
                  : 'همگام‌سازی کیف‌پول'
                : 'بعد از Start در ربات — همگام‌سازی'}
            </button>
          </div>

          <p
            className={linked ? 'pepito-wallet-tg-meta' : 'pepito-wallet-tg-hint'}
            aria-live="polite"
          >
            {linked
              ? syncedAt
                ? telegramStarsMeta?.nativeReadable
                  ? 'همگام‌سازی: ستارهٔ پنل و Stars تلگرام تازه شدند.'
                  : 'همگام‌سازی: ستارهٔ پنل تازه شد. برای عدد Stars تلگرام Business را وصل کن.'
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
            <h2 id="wallet-tx-title">تراکنش‌ها</h2>
            <p className="pepito-wallet-tx-lead">کسر و واریز سکه و سایر ارزها</p>
          </div>
        </div>

        {txError ? (
          <p className="pepito-wallet-tx-empty pepito-wallet-tx-empty--warn" role="status">
            {txError}
          </p>
        ) : null}

        {txLoading && !transactions.length ? (
          <p className="pepito-wallet-tx-empty" aria-live="polite">
            در حال بارگذاری تراکنش‌ها…
          </p>
        ) : null}

        {!txLoading && !txError && !transactions.length ? (
          <p className="pepito-wallet-tx-empty" role="status">
            هنوز تراکنشی ثبت نشده. از این به بعد کسر و واریزها اینجا دیده می‌شوند.
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

      <p className="pepito-wallet-soon">به‌زودی واریز مستقیم از وب</p>

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
