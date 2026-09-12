import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Gift, Loader2, Lock, LockOpen, X } from 'lucide-react';

const GIFT_PRESETS = [1, 2, 5, 10, 20, 50] as const;

type GiftToolbarProps = {
  disabled?: boolean;
  secure?: boolean;
  onToggleSecure?: () => void;
  onOpenGift: () => void;
  showSecure?: boolean;
};

/** Playmate tools row — mirrors vet «نسخه» toolbar: هدیه (+ چت امن on mobile). */
export function PlaymateChatToolbar({
  disabled,
  secure,
  onToggleSecure,
  onOpenGift,
  showSecure = true,
}: GiftToolbarProps) {
  return (
    <div className="tg-vet-tools tg-playmate-tools" role="toolbar" aria-label="ابزار چت همبازی">
      <button
        type="button"
        className="tg-vet-tool-btn tg-vet-tool-btn--gift"
        disabled={disabled}
        onClick={onOpenGift}
        data-testid="playmate-gift-open"
      >
        <Gift size={16} aria-hidden />
        هدیه
      </button>
      {showSecure && onToggleSecure ? (
        <button
          type="button"
          className={`tg-vet-tool-btn tg-vet-tool-btn--secure${secure ? ' is-on' : ''}`}
          disabled={disabled}
          onClick={onToggleSecure}
          data-testid="playmate-secure-tool"
          aria-label={secure ? 'خاموش‌کردن چت امن' : 'فعال‌کردن چت امن'}
          title={secure ? 'چت امن فعال' : 'چت امن'}
        >
          {secure ? <Lock size={16} aria-hidden /> : <LockOpen size={16} aria-hidden />}
          چت امن
        </button>
      ) : null}
    </div>
  );
}

type GiftSheetProps = {
  open: boolean;
  onClose: () => void;
  balance: number;
  busy?: boolean;
  error?: string | null;
  onSend: (amount: number) => Promise<void> | void;
};

export function PlaymateGiftSheet({
  open,
  onClose,
  balance,
  busy,
  error,
  onSend,
}: GiftSheetProps) {
  const [amount, setAmount] = useState(5);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    if (!open) return;
    setAmount(5);
    setCustom('');
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const effective = useMemo(() => {
    const raw = custom.trim() ? Number(custom) : amount;
    return Math.floor(Number(raw));
  }, [amount, custom]);

  if (!open) return null;

  const canSend =
    Number.isFinite(effective) && effective >= 1 && effective <= 10_000 && effective <= balance;

  const sheet = (
    <div
      className="tg-vet-sheet-overlay"
      role="presentation"
      onClick={onClose}
      data-testid="playmate-gift-overlay"
    >
      <div
        className="tg-vet-sheet tg-gift-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="ارسال هدیه"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tg-vet-sheet-head">
          <h2>🎁 ارسال هدیه</h2>
          <button type="button" className="tg-vet-sheet-close" onClick={onClose} aria-label="بستن">
            <X size={20} />
          </button>
        </header>
        <div className="tg-gift-sheet-body">
          <p className="tg-gift-sheet-lead">
            از موجودی سکه‌ات به طرف مقابل هدیه بفرست. موجودی:{' '}
            <strong>{balance.toLocaleString('fa-IR')}</strong> سکه
          </p>
          <div className="tg-gift-presets" role="group" aria-label="مبالغ پیشنهادی">
            {GIFT_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                className={`tg-gift-preset${amount === n && !custom.trim() ? ' is-active' : ''}`}
                disabled={busy || n > balance}
                onClick={() => {
                  setAmount(n);
                  setCustom('');
                }}
              >
                {n.toLocaleString('fa-IR')}
              </button>
            ))}
          </div>
          <label className="tg-gift-custom">
            <span>مبلغ دلخواه</span>
            <input
              type="number"
              min={1}
              max={10000}
              inputMode="numeric"
              placeholder="مثلاً ۱۵"
              value={custom}
              disabled={busy}
              onChange={(e) => setCustom(e.target.value)}
            />
          </label>
          {error ? (
            <p className="tg-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className="tg-gift-send"
            disabled={busy || !canSend}
            onClick={() => void onSend(effective)}
            data-testid="playmate-gift-send"
          >
            {busy ? (
              <>
                <Loader2 size={16} className="tg-spin" aria-hidden /> در حال ارسال…
              </>
            ) : (
              <>ارسال {Number.isFinite(effective) ? effective.toLocaleString('fa-IR') : '—'} سکه</>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}

/** Animated gift bubble for playmate chat. */
export function ChatGiftBubble({ amount, mine }: { amount: number; mine?: boolean }) {
  return (
    <div className={`tg-gift-bubble${mine ? ' is-mine' : ' is-peer'}`} role="img" aria-label="هدیه">
      <span className="tg-gift-bubble-ico" aria-hidden>
        🎁
      </span>
      <span className="tg-gift-bubble-text">{mine ? 'هدیه فرستادی' : 'هدیه گرفتی'}</span>
      <strong className="tg-gift-bubble-amt">{amount.toLocaleString('fa-IR')} سکه</strong>
    </div>
  );
}
