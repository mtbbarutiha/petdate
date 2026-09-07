import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  WALLET_CURRENCY_LABELS_FA,
  WALLET_CURRENCY_STATUS,
  WALLET_CURRENCY_SYMBOLS,
  toPersianDigits,
  walletFromUserFields,
  type WalletBalances,
  type WalletCurrency,
} from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';

const ORDER: WalletCurrency[] = ['ton', 'stars', 'coins', 'toman'];

function formatBal(n: number): string {
  return toPersianDigits(new Intl.NumberFormat('en-US').format(Math.max(0, Math.floor(n))));
}

/**
 * Compact multi-currency wallet chip — sits beside the post-login profile avatar.
 */
export function WalletChip() {
  const { user, isLoggedIn } = useAuthStore();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer, { passive: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [open]);

  if (!isLoggedIn || !user) return null;

  const wallet: WalletBalances = user.wallet ?? walletFromUserFields(user);

  return (
    <div className="pepito-nav-wallet" ref={rootRef}>
      <button
        type="button"
        className="pepito-nav-wallet-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="کیف پول"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="pepito-nav-wallet-mark" aria-hidden>
          ◆
        </span>
        <span className="pepito-nav-wallet-chip-line">
          <span className="pepito-nav-wallet-chip-item" title={WALLET_CURRENCY_LABELS_FA.coins}>
            <span aria-hidden>{WALLET_CURRENCY_SYMBOLS.coins}</span>
            <span>{formatBal(wallet.coins)}</span>
          </span>
          <span className="pepito-nav-wallet-chip-sep" aria-hidden>
            ·
          </span>
          <span className="pepito-nav-wallet-chip-item" title="ستاره پنل پت‌دیت (خریداری‌شده)">
            <span aria-hidden>{WALLET_CURRENCY_SYMBOLS.stars}</span>
            <span>{formatBal(wallet.stars)}</span>
          </span>
          <span className="pepito-nav-wallet-chip-sep pepito-nav-wallet-chip-sep--toman" aria-hidden>
            ·
          </span>
          <span className="pepito-nav-wallet-chip-item pepito-nav-wallet-chip-item--toman" title={WALLET_CURRENCY_LABELS_FA.toman}>
            <span>{formatBal(wallet.toman)}</span>
            <span className="pepito-nav-wallet-chip-unit">ت</span>
          </span>
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          className="pepito-nav-wallet-panel"
          role="dialog"
          aria-label="موجودی کیف پول"
        >
          <div className="pepito-nav-wallet-panel-head">
            <p className="pepito-nav-wallet-panel-title">کیف پول</p>
            <p className="pepito-nav-wallet-panel-lead">موجودی چندارزی شما</p>
          </div>

          <ul className="pepito-nav-wallet-list">
            {ORDER.map((key) => (
              <li key={key} className="pepito-nav-wallet-row">
                <span className="pepito-nav-wallet-row-label">
                  <span className="pepito-nav-wallet-row-sym" aria-hidden>
                    {key === 'toman' ? '﷼' : WALLET_CURRENCY_SYMBOLS[key]}
                  </span>
                  {WALLET_CURRENCY_LABELS_FA[key]}
                </span>
                <span className="pepito-nav-wallet-row-val">
                  {formatBal(wallet[key])}
                  {key === 'toman' ? (
                    <span className="pepito-nav-wallet-row-unit"> تومان</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          <p className="pepito-nav-wallet-soon">به‌زودی واریز</p>
          <ul className="pepito-nav-wallet-notes">
            {ORDER.map((key) => (
              <li key={`n-${key}`}>
                <strong>{WALLET_CURRENCY_LABELS_FA[key]}:</strong>{' '}
                {WALLET_CURRENCY_STATUS[key].noteFa}
              </li>
            ))}
          </ul>
          <Link to="/wallet/earn" className="pepito-nav-wallet-page-link" onClick={() => setOpen(false)}>
            کسب درآمد / برداشت
          </Link>
          <Link to="/wallet" className="pepito-nav-wallet-page-link pepito-nav-wallet-page-link--ghost" onClick={() => setOpen(false)}>
            مشاهده کیف پول
          </Link>
        </div>
      ) : null}
    </div>
  );
}
