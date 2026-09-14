import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { type ShopProduct } from '../../data/shopCatalog';
import { getSimilarProducts } from '../../lib/shopSimilarProducts';
import { useShopCatalogSync } from '../../hooks/useShopCatalogSync';
import { ShopProductCard } from './ShopProductCard';

/**
 * DigiKala-style «کالاهای مشابه» horizontal rail for shop PDP.
 * Placement: below trust badges + description tabs.
 */
export function ShopSimilarProducts({ product }: { product: ShopProduct }) {
  const { ready } = useShopCatalogSync();
  const items = useMemo(() => getSimilarProducts(product), [product, ready]);
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
    // Keep the chevron while any overflow remains (RTL scrollLeft sign varies by engine).
    const progressed = Math.abs(el.scrollLeft);
    setCanScrollMore(progressed < max - 8);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => updateScrollState();
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollState) : null;
    ro?.observe(el);
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro?.disconnect();
      window.removeEventListener('resize', updateScrollState);
    };
  }, [items.length, updateScrollState]);

  const scrollMore = () => {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.max(220, Math.round(el.clientWidth * 0.7));
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollBy({ left: rtl ? -amount : amount, behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  return (
    <section
      className="pd-dk-similar"
      aria-label="کالاهای مشابه"
      data-testid="shop-similar-products"
    >
      <header className="pd-dk-similar-head">
        <h2 className="pd-dk-similar-title">کالاهای مشابه</h2>
      </header>
      <div className="pd-dk-similar-frame">
        <div className="pd-dk-similar-track" ref={trackRef} tabIndex={0}>
          {items.map((p) => (
            <div key={p.id} className="pd-dk-similar-item">
              <ShopProductCard product={p} variant="similar" />
            </div>
          ))}
        </div>
        {canScrollMore ? (
          <button
            type="button"
            className="pd-dk-similar-next"
            aria-label="مشاهده کالاهای بیشتر"
            onClick={scrollMore}
          >
            <ChevronLeft size={20} aria-hidden />
          </button>
        ) : null}
      </div>
    </section>
  );
}
