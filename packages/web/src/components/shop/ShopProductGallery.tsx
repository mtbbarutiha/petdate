import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, LayoutGrid, X } from 'lucide-react';
import { BADGE_LABELS } from '../../data/shopCatalog';
import { useDialogFocusTrap } from '../../hooks/useDialogFocusTrap';
import { shopGalleryPointerIntent, stepShopGalleryIndex } from '../../lib/shopGalleryNav';

type Props = {
  gallery: string[];
  cover: string;
  alt: string;
  badge?: keyof typeof BADGE_LABELS;
  discount?: number | null;
};

export function ShopProductGallery({ gallery, cover, alt, badge, discount }: Props) {
  const slides = gallery.length ? gallery : cover ? [cover] : [];
  const multi = slides.length > 1;
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);
  const index = Math.min(active, Math.max(slides.length - 1, 0));
  const mainSrc = slides[index] ?? cover;
  const drag = useRef<{ x: number } | null>(null);
  const suppressClick = useRef(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useDialogFocusTrap({
    active: lightbox,
    panelRef,
    onDismiss: () => {
      setGridOpen(false);
      setLightbox(false);
    },
  });

  const go = (delta: number) => {
    if (!multi) return;
    setActive((i) => stepShopGalleryIndex(i, slides.length, delta));
  };

  const openLightbox = () => {
    setGridOpen(false);
    setLightbox(true);
  };

  const closeLightbox = () => {
    setGridOpen(false);
    setLightbox(false);
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button != null && e.button !== 0) return;
    drag.current = { x: e.clientX };
  };
  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    const intent = shopGalleryPointerIntent(e.clientX - start.x, multi);
    if (intent === 'open') return;
    suppressClick.current = true;
    go(intent === 'next' ? 1 : -1);
  };

  const onMainClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.preventDefault();
      return;
    }
    openLightbox();
  };

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (gridOpen) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox, gridOpen, multi, slides.length]);

  if (!slides.length) return null;

  return (
    <div className="pd-dk-gallery">
      <div className="pd-dk-gallery-main">
        <button
          type="button"
          className="pd-dk-gallery-viewport"
          data-testid="shop-product-gallery-main"
          aria-label="نمایش تصویر در اندازه بزرگ"
          onClick={onMainClick}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              go(1);
            }
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              go(-1);
            }
          }}
        >
          <div
            className={`pd-dk-gallery-track${multi ? ' is-slider' : ''}`}
            dir="ltr"
            style={multi ? { transform: `translateX(${-index * 100}%)` } : undefined}
          >
            {slides.map((src, i) => (
              <img key={`${src}-${i}`} src={src} alt={i === index ? alt : ''} draggable={false} />
            ))}
          </div>
        </button>
        {multi ? (
          <>
            <button
              type="button"
              className="pd-dk-gallery-arrow pd-dk-gallery-arrow--prev"
              aria-label="تصویر قبلی"
              onClick={() => go(-1)}
            >
              <ChevronRight size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="pd-dk-gallery-arrow pd-dk-gallery-arrow--next"
              aria-label="تصویر بعدی"
              onClick={() => go(1)}
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
          </>
        ) : null}
        {badge ? (
          <span className={`pd-shop-badge pd-shop-badge--${badge}`}>
            {BADGE_LABELS[badge]}
            {discount != null ? ` ${discount.toLocaleString('fa-IR')}٪` : ''}
          </span>
        ) : null}
        {discount != null ? (
          <span className="pd-dk-discount-pill">{discount.toLocaleString('fa-IR')}٪</span>
        ) : null}
      </div>

      {multi ? (
        <div className="pd-dk-thumbs" role="list">
          {slides.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              role="listitem"
              className={`pd-dk-thumb${i === index ? ' is-active' : ''}`}
              onClick={() => setActive(i)}
              aria-label={`تصویر ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
            >
              <img
                src={src}
                alt=""
                onError={(e) => {
                  const el = e.currentTarget;
                  if (el.dataset.fallback === '1') {
                    el.style.visibility = 'hidden';
                    return;
                  }
                  el.dataset.fallback = '1';
                  el.src = cover;
                }}
              />
            </button>
          ))}
        </div>
      ) : null}

      {lightbox && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              className="pd-dk-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label="گالری تصاویر محصول"
              tabIndex={-1}
              data-testid="shop-product-lightbox"
            >
              <button
                type="button"
                className="pd-dk-lightbox-close"
                aria-label="بستن"
                onClick={closeLightbox}
              >
                <X size={22} aria-hidden />
              </button>

              {gridOpen ? (
                <div className="pd-dk-lightbox-grid" role="list">
                  {slides.map((src, i) => (
                    <button
                      key={`${src}-grid-${i}`}
                      type="button"
                      role="listitem"
                      className={`pd-dk-lightbox-grid-item${i === index ? ' is-active' : ''}`}
                      onClick={() => {
                        setActive(i);
                        setGridOpen(false);
                      }}
                      aria-label={`تصویر ${i + 1}`}
                    >
                      <img src={src} alt="" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="pd-dk-lightbox-stage">
                  <img src={mainSrc} alt={alt} />
                  {multi ? (
                    <>
                      <button
                        type="button"
                        className="pd-dk-lightbox-arrow pd-dk-lightbox-arrow--prev"
                        aria-label="تصویر قبلی"
                        onClick={() => go(-1)}
                      >
                        <ChevronRight size={22} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="pd-dk-lightbox-arrow pd-dk-lightbox-arrow--next"
                        aria-label="تصویر بعدی"
                        onClick={() => go(1)}
                      >
                        <ChevronLeft size={22} aria-hidden />
                      </button>
                    </>
                  ) : null}
                </div>
              )}

              {multi && !gridOpen ? (
                <div className="pd-dk-lightbox-thumbs" role="list">
                  {slides.map((src, i) => (
                    <button
                      key={`${src}-lb-${i}`}
                      type="button"
                      role="listitem"
                      className={`pd-dk-lightbox-thumb${i === index ? ' is-active' : ''}`}
                      onClick={() => setActive(i)}
                      aria-label={`تصویر ${i + 1}`}
                      aria-current={i === index ? 'true' : undefined}
                    >
                      <img src={src} alt="" />
                    </button>
                  ))}
                </div>
              ) : null}

              {multi ? (
                <button
                  type="button"
                  className="pd-dk-lightbox-all"
                  onClick={() => setGridOpen((v) => !v)}
                  aria-pressed={gridOpen}
                >
                  <LayoutGrid size={16} aria-hidden />
                  همه تصاویر
                </button>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
