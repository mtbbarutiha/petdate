import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { shopLabel } from '../../lib/shopLocale';
import { getTopBrands, type ShopBrand } from '../../data/shopCatalog';
import { ShopRailNavButtons } from './ShopRailNavButtons';
import { useShopRailNav } from './useShopRailNav';

type Props = {
  /** Override brands (tests / category pages). Defaults to featured top brands. */
  brands?: ShopBrand[];
  className?: string;
};

export function ShopTopBrands({ brands, className }: Props) {
  const { lang } = useI18n();
  const items = brands?.length ? brands : getTopBrands();
  const { trackRef, canPrev, canNext, scrollByDir } = useShopRailNav(items.length);

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

        <ShopRailNavButtons
          canPrev={canPrev}
          canNext={canNext}
          onPrev={() => scrollByDir('prev')}
          onNext={() => scrollByDir('next')}
          prevLabel="برندهای قبلی"
          nextLabel="برندهای بیشتر"
        />
      </div>
    </section>
  );
}
