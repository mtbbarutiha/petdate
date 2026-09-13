/** Wrap gallery index for slider / lightbox arrows. */
export function stepShopGalleryIndex(index: number, length: number, delta: number): number {
  if (!Number.isFinite(length) || length <= 0) return 0;
  const i = Number.isFinite(index) ? Math.trunc(index) : 0;
  const d = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  return ((i + d) % length + length) % length;
}

export const SHOP_GALLERY_SWIPE_PX = 40;

/** Pointer drag on the main well: swipe changes slide, a tap/click opens lightbox. */
export function shopGalleryPointerIntent(
  dx: number,
  multi: boolean,
  swipePx = SHOP_GALLERY_SWIPE_PX
): 'next' | 'prev' | 'open' {
  if (multi && Number.isFinite(dx) && Math.abs(dx) > swipePx) {
    return dx < 0 ? 'next' : 'prev';
  }
  return 'open';
}
