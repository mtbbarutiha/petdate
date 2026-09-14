/**
 * DigiKala-style shop breadcrumb trail helpers.
 * Hierarchy: brand home → shop → pet type → category → product
 */
import { SEO } from '@petdate/shared';
import {
  SHOP_PET_TYPES,
  getCategory,
  type ShopCategory,
  type ShopPetType,
  type ShopProduct,
} from '../data/shopCatalog';
import { productTitleForLang, shopLabel } from './shopLocale';

export type ShopBreadcrumbItem = {
  /** Display label (already localized). */
  label: string;
  /** Route for ancestors; omit on the current page crumb. */
  to?: string;
};

export type ShopBreadcrumbLang = 'fa' | 'en';

const PET_HUB: Record<Exclude<ShopPetType, 'all'>, string> = {
  dog: '/shop/c/all?pet=dog',
  cat: '/shop/c/all?pet=cat',
  bird: '/shop/c/all?pet=bird',
  rodent: '/shop/c/all?pet=rodent',
};

export function petTypeLabel(lang: ShopBreadcrumbLang, pet: Exclude<ShopPetType, 'all'>): string {
  const row = SHOP_PET_TYPES.find((p) => p.id === pet);
  return shopLabel(lang, row?.labelFa ?? pet, row?.labelEn);
}

export function petTypeHref(pet: Exclude<ShopPetType, 'all'>): string {
  return PET_HUB[pet];
}

function homeCrumb(lang: ShopBreadcrumbLang): ShopBreadcrumbItem {
  return {
    label: lang === 'en' ? 'PetDate' : SEO.siteName,
    to: '/',
  };
}

function shopCrumb(lang: ShopBreadcrumbLang, current = false): ShopBreadcrumbItem {
  return {
    label: lang === 'en' ? 'Shop' : 'شاپ',
    ...(current ? {} : { to: '/shop' }),
  };
}

/** Shop landing: پت‌دیت / شاپ */
export function shopHomeBreadcrumbs(lang: ShopBreadcrumbLang = 'fa'): ShopBreadcrumbItem[] {
  return [homeCrumb(lang), shopCrumb(lang, true)];
}

/**
 * Category listing trail.
 * e.g. پت‌دیت / شاپ / گربه / غذای گربه
 * or   پت‌دیت / شاپ / گربه   (when /shop/c/all?pet=cat)
 * or   پت‌دیت / شاپ / همه محصولات
 */
export function shopCategoryBreadcrumbs(opts: {
  lang?: ShopBreadcrumbLang;
  categorySlug?: string | null;
  /** Active pet filter when browsing /shop/c/all?pet=… */
  petType?: ShopPetType | null;
  /** Localized fallback for the “all products” crumb. */
  allProductsLabel?: string;
}): ShopBreadcrumbItem[] {
  const lang = opts.lang ?? 'fa';
  const items: ShopBreadcrumbItem[] = [homeCrumb(lang), shopCrumb(lang)];

  const cat =
    opts.categorySlug && opts.categorySlug !== 'all'
      ? getCategory(opts.categorySlug)
      : undefined;

  if (cat) {
    items.push({
      label: petTypeLabel(lang, cat.petType),
      to: petTypeHref(cat.petType),
    });
    items.push({
      label: shopLabel(lang, cat.labelFa, cat.labelEn),
    });
    return items;
  }

  const petFilter = opts.petType && opts.petType !== 'all' ? opts.petType : null;

  if (petFilter) {
    items.push({
      label: petTypeLabel(lang, petFilter),
    });
    return items;
  }

  items.push({
    label: opts.allProductsLabel ?? (lang === 'en' ? 'All products' : 'همه محصولات'),
  });
  return items;
}

/** Product detail trail including category ancestors + product title (current). */
export function shopProductBreadcrumbs(opts: {
  lang?: ShopBreadcrumbLang;
  product: ShopProduct;
  category?: ShopCategory | null;
}): ShopBreadcrumbItem[] {
  const lang = opts.lang ?? 'fa';
  const category = opts.category ?? getCategory(opts.product.categorySlug) ?? null;
  const items: ShopBreadcrumbItem[] = [homeCrumb(lang), shopCrumb(lang)];

  if (category) {
    items.push({
      label: petTypeLabel(lang, category.petType),
      to: petTypeHref(category.petType),
    });
    items.push({
      label: shopLabel(lang, category.labelFa, category.labelEn),
      to: `/shop/c/${category.slug}`,
    });
  }

  items.push({
    label: productTitleForLang(lang, opts.product.title, {
      titleEn: opts.product.titleEn,
      slug: opts.product.slug,
    }),
  });
  return items;
}

/** SEO / JSON-LD paths for the same hierarchy (always include path on every crumb). */
export function shopSeoBreadcrumbItems(opts: {
  categorySlug?: string | null;
  product?: Pick<ShopProduct, 'title' | 'slug' | 'id' | 'categorySlug'> | null;
}): { name: string; path: string }[] {
  const out: { name: string; path: string }[] = [
    { name: SEO.siteName, path: '/' },
    { name: 'شاپ', path: '/shop' },
  ];

  if (opts.product) {
    const cat = getCategory(opts.product.categorySlug);
    if (cat) {
      out.push({ name: petTypeLabel('fa', cat.petType), path: petTypeHref(cat.petType) });
      out.push({ name: cat.labelFa, path: `/shop/c/${cat.slug}` });
    }
    out.push({
      name: opts.product.title,
      path: `/shop/product/${opts.product.slug || opts.product.id}`,
    });
    return out;
  }

  // Shop home: only brand + شاپ (no categorySlug / product passed).
  if (opts.categorySlug === undefined) {
    return out;
  }

  const slug = opts.categorySlug;
  if (!slug || slug === 'all') {
    out.push({ name: 'همه محصولات', path: '/shop/c/all' });
    return out;
  }

  const cat = getCategory(slug);
  if (cat) {
    out.push({ name: petTypeLabel('fa', cat.petType), path: petTypeHref(cat.petType) });
    out.push({ name: cat.labelFa, path: `/shop/c/${cat.slug}` });
  }
  return out;
}
