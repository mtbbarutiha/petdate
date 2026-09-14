import { useRef, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  canLeft: boolean;
  canRight: boolean;
  onLeft: () => void;
  onRight: () => void;
  leftLabel: string;
  rightLabel: string;
  className?: string;
};

/**
 * Fire scroll on pointer/touch as well as click. On some mobile browsers a
 * parent scroll/gesture layer swallows the synthetic click after touchend.
 */
function useTouchSafeActivate(onActivate: () => void, disabled: boolean) {
  const armed = useRef(false);
  return {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      armed.current = true;
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
      if (!armed.current || disabled) return;
      armed.current = false;
      if (e.pointerType === 'mouse') return; // mouse uses onClick
      e.preventDefault();
      onActivate();
    },
    onPointerCancel: () => {
      armed.current = false;
    },
    onClick: () => {
      if (disabled) return;
      onActivate();
    },
  };
}

/**
 * Physical L/R controls for shop carousels.
 * Left chevron sits on the physical left and scrolls visual-left (RTL-safe).
 * Touch + click both work; native track swipe remains independent.
 */
export function ShopRailNavButtons({
  canLeft,
  canRight,
  onLeft,
  onRight,
  leftLabel,
  rightLabel,
  className,
}: Props) {
  const extra = className ? ` ${className}` : '';
  const left = useTouchSafeActivate(onLeft, !canLeft);
  const right = useTouchSafeActivate(onRight, !canRight);
  return (
    <>
      <button
        type="button"
        className={`pd-shop-rail-btn pd-shop-rail-btn--left${extra}`}
        aria-label={leftLabel}
        disabled={!canLeft}
        {...left}
      >
        <ChevronLeft size={20} aria-hidden />
      </button>
      <button
        type="button"
        className={`pd-shop-rail-btn pd-shop-rail-btn--right${extra}`}
        aria-label={rightLabel}
        disabled={!canRight}
        {...right}
      >
        <ChevronRight size={20} aria-hidden />
      </button>
    </>
  );
}
