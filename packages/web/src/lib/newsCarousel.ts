/** Homepage magazine carousel math — kept pure so RTL scroll + page wrap can be tested. */

export const NEWS_GAP_PX = 20;

export function newsCarouselPages(itemCount: number, visibleCount: number): number {
  return Math.max(1, itemCount - Math.max(1, visibleCount) + 1);
}

export function wrapCarouselIndex(index: number, pages: number): number {
  if (pages <= 1) return 0;
  return ((index % pages) + pages) % pages;
}

export function newsCarouselScrollLeft(index: number, stepPx: number, rtl: boolean): number {
  const offset = Math.max(0, index) * Math.max(0, stepPx);
  if (offset === 0) return 0;
  return rtl ? -offset : offset;
}

export function newsCarouselIndexFromScroll(
  scrollLeft: number,
  stepPx: number,
  rtl: boolean,
  pages: number
): number {
  if (stepPx <= 0 || pages <= 1) return 0;
  const raw = rtl ? -scrollLeft : scrollLeft;
  const idx = Math.round(raw / stepPx);
  return Math.max(0, Math.min(pages - 1, idx));
}

export function newsCarouselVisibleCount(
  trackWidth: number,
  cardWidth: number,
  gap = NEWS_GAP_PX
): number {
  const step = cardWidth + gap;
  if (step <= 0) return 1;
  return Math.max(1, Math.round((trackWidth + gap) / step));
}
