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
 * Physical L/R controls for shop carousels.
 * Left chevron sits on the physical left and scrolls visual-left (RTL-safe).
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
  return (
    <>
      <button
        type="button"
        className={`pd-shop-rail-btn pd-shop-rail-btn--left${extra}`}
        aria-label={leftLabel}
        disabled={!canLeft}
        onClick={onLeft}
      >
        <ChevronLeft size={20} aria-hidden />
      </button>
      <button
        type="button"
        className={`pd-shop-rail-btn pd-shop-rail-btn--right${extra}`}
        aria-label={rightLabel}
        disabled={!canRight}
        onClick={onRight}
      >
        <ChevronRight size={20} aria-hidden />
      </button>
    </>
  );
}
