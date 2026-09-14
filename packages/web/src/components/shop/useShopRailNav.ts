import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Horizontal shop rails: hide native overflow, navigate with L/R buttons.
 * Programmatic scroll still works with overflow-x: hidden.
 */
export function useShopRailNav(resetKey: unknown) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) {
      setCanPrev(false);
      setCanNext(false);
      setHasOverflow(false);
      return;
    }
    const max = el.scrollWidth - el.clientWidth;
    const overflow = max > 8;
    setHasOverflow(overflow);
    if (!overflow) {
      setCanPrev(false);
      setCanNext(false);
      return;
    }
    const left = el.scrollLeft;
    const rtl = getComputedStyle(el).direction === 'rtl';
    if (rtl) {
      // Chromium RTL: start ≈ 0, further items → negative scrollLeft.
      setCanPrev(left < -4);
      setCanNext(left > -max + 4);
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
    const rtl = getComputedStyle(el).direction === 'rtl';
    const nextSign = rtl ? -1 : 1;
    const sign = dir === 'next' ? nextSign : -nextSign;
    el.scrollBy({ left: sign * amount, behavior: 'smooth' });
  };

  return { trackRef, canPrev, canNext, hasOverflow, scrollByDir, update };
}
