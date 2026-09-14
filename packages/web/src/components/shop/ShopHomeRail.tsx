import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import type { ShopProduct } from '../../data/shopCatalog';
import { ShopProductCard } from './ShopProductCard';

export type ShopHomeRailPill = {
  id: string;
  label: string;
};

type Props = {
  title: string;
  viewAllTo: string;
  pills: ShopHomeRailPill[];
  activePillId: string;
  onPillChange: (id: string) => void;
  products: ShopProduct[];
  /** Stable test id for the section root. */
  testId?: string;
  ariaLabel?: string;
};

/**
 * DigiKala-style shop-home rail: title + مشاهده همه + pill filters + product carousel.
 */
export function ShopHomeRail({
  title,
  viewAllTo,
  pills,
  activePillId,
  onPillChange,
  products,
  testId,
  ariaLabel,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollMore, setCanScrollMore] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) {
      setCanScrollMore(false);
      return;
    }
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 8) {
      setCanScrollMore(false);
      return;
    }
    const progressed = Math.abs(el.scrollLeft);
    setCanScrollMore(progressed < max - 8);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollState) : null;
    ro?.observe(el);
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro?.disconnect();
      window.removeEventListener('resize', updateScrollState);
    };
  }, [products.length, activePillId, updateScrollState]);

  const scrollMore = () => {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.max(220, Math.round(el.clientWidth * 0.7));
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollBy({ left: rtl ? -amount : amount, behavior: 'smooth' });
  };

  const pillButtons = useMemo(() => pills, [pills]);

  if (!products.length && !pillButtons.length) return null;

  return (
    <section
      className="pd-shop-home-rail"
      aria-label={ariaLabel ?? title}
      data-testid={testId}
    >
      <header className="pd-shop-home-rail-head">
        <h2 className="pd-shop-home-rail-title">{title}</h2>
        <Link to={viewAllTo} className="pd-shop-home-rail-all">
          مشاهده همه
          <ChevronLeft size={14} strokeWidth={2.4} aria-hidden />
        </Link>
      </header>

      {pillButtons.length > 0 ? (
        <div className="pd-shop-home-rail-pills" role="tablist" aria-label={title}>
          {pillButtons.map((pill) => {
            const active = pill.id === activePillId;
            return (
              <button
                key={pill.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`pd-shop-home-rail-pill${active ? ' is-active' : ''}`}
                onClick={() => {
                  // Toggle: re-clicking the active non-"all" pill clears to "all".
                  if (active && pill.id !== 'all') onPillChange('all');
                  else onPillChange(pill.id);
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="pd-shop-home-rail-frame">
        {products.length === 0 ? (
          <p className="pd-shop-home-rail-empty">محصولی در این دسته نیست.</p>
        ) : (
          <>
            <div className="pd-shop-home-rail-track" ref={trackRef} tabIndex={0}>
              {products.map((p) => (
                <div key={p.id} className="pd-shop-home-rail-item">
                  <ShopProductCard product={p} variant="similar" />
                </div>
              ))}
            </div>
            {canScrollMore ? (
              <button
                type="button"
                className="pd-shop-home-rail-next"
                aria-label="مشاهده محصولات بیشتر"
                onClick={scrollMore}
              >
                <ChevronLeft size={20} aria-hidden />
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
