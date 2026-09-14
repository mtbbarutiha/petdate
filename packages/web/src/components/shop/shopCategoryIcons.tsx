/** Real product photos for shop category tiles (square crops under /media/shop/categories). */
export type ShopCategoryArtKind =
  | 'food'
  | 'treats'
  | 'groom'
  | 'toys'
  | 'bowls'
  | 'travel'
  | 'collars'
  | 'clothes'
  | 'shield'
  | 'beds'
  | 'trees'
  | 'litter'
  | 'bird'
  | 'rodent'
  | 'more';

const BY_SLUG: Record<string, ShopCategoryArtKind> = {
  'dog-food': 'food',
  'dog-treats': 'treats',
  'dog-grooming': 'groom',
  'dog-toys': 'toys',
  'dog-bowls': 'bowls',
  'dog-carriers-travel': 'travel',
  'dog-carriers': 'travel',
  'dog-collars': 'collars',
  'dog-accessories': 'collars',
  grooming: 'groom',
  'dog-clothing': 'clothes',
  'dog-flea-tick': 'shield',
  'dog-beds': 'beds',
  'cat-food': 'food',
  'cat-treats': 'treats',
  'cat-grooming': 'groom',
  'cat-toys': 'toys',
  'cat-trees': 'trees',
  'cat-bowls': 'bowls',
  'cat-accessories': 'bowls',
  'cat-litter': 'litter',
  'cat-carriers-travel': 'travel',
  'cat-carriers': 'travel',
  'cat-beds': 'beds',
  'cat-flea-tick': 'shield',
  'bird-food': 'bird',
  'bird-accessories': 'bird',
  'rodent-supplies': 'rodent',
};

export function shopCategoryArtKind(slug: string): ShopCategoryArtKind {
  return BY_SLUG[slug] ?? 'more';
}

const PHOTO_BASE = '/media/shop/categories';

/** Optimized square product photos for each category art kind. */
export const SHOP_CATEGORY_PHOTOS: Record<ShopCategoryArtKind, string> = {
  food: `${PHOTO_BASE}/food.jpg`,
  treats: `${PHOTO_BASE}/treats.jpg`,
  groom: `${PHOTO_BASE}/groom.jpg`,
  toys: `${PHOTO_BASE}/toys.jpg`,
  bowls: `${PHOTO_BASE}/bowls.jpg`,
  travel: `${PHOTO_BASE}/travel.jpg`,
  collars: `${PHOTO_BASE}/collars.jpg`,
  clothes: `${PHOTO_BASE}/clothes.jpg`,
  shield: `${PHOTO_BASE}/shield.jpg`,
  beds: `${PHOTO_BASE}/beds.jpg`,
  trees: `${PHOTO_BASE}/trees.jpg`,
  litter: `${PHOTO_BASE}/litter.jpg`,
  bird: `${PHOTO_BASE}/bird.jpg`,
  rodent: `${PHOTO_BASE}/rodent.jpg`,
  more: `${PHOTO_BASE}/more.jpg`,
};

export function shopCategoryPhoto(kind: ShopCategoryArtKind): string {
  return SHOP_CATEGORY_PHOTOS[kind] ?? SHOP_CATEGORY_PHOTOS.more;
}

type PhotoProps = {
  kind: ShopCategoryArtKind;
  alt?: string;
};

/** Category tile photo — real pet-product packshot (not cartoon SVG). */
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
