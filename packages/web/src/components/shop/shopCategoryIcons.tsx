/**
 * Unique SVG illustrations per shop category slug.
 * Do NOT reuse product packshots — each tile must look distinct (dog food ≠ cat food, etc.).
 */
export type ShopCategoryArtKind =
  | 'dog-food'
  | 'dog-treats'
  | 'dog-groom'
  | 'dog-toys'
  | 'dog-bowls'
  | 'dog-travel'
  | 'dog-collars'
  | 'dog-clothes'
  | 'dog-shield'
  | 'dog-beds'
  | 'cat-food'
  | 'cat-treats'
  | 'cat-groom'
  | 'cat-toys'
  | 'cat-trees'
  | 'cat-bowls'
  | 'cat-litter'
  | 'cat-travel'
  | 'cat-beds'
  | 'cat-shield'
  | 'bird'
  | 'rodent'
  | 'more';

const BY_SLUG: Record<string, ShopCategoryArtKind> = {
  'dog-food': 'dog-food',
  'dog-treats': 'dog-treats',
  'dog-grooming': 'dog-groom',
  grooming: 'dog-groom',
  'dog-toys': 'dog-toys',
  'dog-bowls': 'dog-bowls',
  'dog-carriers-travel': 'dog-travel',
  'dog-carriers': 'dog-travel',
  'dog-collars': 'dog-collars',
  'dog-accessories': 'dog-collars',
  'dog-clothing': 'dog-clothes',
  'dog-flea-tick': 'dog-shield',
  'dog-beds': 'dog-beds',
  'cat-food': 'cat-food',
  'cat-treats': 'cat-treats',
  'cat-grooming': 'cat-groom',
  'cat-toys': 'cat-toys',
  'cat-trees': 'cat-trees',
  'cat-bowls': 'cat-bowls',
  'cat-accessories': 'cat-bowls',
  'cat-litter': 'cat-litter',
  'cat-carriers-travel': 'cat-travel',
  'cat-carriers': 'cat-travel',
  'cat-beds': 'cat-beds',
  'cat-flea-tick': 'cat-shield',
  'bird-food': 'bird',
  'bird-accessories': 'bird',
  'rodent-supplies': 'rodent',
};

export function shopCategoryArtKind(slug: string): ShopCategoryArtKind {
  return BY_SLUG[slug] ?? 'more';
}

/** Public URL for optional raster fallback (SVG is preferred). */
export const SHOP_CATEGORY_ILLUSTRATION: Record<ShopCategoryArtKind, string> = {
  'dog-food': '/media/shop/categories/illustrations/dog-food.svg',
  'dog-treats': '/media/shop/categories/illustrations/dog-treats.svg',
  'dog-groom': '/media/shop/categories/illustrations/dog-groom.svg',
  'dog-toys': '/media/shop/categories/illustrations/dog-toys.svg',
  'dog-bowls': '/media/shop/categories/illustrations/dog-bowls.svg',
  'dog-travel': '/media/shop/categories/illustrations/dog-travel.svg',
  'dog-collars': '/media/shop/categories/illustrations/dog-collars.svg',
  'dog-clothes': '/media/shop/categories/illustrations/dog-clothes.svg',
  'dog-shield': '/media/shop/categories/illustrations/dog-shield.svg',
  'dog-beds': '/media/shop/categories/illustrations/dog-beds.svg',
  'cat-food': '/media/shop/categories/illustrations/cat-food.svg',
  'cat-treats': '/media/shop/categories/illustrations/cat-treats.svg',
  'cat-groom': '/media/shop/categories/illustrations/cat-groom.svg',
  'cat-toys': '/media/shop/categories/illustrations/cat-toys.svg',
  'cat-trees': '/media/shop/categories/illustrations/cat-trees.svg',
  'cat-bowls': '/media/shop/categories/illustrations/cat-bowls.svg',
  'cat-litter': '/media/shop/categories/illustrations/cat-litter.svg',
  'cat-travel': '/media/shop/categories/illustrations/cat-travel.svg',
  'cat-beds': '/media/shop/categories/illustrations/cat-beds.svg',
  'cat-shield': '/media/shop/categories/illustrations/cat-shield.svg',
  bird: '/media/shop/categories/illustrations/bird.svg',
  rodent: '/media/shop/categories/illustrations/rodent.svg',
  more: '/media/shop/categories/illustrations/more.svg',
};

export function shopCategoryPhoto(kind: ShopCategoryArtKind): string {
  return SHOP_CATEGORY_ILLUSTRATION[kind] ?? SHOP_CATEGORY_ILLUSTRATION.more;
}

/** @deprecated use shopCategoryPhoto — kept for older imports/tests */
export const SHOP_CATEGORY_PHOTOS = SHOP_CATEGORY_ILLUSTRATION;

type PhotoProps = {
  kind: ShopCategoryArtKind;
  alt?: string;
};

/** Category tile art — unique SVG illustration (never shared packshots). */
export function ShopCategoryArt({ kind, alt = '' }: PhotoProps) {
  return (
    <img
      className="pd-shop-dk-photo"
      src={shopCategoryPhoto(kind)}
      alt={alt}
      width={320}
      height={320}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}

export function ShopCategoryMoreArt() {
  return <ShopCategoryArt kind="more" />;
}
