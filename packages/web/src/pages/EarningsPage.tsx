import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Banknote, CircleAlert, Loader2, Wallet } from 'lucide-react';
import {
  BRAND,
  COIN_SELL_STATUS_LABELS_FA,
  WITHDRAW_CURRENCY_LABELS_FA,
  formatCardGrouped,
  formatPersianDateTime,
  toEnglishDigits,
  toPersianDigits,
  validateIranCard,
  type WithdrawCurrency,
} from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import {
  fetchEarnStatus,
  invalidateAuthGetCache,
  submitEarnWithdraw,
  type EarnCurrencyOption,
  type EarnRequestSummary,
  type EarnStatusResponse,
  type EarnWithdrawCurrency,
} from '../lib/api';

function formatFaInt(n: number): string {
  return toPersianDigits(new Intl.NumberFormat('en-US').format(Math.max(0, Math.floor(n))));
}

function formatFaToman(n: number): string {
  return `${formatFaInt(n)} تومان`;
}

function currencyUnitFa(currency: WithdrawCurrency | string | null | undefined): string {
  const key = (currency || 'coins') as WithdrawCurrency;
  return WITHDRAW_CURRENCY_LABELS_FA[key] ?? 'سکه';
}

/**
 * درخواست برداشت چندارزی — کاربر ارز را انتخاب می‌کند (سکه / ستاره / تومان).
 * Route auth-gated via AuthGuard (same as /wallet).
 */
export function EarningsPage() {
  const { token, refreshMe } = useAuthStore();
  const [data, setData] = useState<EarnStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currency, setCurrency] = useState<EarnWithdrawCurrency>('coins');
  const [amountInput, setAmountInput] = useState('');
  const [cardInput, setCardInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [formError, setFormError] = useState('');

  const currencies: EarnCurrencyOption[] = useMemo(() => {
    if (data?.currencies?.length) return data.currencies;
    if (!data) return [];
    return [
      {
        currency: 'coins',
        labelFa: WITHDRAW_CURRENCY_LABELS_FA.coins,
        balance: data.coins,
        rateToman: data.rateToman,
        minAmount: data.minCoins,
        estimatedToman: data.estimatedToman,
        canWithdraw: data.canSell,
      },
    ];
  }, [data]);

  const selected = currencies.find((c) => c.currency === currency) ?? currencies[0] ?? null;

  const applyStatus = useCallback((res: EarnStatusResponse, prefer?: EarnWithdrawCurrency) => {
    setData(res);
    const opts: EarnCurrencyOption[] = res.currencies?.length
      ? res.currencies
      : [
          {
            currency: 'coins',
            labelFa: WITHDRAW_CURRENCY_LABELS_FA.coins,
            balance: res.coins,
            rateToman: res.rateToman,
            minAmount: res.minCoins,
            estimatedToman: res.estimatedToman,
            canWithdraw: res.canSell,
          },
        ];
    const preferred =
      (prefer ? opts.find((c) => c.currency === prefer) : undefined) ??
      opts.find((c) => c.canWithdraw) ??
      opts.find((c) => c.balance > 0) ??
      opts[0]!;
    setCurrency(preferred.currency);
    setAmountInput(
      String(preferred.balance >= preferred.minAmount ? preferred.balance : preferred.minAmount)
    );
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchEarnStatus(token);
      applyStatus(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری ناموفق بود');
    } finally {
      setLoading(false);
    }
  }, [token, applyStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const amountNum = useMemo(() => {
    const n = Math.floor(Number(toEnglishDigits(amountInput).replace(/[^\d]/g, '')) || 0);
    return Number.isFinite(n) ? n : 0;
  }, [amountInput]);

  const previewToman = selected ? amountNum * selected.rateToman : 0;
  const pending = Boolean(data?.hasOpenRequest);
  const unit = currencyUnitFa(selected?.currency ?? currency);
  const canSubmit =
    Boolean(selected?.canWithdraw) &&
    amountNum >= (selected?.minAmount ?? 50) &&
    amountNum <= (selected?.balance ?? 0) &&
    !submitting &&
    !pending;

  function onCurrencyChange(next: EarnWithdrawCurrency) {
    setCurrency(next);
    setFormError('');
    setSuccess('');
    const opt = currencies.find((c) => c.currency === next);
    if (opt) {
      setAmountInput(String(opt.balance >= opt.minAmount ? opt.balance : opt.minAmount));
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !data || !selected) return;
    setFormError('');
    setSuccess('');

    if (pending) {
      setFormError('یک درخواست تسویه باز داری — تا بررسی ادمین صبر کن.');
      return;
    }
    if (amountNum < selected.minAmount) {
      setFormError(`حداقل ${formatFaInt(selected.minAmount)} ${unit} لازم است.`);
      return;
    }
    if (amountNum > selected.balance) {
      setFormError(`موجودی ${unit} کافی نیست.`);
      return;
    }
    const cardCheck = validateIranCard(cardInput);
    if (!cardCheck.ok) {
      setFormError(
        cardCheck.reason === 'luhn'
          ? 'شماره کارت معتبر نیست (چک رقم). ۱۶ رقم را دوباره وارد کن.'
          : 'شماره کارت ۱۶ رقمی بانکی ایران را درست وارد کن.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitEarnWithdraw(token, {
        currency: selected.currency,
        amount: amountNum,
        coins: amountNum,
        cardNumber: cardCheck.card,
      });
      invalidateAuthGetCache(token);
      await refreshMe().catch(() => undefined);
      setSuccess(
        `درخواست #${toPersianDigits(res.requestId)} ثبت شد · ${formatFaInt(res.amount ?? res.coins)} ${currencyUnitFa(res.currency)} رزرو · ${formatFaToman(res.amountToman)}`
      );
      setCardInput('');
      const fresh = await fetchEarnStatus(token);
      applyStatus(fresh, selected.currency);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'ثبت درخواست ناموفق بود');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pepito-earn-page">
      <header className="pepito-earn-hero">
        <div className="pepito-earn-hero-wash" aria-hidden />
        <div className="pepito-earn-hero-inner">
          <p className="pepito-kicker pepito-earn-kicker">
            <span className="pepito-kicker-dot" aria-hidden>
              <Banknote size={16} />
            </span>
            {BRAND.displayNameFa}
          </p>
          <h1>درخواست برداشت</h1>
          <p className="pepito-earn-lead">
            ارز را انتخاب کن و موجودی را به کارت بانکی ایران برداشت کن — همان صف بررسی ادمین وب و ربات
          </p>
        </div>
      </header>

      {loading && !data ? (
        <p className="pepito-earn-status" aria-live="polite">
          <Loader2 size={16} className="pepito-spin" aria-hidden />
          در حال بارگذاری…
        </p>
      ) : null}

      {error ? (
        <p className="pepito-earn-status pepito-earn-status--warn" role="alert">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <section className="pepito-earn-balance" aria-label="موجودی کیف پول">
            <div className="pepito-earn-balance-main">
              <span className="pepito-earn-balance-label">
                موجودی {selected ? selected.labelFa : 'سکه'}
              </span>
              <p className="pepito-earn-balance-val">
                <span aria-hidden>
                  {selected?.currency === 'stars'
                    ? '⭐'
                    : selected?.currency === 'toman'
                      ? '💳'
                      : '🪙'}
                </span>
                {formatFaInt(selected?.balance ?? data.coins)}
              </p>
              <p className="pepito-earn-balance-note">
                ارزش تقریبی ≈ {formatFaToman(selected?.estimatedToman ?? data.estimatedToman)}
              </p>
            </div>
            <ul className="pepito-earn-meta" aria-label="شرایط برداشت">
              <li>
                <strong>نرخ تبدیل</strong>
                <span>
                  هر {unit} {formatFaInt(selected?.rateToman ?? data.rateToman)} تومان
                </span>
              </li>
              <li>
                <strong>حداقل برداشت</strong>
                <span>
                  {formatFaInt(selected?.minAmount ?? data.minCoins)} {unit}
                </span>
              </li>
              <li>
                <strong>روش پرداخت</strong>
                <span>{data.methodLabelFa}</span>
              </li>
            </ul>
          </section>

          <section className="pepito-earn-how" aria-labelledby="earn-how-title">
            <h2 id="earn-how-title">فرآیند برداشت</h2>
            <ol>
              <li>ارز موردنظر (سکه، ستاره یا تومان کیف‌پول) را انتخاب کن.</li>
              <li>
                مقدار (حداقل {formatFaInt(selected?.minAmount ?? data.minCoins)} {unit}) و شماره کارت
                بانکی ایران را وارد کن.
              </li>
              <li>موجودی تا تأیید ادمین رزرو می‌شود؛ پس از بررسی، مبلغ تومان به کارت واریز می‌شود.</li>
            </ol>
          </section>

          {pending && data.openRequest ? (
            <section className="pepito-earn-pending" role="status" aria-live="polite">
              <CircleAlert size={18} aria-hidden />
              <div>
                <h2>درخواست باز</h2>
                <p>
                  #{toPersianDigits(data.openRequest.id)} · {formatFaInt(data.openRequest.coins)}{' '}
                  {currencyUnitFa(data.openRequest.currency)} ·{' '}
                  {formatFaToman(data.openRequest.amountToman)}
                </p>
                <p className="pepito-earn-pending-card">
                  کارت {toPersianDigits(data.openRequest.cardMasked)} ·{' '}
                  {COIN_SELL_STATUS_LABELS_FA[data.openRequest.status]}
                </p>
                <p className="pepito-earn-pending-hint">
                  تا بررسی ادمین نمی‌توانی درخواست جدید ثبت کنی.
                </p>
              </div>
            </section>
          ) : null}

          <section className="pepito-earn-form-wrap" aria-labelledby="earn-form-title">
            <h2 id="earn-form-title">ثبت درخواست برداشت</h2>
            <form className="pepito-earn-form" onSubmit={(e) => void onSubmit(e)}>
              <fieldset
                className="pepito-earn-field pepito-earn-currency"
                disabled={pending || submitting}
              >
                <legend>ارز برداشت</legend>
                <div
                  className="pepito-earn-currency-options"
                  role="radiogroup"
                  aria-label="ارز برداشت"
                >
                  {currencies.map((opt) => (
                    <label key={opt.currency} className="pepito-earn-currency-option">
                      <input
                        type="radio"
                        name="withdraw-currency"
                        value={opt.currency}
                        checked={currency === opt.currency}
                        onChange={() => onCurrencyChange(opt.currency)}
                      />
                      <span>
                        {opt.labelFa}
                        <small>
                          {formatFaInt(opt.balance)} · حداقل {formatFaInt(opt.minAmount)}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="pepito-earn-field">
                <span>مقدار ({unit})</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  disabled={pending || submitting}
                  placeholder={formatFaInt(selected?.minAmount ?? data.minCoins)}
                />
              </label>
              <p className="pepito-earn-preview">
                مبلغ پرداختی ≈ <strong>{formatFaToman(previewToman)}</strong>
                {amountNum > 0 && selected && amountNum < selected.minAmount ? (
                  <span className="pepito-earn-preview-warn"> (کمتر از حداقل)</span>
                ) : null}
              </p>
              <label className="pepito-earn-field">
                <span>شماره کارت بانکی (۱۶ رقم)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={cardInput}
                  onChange={(e) => setCardInput(formatCardGrouped(e.target.value))}
                  disabled={pending || submitting}
                  placeholder="6037-****-****-****"
                  maxLength={19}
                />
              </label>
              <p className="pepito-earn-field-hint">
                فقط رقم؛ فاصله یا خط تیره مجاز است. کارت بانکی ایران.
              </p>

              {formError ? (
                <p className="pepito-earn-form-error" role="alert">
                  {formError}
                </p>
              ) : null}
              {success ? (
                <p className="pepito-earn-form-ok" role="status">
                  {success}
                </p>
              ) : null}

              <button
                type="submit"
                className="pepito-btn button-1 pepito-earn-submit"
                disabled={!canSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="pepito-spin" aria-hidden />
                    در حال ثبت…
                  </>
                ) : (
                  'ثبت درخواست برداشت'
                )}
              </button>
            </form>
          </section>

          <EarnHistory requests={data.requests} />
        </>
      ) : null}

      <div className="pepito-earn-actions">
        <Link to="/wallet" className="pepito-btn button-2">
          <Wallet size={16} aria-hidden />
          کیف پول
        </Link>
        <Link to="/profile" className="pepito-btn button-2 pepito-earn-back">
          <ArrowRight size={16} aria-hidden />
          پروفایل
        </Link>
      </div>
    </div>
  );
}

function EarnHistory({ requests }: { requests: EarnRequestSummary[] }) {
  if (!requests.length) return null;
  return (
    <section className="pepito-earn-history" aria-labelledby="earn-history-title">
      <h2 id="earn-history-title">درخواست‌های اخیر</h2>
      <ul>
        {requests.map((r) => (
          <li
            key={r.id}
            className={`pepito-earn-history-item pepito-earn-history-item--${r.status}`}
          >
            <div className="pepito-earn-history-top">
              <strong>#{toPersianDigits(r.id)}</strong>
              <span className="pepito-earn-history-status">
                {COIN_SELL_STATUS_LABELS_FA[r.status]}
              </span>
            </div>
            <p>
              {formatFaInt(r.coins)} {currencyUnitFa(r.currency)} · {formatFaToman(r.amountToman)}
            </p>
            <p className="pepito-earn-history-meta">
              {toPersianDigits(r.cardMasked)} · {formatPersianDateTime(r.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
