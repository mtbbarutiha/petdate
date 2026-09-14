import { useMemo } from 'react';
import { type ShopProduct } from '../../data/shopCatalog';
import { getSimilarProducts } from '../../lib/shopSimilarProducts';
import { useShopCatalogSync } from '../../hooks/useShopCatalogSync';
import { ShopProductCard } from './ShopProductCard';
import { ShopRailNavButtons } from './ShopRailNavButtons';
import { useShopRailNav } from './useShopRailNav';

/**
 * DigiKala-style «کالاهای مشابه» horizontal rail for shop PDP.
 * Placement: below trust badges + description tabs.
 */
export function ShopSimilarProducts({ product }: { product: ShopProduct }) {
  const { ready } = useShopCatalogSync();
  const items = useMemo(() => getSimilarProducts(product), [product, ready]);
  const { trackRef, canPrev, canNext, scrollByDir } = useShopRailNav(items.length);

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
        <ShopRailNavButtons
          canPrev={canPrev}
          canNext={canNext}
          onPrev={() => scrollByDir('prev')}
          onNext={() => scrollByDir('next')}
          prevLabel="کالاهای قبلی"
          nextLabel="مشاهده کالاهای بیشتر"
        />
      </div>
    </section>
  );
}
