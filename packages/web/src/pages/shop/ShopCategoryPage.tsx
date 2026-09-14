import { useI18n } from '../../i18n';
import { shopLabel } from '../../lib/shopLocale';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown, Filter, RotateCcw, Search, X } from 'lucide-react';
import {
  SHOP_CATEGORIES,
  SHOP_PARAM_FILTER_DIMS,
  SHOP_PET_TYPES,
  SHOP_PRICE_MAX,
  SHOP_UNBACKED_FILTER_DIMS,
  collectParamFilterOptions,
  filterProducts,
  getActiveBrands,
  getBrand,
  getCategory,
  getLiveCategories,
  type ShopPetType,
} from '../../data/shopCatalog';
import { ShopChrome } from '../../components/shop/ShopChrome';
import { ShopProductCard } from '../../components/shop/ShopProductCard';

/** Prefer accordion/dropdown once an option list grows past this size. */
const CHIP_CLOUD_MAX = 8;

function FilterAccordion({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`pd-shop-filter-acc${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="pd-shop-filter-acc-btn"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <ChevronDown size={16} strokeWidth={2.2} aria-hidden />
      </button>
      {open ? <div className="pd-shop-filter-acc-body">{children}</div> : null}
    </div>
  );
}

function OptionChips({
  options,
  activeId,
  onSelect,
  allLabel = 'همه',
}: {
  options: { id: string; label: string }[];
  activeId: string;
  onSelect: (id: string) => void;
  allLabel?: string;
}) {
  const items = [{ id: '', label: allLabel }, ...options];
  return (
    <div className="pd-shop-chip-wrap">
      {items.map((opt) => {
        const active = (opt.id || '') === (activeId || '');
        return (
          <button
            key={opt.id || '__all'}
            type="button"
            className={`pd-shop-chip${active ? ' is-active' : ''}`}
            onClick={() => {
              // Toggle deselect: re-click active → clear (or «همه»)
              if (active) onSelect('');
              else onSelect(opt.id);
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function ShopCategoryPage() {
  const { lang, t } = useI18n();
  const { category = 'all' } = useParams<{ category: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const brandFromUrl = searchParams.get('brand') ?? '';
  const petFromUrl = (searchParams.get('pet') as ShopPetType | null) ?? 'all';
  const qFromUrl = searchParams.get('q') ?? '';

  const catMeta = category === 'all' ? null : getCategory(category);
  const initialPet: ShopPetType =
    petFromUrl !== 'all' ? petFromUrl : catMeta ? catMeta.petType : 'all';

  const [petType, setPetType] = useState<ShopPetType>(initialPet);
  const [brandId, setBrandId] = useState(brandFromUrl);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(SHOP_PRICE_MAX);
  const [q, setQ] = useState(qFromUrl);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [paramFilters, setParamFilters] = useState<Record<string, string>>({});

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
        params: paramFilters,
      }),
    [petType, category, brandId, minPrice, maxPrice, q, inStockOnly, paramFilters]
  );

  const title = catMeta
    ? shopLabel(lang, catMeta.labelFa, catMeta.labelEn)
    : brandId
      ? shopLabel(lang, getBrand(brandId)?.labelFa ?? '', getBrand(brandId)?.labelEn) ||
        t('shop.allProducts')
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
    setParamFilters({});
    setSearchParams({}, { replace: true });
  };

  const paramFilterCount = Object.values(paramFilters).filter(Boolean).length;
  const activeFilterCount =
    (brandId ? 1 : 0) +
    (q.trim() ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (minPrice > 0 || maxPrice < SHOP_PRICE_MAX ? 1 : 0) +
    (petType !== 'all' && (!catMeta || petType !== catMeta.petType) ? 1 : 0) +
    paramFilterCount;

  const visibleCategories = useMemo(() => {
    const live = getLiveCategories();
    const cats = live.length ? live : SHOP_CATEGORIES;
    return cats.filter((c) => petType === 'all' || c.petType === petType);
  }, [petType]);

  const brands = useMemo(() => getActiveBrands(), []);
  const brandOptions = brands.map((b) => ({
    id: b.id,
    label: shopLabel(lang, b.labelFa, b.labelEn),
  }));

  const paramDims = useMemo(
    () =>
      SHOP_PARAM_FILTER_DIMS.map((dim) => ({
        ...dim,
        options: collectParamFilterOptions(dim.key),
      })).filter((d) => d.options.length > 0),
    []
  );

  const setParam = (key: string, value: string) => {
    setParamFilters((prev) => {
      const next = { ...prev };
      if (!value) delete next[key];
      else next[key] = value;
      return next;
    });
  };

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

      <FilterAccordion title="محدوده قیمت" defaultOpen>
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
      </FilterAccordion>

      <FilterAccordion title="برند" defaultOpen={Boolean(brandId) || brands.length <= CHIP_CLOUD_MAX}>
        {brands.length > CHIP_CLOUD_MAX ? (
          <label className="pd-shop-filter-select">
            <select
              value={brandId}
              onChange={(e) => {
                const next = e.target.value;
                setBrandId(next);
                syncUrl({ brand: next });
              }}
            >
              <option value="">همه</option>
              {brandOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <OptionChips
            options={brandOptions}
            activeId={brandId}
            onSelect={(id) => {
              setBrandId(id);
              syncUrl({ brand: id });
            }}
          />
        )}
      </FilterAccordion>

      <FilterAccordion title="گونه حیوان" defaultOpen>
        <div className="pd-shop-chip-wrap">
          {SHOP_PET_TYPES.map((pt) => {
            const active = petType === pt.id;
            return (
              <button
                key={pt.id}
                type="button"
                className={`pd-shop-chip${active ? ' is-active' : ''}`}
                onClick={() => {
                  if (active && pt.id !== 'all') {
                    setPetType('all');
                    syncUrl({ pet: 'all' });
                  } else if (active && pt.id === 'all') {
                    // stay on all
                  } else {
                    setPetType(pt.id);
                    syncUrl({ pet: pt.id });
                  }
                }}
              >
                {shopLabel(lang, pt.labelFa, pt.labelEn)}
              </button>
            );
          })}
        </div>
      </FilterAccordion>

      <FilterAccordion title="دسته‌بندی" defaultOpen>
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
          {visibleCategories.map((c) => {
            const active = category === c.slug;
            // Toggle: clicking the active category unselects → all categories.
            const href = active
              ? `/shop/c/all${brandId ? `?brand=${brandId}` : ''}`
              : `/shop/c/${c.slug}${brandId ? `?brand=${brandId}` : ''}`;
            return (
              <Link
                key={c.slug}
                to={href}
                className={active ? 'is-active' : ''}
                aria-current={active ? 'page' : undefined}
              >
                <span className="pd-shop-filter-link-emoji" aria-hidden>
                  {c.emoji}
                </span>
                {shopLabel(lang, c.labelFa, c.labelEn)}
              </Link>
            );
          })}
        </div>
      </FilterAccordion>

      {paramDims.map((dim) => (
        <FilterAccordion
          key={dim.key}
          title={shopLabel(lang, dim.labelFa, dim.labelEn)}
          defaultOpen={Boolean(paramFilters[dim.key])}
        >
          {dim.options.length > CHIP_CLOUD_MAX ? (
            <label className="pd-shop-filter-select">
              <select
                value={paramFilters[dim.key] ?? ''}
                onChange={(e) => setParam(dim.key, e.target.value)}
              >
                <option value="">همه</option>
                {dim.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <OptionChips
              options={dim.options.map((opt) => ({ id: opt, label: opt }))}
              activeId={paramFilters[dim.key] ?? ''}
              onSelect={(id) => setParam(dim.key, id)}
            />
          )}
        </FilterAccordion>
      ))}

      {/* DigiKala-named dims with no catalog values — shown disabled for parity */}
      {SHOP_UNBACKED_FILTER_DIMS.map((dim) => (
        <div key={dim.key} className="pd-shop-filter-acc is-disabled" aria-disabled="true">
          <button type="button" className="pd-shop-filter-acc-btn" disabled>
            <span>{shopLabel(lang, dim.labelFa, dim.labelEn)}</span>
            <ChevronDown size={16} strokeWidth={2.2} aria-hidden />
          </button>
          <p className="pd-shop-filter-acc-note">به‌زودی از کاتالوگ</p>
        </div>
      ))}

      <label className="pd-shop-check">
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => setInStockOnly(e.target.checked)}
        />
        فقط موجود
      </label>

      <button type="button" className="pd-shop-filters-apply" onClick={() => setFiltersOpen(false)}>
        نمایش {products.length.toLocaleString('fa-IR')} محصول
      </button>
    </aside>
  );

  return (
    <ShopChrome bannerTitle={title} bannerLead={lead}>
      <div className="pepito-container pd-shop-listing">
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
