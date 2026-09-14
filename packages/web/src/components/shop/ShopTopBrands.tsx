import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../../i18n';
import { shopLabel } from '../../lib/shopLocale';
import { getTopBrands, type ShopBrand } from '../../data/shopCatalog';

type Props = {
  /** Override brands (tests / category pages). Defaults to featured top brands. */
  brands?: ShopBrand[];
  className?: string;
};

export function ShopTopBrands({ brands, className }: Props) {
  const { lang } = useI18n();
  const items = brands?.length ? brands : getTopBrands();
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) {
      setCanPrev(false);
      setCanNext(false);
      return;
    }
    const max = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft;
    const atStart = Math.abs(left) < 4;
    const atEnd = Math.abs(left) >= max - 4;
    setCanPrev(!atStart && max > 4);
    setCanNext(!atEnd && max > 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateArrows) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      ro?.disconnect();
    };
  }, [updateArrows, items.length]);

  const scrollByDir = (dir: 'next' | 'prev') => {
    const el = trackRef.current;
    if (!el) return;
    const delta = Math.max(180, Math.floor(el.clientWidth * 0.7));
    // RTL: "next" (more brands toward the left) decreases scrollLeft in Chromium.
    const sign = dir === 'next' ? -1 : 1;
    el.scrollBy({ left: sign * delta, behavior: 'smooth' });
  };

  if (!items.length) return null;

  return (
    <section
      className={`pd-shop-top-brands${className ? ` ${className}` : ''}`}
      aria-label="برندهای برتر"
    >
      <div className="pd-shop-top-brands-head">
        <h2>برندهای برتر</h2>
      </div>

      <div className="pd-shop-top-brands-rail">
        <div ref={trackRef} className="pd-shop-top-brands-track" role="list" tabIndex={0}>
          {items.map((b) => (
            <Link
              key={b.id}
              to={`/shop/c/all?brand=${encodeURIComponent(b.id)}`}
              className="pd-shop-top-brand"
              role="listitem"
              title={shopLabel(lang, b.labelFa, b.labelEn)}
            >
              <span className="pd-shop-top-brand-tile">
                <span className="pd-shop-top-brand-logo" aria-hidden={!b.logoUrl}>
                  {b.logoUrl ? (
                    <img src={b.logoUrl} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className="pd-shop-top-brand-fallback">
                      {(b.labelEn || b.labelFa).slice(0, 2)}
                    </span>
                  )}
                </span>
              </span>
              <span className="pd-shop-top-brand-name">
                {shopLabel(lang, b.labelFa, b.labelEn)}
              </span>
            </Link>
          ))}
        </div>

        {canNext ? (
          <button
            type="button"
            className="pd-shop-top-brands-arrow pd-shop-top-brands-arrow--next"
            aria-label="برندهای بیشتر"
            onClick={() => scrollByDir('next')}
          >
            <ChevronLeft size={18} strokeWidth={2.4} aria-hidden />
          </button>
        ) : null}
        {canPrev ? (
          <button
            type="button"
            className="pd-shop-top-brands-arrow pd-shop-top-brands-arrow--prev"
            aria-label="برندهای قبلی"
            onClick={() => scrollByDir('prev')}
          >
            <ChevronRight size={18} strokeWidth={2.4} aria-hidden />
          </button>
        ) : null}
      </div>
    </section>
  );
}
