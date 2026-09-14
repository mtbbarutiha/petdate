import { useMemo, useRef, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import type { ShopProduct } from '../../data/shopCatalog';
import { ShopProductCard } from './ShopProductCard';
import { ShopRailNavButtons } from './ShopRailNavButtons';
import { useShopRailNav } from './useShopRailNav';

/** Touch devices sometimes drop the synthetic click after a pan gesture parent. */
function useTouchSafePillActivate(onActivate: () => void) {
  const armed = useRef(false);
  return {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      armed.current = true;
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
      if (!armed.current) return;
      armed.current = false;
      if (e.pointerType === 'mouse') return;
      e.preventDefault();
      onActivate();
    },
    onPointerCancel: () => {
      armed.current = false;
    },
    onClick: () => {
      onActivate();
    },
  };
}

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
 * Native overflow scrollbar is hidden; L/R buttons drive scroll.
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
  const { trackRef, canLeft, canRight, scrollBySide } = useShopRailNav(
    `${activePillId}:${products.length}`
  );

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
          {pillButtons.map((pill) => (
            <ShopHomeRailPill
              key={pill.id}
              label={pill.label}
              active={pill.id === activePillId}
              onActivate={() => {
                // Toggle: re-clicking the active non-"all" pill clears to "all".
                if (pill.id === activePillId && pill.id !== 'all') onPillChange('all');
                else onPillChange(pill.id);
              }}
            />
          ))}
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
            <ShopRailNavButtons
              canLeft={canLeft}
              canRight={canRight}
              onLeft={() => scrollBySide('left')}
              onRight={() => scrollBySide('right')}
              leftLabel="مشاهده محصولات بیشتر"
              rightLabel="محصولات قبلی"
            />
          </>
        )}
      </div>
    </section>
  );
}

function ShopHomeRailPill({
  label,
  active,
  onActivate,
}: {
  label: string;
  active: boolean;
  onActivate: () => void;
}) {
  const handlers = useTouchSafePillActivate(onActivate);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`pd-shop-home-rail-pill${active ? ' is-active' : ''}`}
      {...handlers}
    >
      {label}
    </button>
  );
}
