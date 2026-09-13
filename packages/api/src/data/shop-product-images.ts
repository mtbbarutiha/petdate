/**
 * Shop product gallery URLs — stored in params.__images (pipe-separated)
 * and exposed as first-class images[] on API rows.
 */
export const SHOP_IMAGES_PARAM = '__images';

function pushUnique(out: string[], seen: Set<string>, raw: unknown): void {
  const src = String(raw ?? '').trim();
  if (!src || seen.has(src)) return;
  seen.add(src);
  out.push(src);
}

/** Unique, non-empty gallery srcs from images[] + params.__images + cover image. */
export function parseShopProductImages(input: {
  images?: unknown;
  image?: unknown;
  params?: Record<string, unknown> | null;
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  if (Array.isArray(input.images)) {
    for (const raw of input.images) pushUnique(out, seen, raw);
  } else if (typeof input.images === 'string') {
    for (const part of input.images.split('|')) pushUnique(out, seen, part);
  }
  const fromParams = input.params?.[SHOP_IMAGES_PARAM];
  if (typeof fromParams === 'string') {
    for (const part of fromParams.split('|')) pushUnique(out, seen, part);
  }
  pushUnique(out, seen, input.image);
  return out;
}

export function withShopImagesParam(
  params: Record<string, string>,
  images: string[] | undefined
): Record<string, string> {
  const next = { ...params };
  if (images?.length) {
    next[SHOP_IMAGES_PARAM] = images.filter((s) => String(s ?? '').trim()).join('|');
  }
  return next;
}

/** Hide internal __* keys (gallery, highlights, …) from public catalog params. */
export function publicShopParams(params: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(params).filter(([k]) => !k.startsWith('__')));
}

/**
 * Same packshot, distinct query strings — placeholder until 3-angle assets arrive.
 * productGallery / parseShopProductImages dedupe by exact src, so angles must differ.
 */
export function placeholderGalleryAngles(image: string): string[] {
  const cover = String(image ?? '').trim();
  if (!cover) return [];
  const sep = cover.includes('?') ? '&' : '?';
  return [cover, `${cover}${sep}angle=2`, `${cover}${sep}angle=3`];
}
