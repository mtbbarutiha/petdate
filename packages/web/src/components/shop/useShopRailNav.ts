import { useCallback, useEffect, useRef, useState } from 'react';

export type ShopRailSide = 'left' | 'right';

/**
 * Horizontal shop rails: hide native overflow, navigate with physical L/R buttons.
 * "Left" always means visual-left (content toward the left edge), including RTL.
 */
export function useShopRailNav(resetKey: unknown) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [rtl, setRtl] = useState(true);
  const [hasOverflow, setHasOverflow] = useState(false);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) {
      setCanPrev(false);
      setCanNext(false);
      setHasOverflow(false);
      return;
    }
    const isRtl = getComputedStyle(el).direction === 'rtl';
    setRtl(isRtl);
    const max = el.scrollWidth - el.clientWidth;
    const overflow = max > 8;
    setHasOverflow(overflow);
    if (!overflow) {
      setCanPrev(false);
      setCanNext(false);
      return;
    }
    const left = el.scrollLeft;
    if (isRtl) {
      // Chromium RTL: start ≈ 0, further items → negative scrollLeft.
      // Firefox RTL: start ≈ 0, further items → positive scrollLeft.
      if (left < -4) {
        setCanPrev(true);
        setCanNext(left > -max + 4);
      } else {
        setCanPrev(left > 4);
        setCanNext(left < max - 4 || left <= 4);
      }
    } else {
      setCanPrev(left > 4);
      setCanNext(left < max - 4);
    }
  }, []);

  useEffect(() => {
    update();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [resetKey, update]);

  const scrollByDir = (dir: 'next' | 'prev') => {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.max(220, Math.round(el.clientWidth * 0.7));
    const isRtl = getComputedStyle(el).direction === 'rtl';
    const left = el.scrollLeft;
    const nextSign = isRtl ? (left < -1 ? -1 : 1) : 1;
    const sign = dir === 'next' ? nextSign : -nextSign;
    // Coarse pointers: instant scroll — iOS often drops smooth scrollBy mid-gesture.
    const coarse =
      typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
    el.scrollBy({ left: sign * amount, behavior: coarse ? 'auto' : 'smooth' });
  };

  /** Physical left/right — left button always reveals visual-left content. */
  const scrollBySide = (side: ShopRailSide) => {
    const el = trackRef.current;
    const isRtl = el ? getComputedStyle(el).direction === 'rtl' : rtl;
    if (side === 'left') scrollByDir(isRtl ? 'next' : 'prev');
    else scrollByDir(isRtl ? 'prev' : 'next');
  };

  const canLeft = rtl ? canNext : canPrev;
  const canRight = rtl ? canPrev : canNext;

  return {
    trackRef,
    canPrev,
    canNext,
    canLeft,
    canRight,
    hasOverflow,
    scrollByDir,
    scrollBySide,
    update,
  };
}
