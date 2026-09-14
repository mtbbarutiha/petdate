import { useCallback, useEffect, useRef, useState } from 'react';

export type ShopRailSide = 'left' | 'right';

/**
 * Horizontal shop rails: L/R buttons + mouse drag-to-scroll.
 * Touch keeps native overflow pan-x. "Left" = visual-left (RTL-safe).
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

  /** Mouse / pen drag-to-scroll (touch already pans via overflow-x + touch-action). */
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    let dragging = false;
    let moved = false;
    let pointerId: number | null = null;
    let startX = 0;
    let startScroll = 0;

    const endDrag = (e: PointerEvent) => {
      if (!dragging || pointerId !== e.pointerId) return;
      dragging = false;
      pointerId = null;
      el.classList.remove('is-dragging');
      try {
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      if (moved) {
        // Suppress the click that would open a product/card after a drag.
        const suppress = (ev: Event) => {
          ev.preventDefault();
          ev.stopPropagation();
          el.removeEventListener('click', suppress, true);
        };
        el.addEventListener('click', suppress, true);
        window.setTimeout(() => el.removeEventListener('click', suppress, true), 0);
      }
      moved = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      // Native touch swipe already works; only emulate drag for mouse/pen.
      if (e.pointerType === 'touch') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Don't steal clicks from rail L/R buttons (they sit outside the track).
      dragging = true;
      moved = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startScroll = el.scrollLeft;
      el.classList.add('is-dragging');
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging || pointerId !== e.pointerId) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      // Same delta formula works for LTR and Chromium/Firefox RTL scrollLeft.
      el.scrollLeft = startScroll - dx;
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('lostpointercapture', endDrag as EventListener);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endDrag);
      el.removeEventListener('pointercancel', endDrag);
      el.removeEventListener('lostpointercapture', endDrag as EventListener);
      el.classList.remove('is-dragging');
    };
  }, [resetKey]);

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
