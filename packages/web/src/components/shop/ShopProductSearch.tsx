import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  filterProducts,
  formatToman,
  getBrand,
  type ShopProduct,
} from '../../data/shopCatalog';
import { useI18n } from '../../i18n';
import { productTitleForLang } from '../../lib/shopLocale';
import {
  SHOP_SEARCH_DROPDOWN_LIMIT,
  isShopSearchHotkey,
  shopProductPath,
  shopSearchResultsPath,
} from '../../lib/shopProductSearch';

function productThumb(p: ShopProduct): string {
  return p.images?.[0] || p.image || '/media/shop/petdate-shop-hero.jpg';
}

/**
 * DigiKala-style RTL shop search: compact pill under the logo, expands on
 * focus/typing, live dropdown, Ctrl/Cmd+K focus, Enter → /shop/c/all?q=.
 */
export function ShopProductSearch() {
  const { lang, t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const qFromUrl = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(qFromUrl);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setQuery(qFromUrl);
  }, [qFromUrl]);

  const results = useMemo(() => {
    const q = query.trim();
    if (q.length < 1) return [] as ShopProduct[];
    return filterProducts({ q }).slice(0, SHOP_SEARCH_DROPDOWN_LIMIT);
  }, [query]);

  const totalMatches = useMemo(() => {
    const q = query.trim();
    if (q.length < 1) return 0;
    return filterProducts({ q }).length;
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isShopSearchHotkey(e)) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) &&
          target !== inputRef.current
        ) {
          return;
        }
      }
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
      setOpen(true);
      setFocused(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, []);

  const goResults = (q: string) => {
    setOpen(false);
    setActiveIndex(-1);
    navigate(shopSearchResultsPath(q));
  };

  const goProduct = (slug: string) => {
    setOpen(false);
    setActiveIndex(-1);
    navigate(shopProductPath(slug));
  };

  const showDropdown = open && query.trim().length > 0;
  const expanded = focused || open || query.trim().length > 0;

  return (
    <div
      className={`pd-shop-search${expanded ? ' is-expanded' : ''}`}
      ref={rootRef}
      data-testid="shop-product-search"
    >
      <form
        className="pd-shop-search-pill"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (activeIndex >= 0 && results[activeIndex]) {
            goProduct(results[activeIndex].slug);
            return;
          }
          goResults(query);
        }}
      >
        <Search className="pd-shop-search-icon" size={18} strokeWidth={2} aria-hidden />
        <input
          ref={inputRef}
          type="search"
          className="pd-shop-search-input"
          value={query}
          placeholder={t('shop.search')}
          aria-label={t('shop.search')}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showDropdown}
          enterKeyHint="search"
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            setOpen(true);
            setFocused(true);
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!rootRef.current?.contains(document.activeElement)) {
                setFocused(false);
              }
            }, 0);
          }}
          onKeyDown={(e) => {
            if (!showDropdown) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, -1));
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setOpen(false);
              setActiveIndex(-1);
            }
          }}
        />
      </form>

      {showDropdown ? (
        <div className="pd-shop-search-dropdown" id={listId} role="listbox" aria-label={t('shop.search')}>
          {results.length === 0 ? (
            <p className="pd-shop-search-empty">{t('shop.searchEmpty')}</p>
          ) : (
            <ul className="pd-shop-search-list">
              {results.map((p, index) => {
                const brand = getBrand(p.brandId);
                const title = productTitleForLang(lang, p.title, {
                  titleEn: p.titleEn,
                  slug: p.slug,
                });
                return (
                  <li key={p.id} role="option" aria-selected={index === activeIndex}>
                    <Link
                      to={shopProductPath(p.slug)}
                      className={`pd-shop-search-hit${index === activeIndex ? ' is-active' : ''}`}
                      onClick={() => {
                        setOpen(false);
                        setActiveIndex(-1);
                      }}
                    >
                      <img
                        src={productThumb(p)}
                        alt=""
                        width={44}
                        height={44}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="pd-shop-search-hit-copy">
                        <strong>{title}</strong>
                        <span>
                          {brand
                            ? lang === 'en'
                              ? brand.labelEn || brand.labelFa
                              : brand.labelFa
                            : ''}
                          {brand ? ' · ' : ''}
                          {formatToman(p.priceToman)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <button type="button" className="pd-shop-search-all" onClick={() => goResults(query)}>
            {t('shop.searchSeeAll', { n: String(totalMatches) })}
          </button>
        </div>
      ) : null}
    </div>
  );
}
