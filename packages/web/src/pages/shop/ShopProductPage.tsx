import { useI18n } from '../../i18n';
import { shopLabel, productTitleForLang } from '../../lib/shopLocale';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronLeft,
  Heart,
  Info,
  Loader2,
  Minus,
  Plus,
  RefreshCcw,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  ThumbsDown,
  ThumbsUp,
  Truck,
} from 'lucide-react';
import {
  formatToman,
  getBrand,
  getCategory,
  getProduct,
  productDiscountPercent,
  productGallery,
  productRating,
  productReturnPolicy,
  productSellerName,
  productSellerScore,
  productShippingNote,
  productWarranty,
} from '../../data/shopCatalog';
import { useAppToast } from '../../hooks/useAppToast';
import { useShopCart } from '../../hooks/useShopCart';
import { useShopFavorites } from '../../hooks/useShopFavorites';
import { productPublicUrl, shareOrCopyUrl } from '../../lib/share';
import { trackViewItem } from '../../lib/siteAnalytics';
import { ShopBreadcrumb } from '../../components/shop/ShopBreadcrumb';
import { ShopChrome } from '../../components/shop/ShopChrome';
import { ShopSimilarProducts } from '../../components/shop/ShopSimilarProducts';
import { ShopProductGallery } from '../../components/shop/ShopProductGallery';
import { ShopTrustBadges } from '../../components/shop/ShopTrustBadges';
import { shopProductBreadcrumbs } from '../../lib/shopBreadcrumb';

type DetailTab = 'desc' | 'specs' | 'reviews';

/** `/shop/:slug` and `/shop/p/:slug` — never dump unknown shop URLs on the homepage. */
export function ShopProductAliasRedirect() {
  const { id = '' } = useParams<{ id: string }>();
  const product = getProduct(id);
  if (!product) {
    return <Navigate to="/shop" replace />;
  }
  return <Navigate to={`/shop/product/${product.slug}`} replace />;
}

export function ShopProductPage() {
  const { lang } = useI18n();
  const { id = '' } = useParams<{ id: string }>();
  const product = getProduct(id);
  const { addAnimated, pendingAddId } = useShopCart();
  const { liked, toggle: toggleLike } = useShopFavorites();
  const { toastSuccess, toastError, toastInfo } = useAppToast();
  const [tab, setTab] = useState<DetailTab>('desc');
  const [qty, setQty] = useState(1);
  const [colorIdx, setColorIdx] = useState(0);
  const [sizeIdx, setSizeIdx] = useState(0);

  const gallery = useMemo(() => (product ? productGallery(product) : []), [product]);
  const brand = product ? getBrand(product.brandId) : undefined;
  const category = product ? getCategory(product.categorySlug) : undefined;
  const discount = product ? productDiscountPercent(product) : null;
  const seller = product ? productSellerName(product) : '';
  const warranty = product ? productWarranty(product) : '';
  const shipping = product ? productShippingNote(product) : '';
  const returnPolicy = product ? productReturnPolicy(product) : '';
  const sellerScore = product ? productSellerScore(product) : 94;
  const { rating, count: reviewCount } = product
    ? productRating(product)
    : { rating: 0, count: 0 };

  useEffect(() => {
    if (!product) return;
    trackViewItem({
      itemId: product.id,
      itemName: product.title,
      price: product.priceToman,
      category: product.categorySlug,
    });
  }, [product]);

  if (!product) {
    return <Navigate to="/shop" replace />;
  }

  if (id && product.slug && id !== product.slug) {
    return <Navigate to={`/shop/product/${product.slug}`} replace />;
  }

  const colors = product.colors ?? [];
  const sizes = product.sizes ?? [];
  const highlights = product.highlights?.length
    ? product.highlights
    : [
        brand ? `برند ${shopLabel(lang, brand.labelFa, brand.labelEn)}` : 'برند پت‌دیت شاپ',
        product.inStock ? 'آماده ارسال از انبار پت‌دیت' : 'فعلاً ناموجود',
        warranty,
      ];
  const pros = product.pros?.length ? product.pros : ['کیفیت مناسب', 'ارسال به‌موقع'];
  const cons = product.cons?.length ? product.cons : [];
  const paramEntries = Object.entries(product.params).filter(([k]) => !k.startsWith('__'));

  const adding = pendingAddId === product.id;
  const isLiked = liked(product.id);
  const productTitle = productTitleForLang(lang, product.title, {
    titleEn: product.titleEn,
    slug: product.slug,
  });
  const onAdd = () => {
    if (!product.inStock || adding) return;
    void addAnimated(product.id, qty);
  };
  const onToggleLike = () => {
    const nextLiked = !isLiked;
    toggleLike(product.id);
    toastInfo(nextLiked ? 'به علاقه‌مندی‌ها اضافه شد' : 'از علاقه‌مندی‌ها حذف شد');
  };
  const onShare = async () => {
    const url = productPublicUrl(product.slug || product.id);
    const message = await shareOrCopyUrl({
      url,
      title: productTitle,
      text: productTitle,
    });
    if (message == null) return;
    if (message.includes('ناموفق')) toastError(message);
    else toastSuccess(message);
  };

  return (
    <ShopChrome hideBanner>
      <div className="pepito-container pd-shop-detail pd-dk-pdp">
        <div className="pd-dk-pdp-top">
          <div className="pd-dk-gallery-col">
            <ShopBreadcrumb
              className="pd-dk-pdp-breadcrumb"
              items={shopProductBreadcrumbs({ lang, product, category })}
            />
            <div className="pd-dk-gallery-with-rail">
              <div className="pd-dk-action-rail" role="group" aria-label="عملیات کالا">
                <button
                  type="button"
                  className={`pd-dk-action-rail-btn${isLiked ? ' is-liked' : ''}`}
                  aria-pressed={isLiked}
                  aria-label={isLiked ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
                  title={isLiked ? 'پسندیده‌اید' : 'لایک'}
                  onClick={onToggleLike}
                >
                  <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} aria-hidden />
                </button>
                <button
                  type="button"
                  className="pd-dk-action-rail-btn"
                  aria-label="اشتراک‌گذاری کالا"
                  title="اشتراک‌گذاری"
                  onClick={() => void onShare()}
                >
                  <Share2 size={20} aria-hidden />
                </button>
              </div>
              <ShopProductGallery
                key={product.id}
                gallery={gallery}
                cover={product.image}
                alt={productTitleForLang(lang, product.title, {
                  titleEn: product.titleEn,
                  slug: product.slug,
                })}
                badge={product.badge}
                discount={discount}
              />
            </div>
          </div>

          {/* Info column */}
          <div className="pd-dk-info">
            {brand ? (
              <Link to={`/shop/c/${category?.slug ?? 'all'}?brand=${brand.id}`} className="pd-dk-brand">
                {shopLabel(lang, brand.labelFa, brand.labelEn)}
                <ChevronLeft size={14} aria-hidden />
              </Link>
            ) : null}
            <h1 className="pd-dk-title">{productTitle}</h1>
            {product.titleEn ? <p className="pd-dk-title-en">{product.titleEn}</p> : null}

            <div className="pd-dk-meta">
              <span className="pd-dk-rating" title="امتیاز کاربران">
                <Star size={14} fill="currentColor" aria-hidden />
                {rating.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}
              </span>
              <span className="pd-dk-meta-sep" aria-hidden>
                |
              </span>
              <button type="button" className="pd-dk-meta-link" onClick={() => setTab('reviews')}>
                {reviewCount.toLocaleString('fa-IR')} دیدگاه
              </button>
              {product.sku ? (
                <>
                  <span className="pd-dk-meta-sep" aria-hidden>
                    |
                  </span>
                  <span className="pd-dk-sku">کد: {product.sku}</span>
                </>
              ) : null}
              {category ? (
                <>
                  <span className="pd-dk-meta-sep" aria-hidden>
                    |
                  </span>
                  <Link to={`/shop/c/${category.slug}`}>{shopLabel(lang, category.labelFa, category.labelEn)}</Link>
                </>
              ) : null}
            </div>

            <ul className="pd-dk-highlights">
              {highlights.map((h) => (
                <li key={h}>
                  <CheckCircle2 size={15} aria-hidden />
                  {h}
                </li>
              ))}
            </ul>

            {colors.length > 0 ? (
              <div className="pd-dk-variants">
                <p className="pd-dk-variants-label">
                  رنگ: <strong>{colors[colorIdx]?.labelFa}</strong>
                </p>
                <div className="pd-dk-color-row" role="listbox" aria-label="رنگ">
                  {colors.map((c, i) => (
                    <button
                      key={c.labelFa}
                      type="button"
                      role="option"
                      aria-selected={i === colorIdx}
                      className={`pd-dk-color${i === colorIdx ? ' is-active' : ''}`}
                      style={{ background: c.hex }}
                      title={c.labelFa}
                      onClick={() => setColorIdx(i)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {sizes.length > 0 ? (
              <div className="pd-dk-variants">
                <p className="pd-dk-variants-label">
                  سایز / وزن: <strong>{sizes[sizeIdx]}</strong>
                </p>
                <div className="pd-dk-size-row" role="listbox" aria-label="سایز">
                  {sizes.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      role="option"
                      aria-selected={i === sizeIdx}
                      className={`pd-dk-size${i === sizeIdx ? ' is-active' : ''}`}
                      onClick={() => setSizeIdx(i)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {paramEntries.length > 0 ? (
              <div className="pd-dk-quick-params">
                {paramEntries.slice(0, 6).map(([k, v]) => (
                  <div key={k} className="pd-dk-quick-param">
                    <span>{k.replaceAll('_', ' ')}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Digikala buybox */}
          <aside className="pd-dk-buybox" aria-label="خرید">
            <div className="pd-dk-buybox-seller">
              <Store size={16} aria-hidden />
              <div>
                <span className="pd-dk-buybox-label">فروشنده</span>
                <strong>{seller}</strong>
                <span className="pd-dk-seller-score">رضایت خریداران: {sellerScore.toLocaleString('fa-IR')}٪</span>
              </div>
            </div>
            <div className="pd-dk-buybox-row">
              <ShieldCheck size={16} aria-hidden />
              <span>{warranty}</span>
            </div>
            <div className="pd-dk-buybox-row">
              <Truck size={16} aria-hidden />
              <span>{shipping}</span>
            </div>
            <div className="pd-dk-buybox-row">
              <RefreshCcw size={16} aria-hidden />
              <span>{returnPolicy}</span>
            </div>
            <div className="pd-dk-buybox-row">
              <Info size={16} aria-hidden />
              <span>{product.inStock ? 'موجود در انبار پت‌دیت' : 'ناموجود'}</span>
            </div>

            <div className="pd-dk-buybox-price">
              {product.compareAtToman && product.compareAtToman > product.priceToman ? (
                <span className="pd-shop-price-was">{formatToman(product.compareAtToman)}</span>
              ) : null}
              <div className="pd-dk-buybox-now">
                {discount != null ? (
                  <span className="pd-dk-buybox-off">{discount.toLocaleString('fa-IR')}٪</span>
                ) : null}
                <span className="pd-shop-price-now">{formatToman(product.priceToman)}</span>
              </div>
            </div>

            <div className="pd-dk-qty" aria-label="تعداد">
              <button
                type="button"
                className="pd-dk-qty-btn"
                aria-label="کاهش"
                disabled={qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus size={14} />
              </button>
              <span>{qty.toLocaleString('fa-IR')}</span>
              <button
                type="button"
                className="pd-dk-qty-btn"
                aria-label="افزایش"
                disabled={!product.inStock || qty >= 10}
                onClick={() => setQty((q) => Math.min(10, q + 1))}
              >
                <Plus size={14} />
              </button>
            </div>

            <button
              type="button"
              className={`pepito-btn button-1 pd-dk-add${adding ? ' is-loading' : ''}`}
              disabled={!product.inStock || adding}
              aria-busy={adding}
              onClick={onAdd}
            >
              {adding ? (
                <Loader2 size={16} strokeWidth={2.4} className="pd-shop-add-spin" aria-hidden />
              ) : (
                <ShoppingBag size={16} strokeWidth={2} aria-hidden />
              )}
              {adding ? 'در حال افزودن…' : product.inStock ? 'افزودن به سبد' : 'ناموجود'}
            </button>
            <Link to="/shop/cart" className="pd-dk-cart-link">
              مشاهده سبد خرید
              <ChevronLeft size={14} aria-hidden />
            </Link>
          </aside>
        </div>

        <ShopTrustBadges />

        {/* Tabs: description / specs / reviews */}
        <section className="pd-dk-tabs-block" aria-label="جزئیات محصول">
          <div className="pd-dk-tabs" role="tablist">
            {(
              [
                ['desc', 'توضیحات'],
                ['specs', 'مشخصات'],
                ['reviews', 'دیدگاه‌ها'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={tab === key ? 'is-active' : undefined}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="pd-dk-tab-panel" role="tabpanel">
            {tab === 'desc' ? (
              <p className="pd-dk-desc">{product.description}</p>
            ) : null}
            {tab === 'specs' ? (
              <table className="pd-dk-specs">
                <tbody>
                  <tr>
                    <th>برند</th>
                    <td>{shopLabel(lang, brand?.labelFa ?? '', brand?.labelEn) ?? '—'}</td>
                  </tr>
                  <tr>
                    <th>دسته‌بندی</th>
                    <td>{shopLabel(lang, category?.labelFa ?? '', category?.labelEn) ?? '—'}</td>
                  </tr>
                  {product.sku ? (
                    <tr>
                      <th>کد کالا</th>
                      <td>{product.sku}</td>
                    </tr>
                  ) : null}
                  {product.titleEn ? (
                    <tr>
                      <th>عنوان انگلیسی</th>
                      <td dir="ltr">{product.titleEn}</td>
                    </tr>
                  ) : null}
                  {paramEntries.map(([k, v]) => (
                    <tr key={k}>
                      <th>{k.replaceAll('_', ' ')}</th>
                      <td>{v}</td>
                    </tr>
                  ))}
                  <tr>
                    <th>وضعیت موجودی</th>
                    <td>{product.inStock ? 'موجود' : 'ناموجود'}</td>
                  </tr>
                  <tr>
                    <th>گارانتی</th>
                    <td>{warranty}</td>
                  </tr>
                  <tr>
                    <th>ارسال</th>
                    <td>{shipping}</td>
                  </tr>
                  <tr>
                    <th>مرجوعی</th>
                    <td>{returnPolicy}</td>
                  </tr>
                </tbody>
              </table>
            ) : null}
            {tab === 'reviews' ? (
              <div className="pd-dk-reviews">
                <div className="pd-dk-reviews-summary">
                  <div className="pd-dk-reviews-score">
                    <strong>{rating.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}</strong>
                    <span>از ۵</span>
                    <span className="pd-dk-reviews-count">
                      بر اساس {reviewCount.toLocaleString('fa-IR')} دیدگاه
                    </span>
                  </div>
                  <div className="pd-dk-proscons">
                    <div>
                      <h3>
                        <ThumbsUp size={16} aria-hidden /> نقاط قوت
                      </h3>
                      <ul>
                        {pros.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </div>
                    {cons.length > 0 ? (
                      <div>
                        <h3>
                          <ThumbsDown size={16} aria-hidden /> نقاط ضعف
                        </h3>
                        <ul>
                          {cons.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
                <p className="pd-dk-reviews-note">
                  دیدگاه‌های خریداران به‌زودی در پنل ادمین قابل مدیریت است. فعلاً خلاصه امتیاز و نقاط
                  قوت/ضعف از کاتالوگ محصول نمایش داده می‌شود.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        {/* DigiKala-style similar products — below trust badges + description tabs */}
        <ShopSimilarProducts product={product} />
      </div>

      {/* Mobile sticky buy bar — Digikala-like */}
      <div className="pd-dk-mobile-bar" aria-label="خرید سریع">
        <div className="pd-dk-mobile-bar-price">
          {discount != null ? (
            <span className="pd-dk-buybox-off">{discount.toLocaleString('fa-IR')}٪</span>
          ) : null}
          <strong>{formatToman(product.priceToman)}</strong>
        </div>
        <button
          type="button"
          className={`pepito-btn button-1${adding ? ' is-loading' : ''}`}
          disabled={!product.inStock || adding}
          aria-busy={adding}
          onClick={onAdd}
        >
          {adding ? (
            <>
              <Loader2 size={16} className="pd-shop-add-spin" aria-hidden />
              در حال افزودن…
            </>
          ) : product.inStock ? (
            'افزودن به سبد'
          ) : (
            'ناموجود'
          )}
        </button>
      </div>
    </ShopChrome>
  );
}
