import { useI18n } from '../../i18n';
import { shopLabel } from '../../lib/shopLocale';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Filter, RotateCcw, Search, X } from 'lucide-react';
import {
  SHOP_BRANDS,
  SHOP_CATEGORIES,
  SHOP_PET_TYPES,
  SHOP_PRICE_MAX,
  filterProducts,
  getBrand,
  getCategory,
  type ShopPetType,
} from '../../data/shopCatalog';
import { ShopChrome } from '../../components/shop/ShopChrome';
import { ShopProductCard } from '../../components/shop/ShopProductCard';

export function ShopCategoryPage() {
  const { lang, t } = useI18n();
  const { category = 'all' } = useParams<{ category: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const brandFromUrl = searchParams.get('brand') ?? '';
  const petFromUrl = (searchParams.get('pet') as ShopPetType | null) ?? 'all';
  const qFromUrl = searchParams.get('q') ?? '';

  const catMeta = category === 'all' ? null : getCategory(category);
  const initialPet: ShopPetType =
    petFromUrl !== 'all'
      ? petFromUrl
      : catMeta
        ? catMeta.petType
        : 'all';

  const [petType, setPetType] = useState<ShopPetType>(initialPet);
  const [brandId, setBrandId] = useState(brandFromUrl);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(SHOP_PRICE_MAX);
  const [q, setQ] = useState(qFromUrl);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const products = useMemo(
    () =>
      filterProducts({
        petType,
        categorySlug: category === 'all' ? undefined : category,
        brandId: brandId || undefined,
        minPrice,
        maxPrice,
        q,
        inStockOnly,
      }),
    [petType, category, brandId, minPrice, maxPrice, q, inStockOnly]
  );

  const title = catMeta
    ? shopLabel(lang, catMeta.labelFa, catMeta.labelEn)
    : brandId
      ? shopLabel(lang, getBrand(brandId)?.labelFa ?? '', getBrand(brandId)?.labelEn) || t('shop.allProducts')
      : t('shop.allProducts');
  const lead = catMeta?.description ?? 'فیلتر بر اساس نوع پت، برند و بازه قیمت (تومان)';

  const syncUrl = (next: { brand?: string; pet?: ShopPetType; q?: string }) => {
    const sp = new URLSearchParams(searchParams);
    if (next.brand !== undefined) {
      if (next.brand) sp.set('brand', next.brand);
      else sp.delete('brand');
    }
    if (next.pet !== undefined) {
      if (next.pet && next.pet !== 'all') sp.set('pet', next.pet);
      else sp.delete('pet');
    }
    if (next.q !== undefined) {
      if (next.q) sp.set('q', next.q);
      else sp.delete('q');
    }
    setSearchParams(sp, { replace: true });
  };

  const resetFilters = () => {
    setPetType(catMeta ? catMeta.petType : 'all');
    setBrandId('');
    setMinPrice(0);
    setMaxPrice(SHOP_PRICE_MAX);
    setQ('');
    setInStockOnly(false);
    setSearchParams({}, { replace: true });
  };

  const activeFilterCount =
    (brandId ? 1 : 0) +
    (q.trim() ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (minPrice > 0 || maxPrice < SHOP_PRICE_MAX ? 1 : 0) +
    (petType !== 'all' && (!catMeta || petType !== catMeta.petType) ? 1 : 0);

  const visibleCategories = SHOP_CATEGORIES.filter(
    (c) => petType === 'all' || c.petType === petType
  );

  const sidebar = (
    <aside className={`pd-shop-filters${filtersOpen ? ' is-open' : ''}`} aria-label="فیلترها">
      <div className="pd-shop-filters-head">
        <h2>
          <Filter size={18} strokeWidth={2.2} aria-hidden />
          فیلترها
        </h2>
        <div className="pd-shop-filters-head-actions">
          <button type="button" className="pd-shop-filters-reset" onClick={resetFilters}>
            <RotateCcw size={14} strokeWidth={2.2} aria-hidden />
            پاک کردن
          </button>
          <button
            type="button"
            className="pd-shop-filters-close"
            onClick={() => setFiltersOpen(false)}
            aria-label="بستن فیلترها"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <label className="pd-shop-filter-field">
        <span>جستجو</span>
        <span className="pd-shop-filter-search">
          <Search size={16} strokeWidth={2.2} aria-hidden />
          <input
            type="search"
            value={q}
            placeholder="نام محصول یا برند…"
            onChange={(e) => {
              setQ(e.target.value);
              syncUrl({ q: e.target.value });
            }}
          />
        </span>
      </label>

      <fieldset className="pd-shop-filter-group">
        <legend>نوع حیوان</legend>
        <div className="pd-shop-chip-wrap">
          {SHOP_PET_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`pd-shop-chip${petType === t.id ? ' is-active' : ''}`}
              onClick={() => {
                setPetType(t.id);
                syncUrl({ pet: t.id });
              }}
            >
              {shopLabel(lang, t.labelFa, (t as any).labelEn)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="pd-shop-filter-group">
        <legend>دسته‌بندی</legend>
        <div className="pd-shop-filter-links">
          <Link
            to={`/shop/c/all${brandId ? `?brand=${brandId}` : ''}`}
            className={!catMeta ? 'is-active' : ''}
          >
            <span className="pd-shop-filter-link-emoji" aria-hidden>
              ✨
            </span>
            همه دسته‌ها
          </Link>
          {visibleCategories.map((c) => (
            <Link
              key={c.slug}
              to={`/shop/c/${c.slug}${brandId ? `?brand=${brandId}` : ''}`}
              className={category === c.slug ? 'is-active' : ''}
            >
              <span className="pd-shop-filter-link-emoji" aria-hidden>
                {c.emoji}
              </span>
              {shopLabel(lang, c.labelFa, c.labelEn)}
            </Link>
          ))}
        </div>
      </fieldset>

      <fieldset className="pd-shop-filter-group">
        <legend>برند</legend>
        <div className="pd-shop-chip-wrap">
          <button
            type="button"
            className={`pd-shop-chip${!brandId ? ' is-active' : ''}`}
            onClick={() => {
              setBrandId('');
              syncUrl({ brand: '' });
            }}
          >
            همه
          </button>
          {SHOP_BRANDS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`pd-shop-chip${brandId === b.id ? ' is-active' : ''}`}
              onClick={() => {
                setBrandId(b.id);
                syncUrl({ brand: b.id });
              }}
            >
              {shopLabel(lang, b.labelFa, b.labelEn)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="pd-shop-filter-group">
        <legend>بازه قیمت (تومان)</legend>
        <div className="pd-shop-price-row">
          <label>
            از
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={minPrice}
              onChange={(e) => setMinPrice(Number(e.target.value) || 0)}
            />
          </label>
          <label>
            تا
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value) || SHOP_PRICE_MAX)}
            />
          </label>
        </div>
      </fieldset>

      <label className="pd-shop-check">
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => setInStockOnly(e.target.checked)}
        />
        فقط موجود
      </label>

      <button
        type="button"
        className="pd-shop-filters-apply"
        onClick={() => setFiltersOpen(false)}
      >
        نمایش {products.length.toLocaleString('fa-IR')} محصول
      </button>
    </aside>
  );

  return (
    <ShopChrome bannerTitle={title} bannerLead={lead}>
      <div className="pepito-container pd-shop-listing">
        <nav className="pd-shop-breadcrumb" aria-label="مسیر">
          <Link to="/shop">پت دیت شاپ</Link>
          <span>/</span>
          <span>{title}</span>
        </nav>

        <div className="pd-shop-listing-toolbar">
          <div className="pd-shop-listing-toolbar-copy">
            <p>
              {products.length.toLocaleString('fa-IR')} محصول
              {catMeta ? ` در «${shopLabel(lang, catMeta.labelFa, catMeta.labelEn)}»` : ''}
            </p>
            {activeFilterCount > 0 ? (
              <span className="pd-shop-listing-active">
                {activeFilterCount.toLocaleString('fa-IR')} فیلتر فعال
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="pd-shop-filters-toggle"
            onClick={() => setFiltersOpen(true)}
          >
            <Filter size={16} strokeWidth={2.2} aria-hidden />
            فیلترها
            {activeFilterCount > 0 ? (
              <span className="pd-shop-filters-toggle-count">
                {activeFilterCount.toLocaleString('fa-IR')}
              </span>
            ) : null}
          </button>
        </div>

        <div className="pd-shop-listing-layout">
          {sidebar}
          {filtersOpen ? (
            <button
              type="button"
              className="pd-shop-filters-backdrop"
              aria-label="بستن فیلتر"
              onClick={() => setFiltersOpen(false)}
            />
          ) : null}
          <div className="pd-shop-listing-results">
            {products.length === 0 ? (
              <div className="pd-shop-empty">
                <p>محصولی با این فیلترها پیدا نشد.</p>
                <button type="button" className="pepito-btn button-3" onClick={resetFilters}>
                  پاک کردن فیلترها
                </button>
              </div>
            ) : (
              <div className="pd-shop-product-grid">
                {products.map((p) => (
                  <ShopProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ShopChrome>
  );
}
