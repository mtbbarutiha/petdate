import { useI18n } from '../../i18n';
import { shopLabel, productTitleForLang } from '../../lib/shopLocale';
import { Link } from 'react-router-dom';
import { Loader2, ShoppingCart, Truck } from 'lucide-react';
import {
  formatToman,
  getBrand,
  productDiscountPercent,
  type ShopProduct,
} from '../../data/shopCatalog';
import { useShopCart } from '../../hooks/useShopCart';
import {
  isSpecialSaleBadge,
  similarLowStockQty,
} from '../../lib/shopSimilarProducts';

export function ShopProductCard({
  product,
  onAdd,
  variant = 'default',
}: {
  product: ShopProduct;
  /** اختیاری — پیش‌فرض addAnimated با لودینگ و toast */
  onAdd?: (id: string) => void;
  /** `similar` = DigiKala-style compact rail card (no add button) */
  variant?: 'default' | 'similar';
}) {
  const { lang, t } = useI18n();
  const { addAnimated, pendingAddId } = useShopCart();
  const brand = getBrand(product.brandId);
  const discount = productDiscountPercent(product);
  const paramLine = Object.entries(product.params)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
  const busy = pendingAddId === product.id;
  const title = productTitleForLang(lang, product.title, {
    titleEn: product.titleEn,
    slug: product.slug,
  });

  const handleAdd = () => {
    if (!product.inStock || busy) return;
    if (onAdd) {
      onAdd(product.id);
      return;
    }
    void addAnimated(product.id);
  };

  if (variant === 'similar') {
    const lowStock = similarLowStockQty(product);
    const shippingPill = product.shippingNote?.trim() || null;
    const specialSale = isSpecialSaleBadge(product.badge);

    return (
      <article className={`pd-shop-card pd-shop-card--similar${!product.inStock ? ' is-oos' : ''}`}>
        <Link to={`/shop/product/${product.slug}`} className="pd-shop-card--similar-link">
          {specialSale ? <span className="pd-shop-similar-sale">فروش ویژه</span> : null}
          <span className="pd-shop-card-media pd-shop-card-media--similar">
            <img src={product.image} alt={title} loading="lazy" />
          </span>
          <h3>{title}</h3>
          {shippingPill ? (
            <span className="pd-shop-similar-ship">
              <Truck size={12} aria-hidden />
              {shippingPill}
            </span>
          ) : null}
          {lowStock != null ? (
            <span className="pd-shop-similar-low">
              تنها {lowStock.toLocaleString('fa-IR')} عدد در انبار باقی مانده
            </span>
          ) : null}
          <span className="pd-shop-similar-price">
            {discount != null ? (
              <span className="pd-shop-similar-off">{discount.toLocaleString('fa-IR')}٪</span>
            ) : null}
            <span className="pd-shop-similar-price-col">
              {product.compareAtToman && product.compareAtToman > product.priceToman ? (
                <span className="pd-shop-price-was">{product.compareAtToman.toLocaleString('fa-IR')}</span>
              ) : null}
              <span className="pd-shop-price-now">{formatToman(product.priceToman)}</span>
            </span>
          </span>
        </Link>
      </article>
    );
  }

  return (
    <article className={`pd-shop-card${!product.inStock ? ' is-oos' : ''}`}>
      <Link to={`/shop/product/${product.slug}`} className="pd-shop-card-media">
        <img src={product.image} alt={title} loading="lazy" />
        {product.badge ? (
          <span className={`pd-shop-badge pd-shop-badge--${product.badge}`}>
            {t(`shop.badge${product.badge[0].toUpperCase()}${product.badge.slice(1)}` as 'shop.badgeHot')}
            {discount != null ? ` ${discount}%` : ''}
          </span>
        ) : null}
        {!product.inStock ? <span className="pd-shop-oos-tag">{t('shop.outOfStock')}</span> : null}
      </Link>
      <div className="pd-shop-card-body">
        {brand ? <p className="pd-shop-card-brand">{shopLabel(lang, brand.labelFa, brand.labelEn)}</p> : null}
        <h3>
          <Link to={`/shop/product/${product.slug}`}>{title}</Link>
        </h3>
        {paramLine ? <p className="pd-shop-card-params">{paramLine}</p> : null}
        <div className="pd-shop-card-footer">
          <div className="pd-shop-card-prices">
            {product.compareAtToman && product.compareAtToman > product.priceToman ? (
              <span className="pd-shop-price-was">{formatToman(product.compareAtToman)}</span>
            ) : null}
            <span className="pd-shop-price-now">{formatToman(product.priceToman)}</span>
          </div>
          <button
            type="button"
            className={`pd-shop-add-btn${busy ? ' is-loading' : ''}`}
            disabled={!product.inStock || busy}
            aria-busy={busy}
            onClick={handleAdd}
          >
            {busy ? (
              <Loader2 size={15} strokeWidth={2.4} className="pd-shop-add-spin" aria-hidden />
            ) : (
              <ShoppingCart size={15} strokeWidth={2.2} aria-hidden />
            )}
            {busy ? 'در حال افزودن…' : product.inStock ? 'افزودن به سبد خرید' : 'ناموجود'}
          </button>
        </div>
      </div>
    </article>
  );
}
