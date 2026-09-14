import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
  className?: string;
};

/** Always-visible L/R controls for shop carousels (RTL: next is left). */
export function ShopRailNavButtons({
  canPrev,
  canNext,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  className,
}: Props) {
  return (
    <>
      <button
        type="button"
        className={`pd-shop-rail-btn pd-shop-rail-btn--next${className ? ` ${className}` : ''}`}
        aria-label={nextLabel}
        disabled={!canNext}
        onClick={onNext}
      >
        <ChevronLeft size={20} aria-hidden />
      </button>
      <button
        type="button"
        className={`pd-shop-rail-btn pd-shop-rail-btn--prev${className ? ` ${className}` : ''}`}
        aria-label={prevLabel}
        disabled={!canPrev}
        onClick={onPrev}
      >
        <ChevronRight size={20} aria-hidden />
      </button>
    </>
  );
}
