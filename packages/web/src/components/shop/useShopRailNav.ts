/**
 * Horizontal shop rails: L/R buttons + mouse drag-to-scroll.
 * Touch keeps native overflow pan (horizontal + vertical page scroll).
 * "Left" = visual-left (RTL-safe).
 *
 * Hang history (#490 / #510 / this fix):
 * - Pointer capture + missed mouseup left rails in a sticky grab state.
 * - Every scrollLeft tick fired React setState (canPrev/canNext) → main-thread freeze.
 * - scroll-snap fought continuous scrollLeft without is-dragging applied yet.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type ShopRailSide = 'left' | 'right';

type DragPhase = 'idle' | 'pending' | 'dragging';

export function useShopRailNav(resetKey: unknown) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [rtl, setRtl] = useState(true);
  const [hasOverflow, setHasOverflow] = useState(false);
  /** When true, scroll listener must not setState (avoids drag-time freezes). */
  const draggingRef = useRef(false);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) {
      setCanPrev(false);
      setCanNext(false);
      setHasOverflow(false);
      return;
    }
    // Skip React updates while the user is mid-drag — scrollLeft fires dozens
    // of scroll events/sec and re-rendering product rails freezes the page.
    if (draggingRef.current) return;

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

    /**
     * Delay capture until the pointer actually moves — immediate capture was
     * eating clicks on cards and could leave the track's composited layer
     * claiming gestures meant for sibling L/R buttons.
     * Document-level release + buttons===0 recovery prevents stuck grab hangs.
     */
    const DRAG_THRESHOLD_PX = 12;
    let phase: DragPhase = 'idle';
    let moved = false;
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let startScroll = 0;
    let raf = 0;
    let latestX = 0;

    const hardReset = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      const prevId = pointerId;
      phase = 'idle';
      pointerId = null;
      moved = false;
      draggingRef.current = false;
      el.classList.remove('is-dragging');
      if (prevId != null) {
        try {
          if (el.hasPointerCapture?.(prevId)) el.releasePointerCapture(prevId);
        } catch {
          /* already released */
        }
      }
    };

    const endDrag = (e: Event) => {
      if (pointerId == null) return;
      // Pointer events carry an id; mouseup backup has none — treat as matching.
      if (e instanceof PointerEvent && e.pointerId !== pointerId) return;
      const wasDragging = phase === 'dragging';
      const didMove = moved;
      hardReset();
      // Refresh L/R affordances once after the drag settles.
      update();
      if (wasDragging && didMove) {
        // Suppress the click that would open a product/card after a drag.
        const suppress = (ev: Event) => {
          ev.preventDefault();
          ev.stopPropagation();
          el.removeEventListener('click', suppress, true);
        };
        el.addEventListener('click', suppress, true);
        window.setTimeout(() => el.removeEventListener('click', suppress, true), 0);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      // Native touch swipe already works; only emulate drag for mouse/pen.
      if (e.pointerType === 'touch') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Never start a track drag from rail chrome (L/R, pills live outside track,
      // but keep the guard for nested controls).
      const target = e.target;
      if (
        target instanceof Element &&
        target.closest('.pd-shop-rail-btn, .pd-shop-home-rail-pill, button, [role="tab"]')
      ) {
        return;
      }
      // Abort any prior stuck session before arming a new one.
      hardReset();
      phase = 'pending';
      moved = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startScroll = el.scrollLeft;
      latestX = e.clientX;
    };

    const applyScroll = () => {
      raf = 0;
      if (phase !== 'dragging') return;
      el.scrollLeft = startScroll - (latestX - startX);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      if (phase === 'idle') return;

      // Missed pointerup (mouseup outside the window, OS gesture, etc.):
      // pointermove still fires with buttons===0 — clear sticky grab immediately.
      if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
        hardReset();
        update();
        return;
      }

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (phase === 'pending') {
        // Prefer vertical page scroll when the gesture is mostly vertical.
        if (Math.abs(dy) > DRAG_THRESHOLD_PX && Math.abs(dy) > Math.abs(dx) * 1.15) {
          hardReset();
          return;
        }
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        phase = 'dragging';
        moved = true;
        draggingRef.current = true;
        el.classList.add('is-dragging');
        // Capture only after threshold so clicks still work; release is guaranteed
        // via hardReset on pointerup / blur / buttons===0 / lostpointercapture.
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }

      if (phase !== 'dragging') return;
      latestX = e.clientX;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX) moved = true;
      if (!raf) raf = requestAnimationFrame(applyScroll);
      // Avoid selecting text / native image drag while panning.
      e.preventDefault();
    };

    const onLostCapture = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      // Capture was taken away — clear local state without re-releasing.
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      phase = 'idle';
      pointerId = null;
      moved = false;
      draggingRef.current = false;
      el.classList.remove('is-dragging');
      update();
    };

    const onBlurOrHide = () => {
      if (phase === 'idle') return;
      hardReset();
      update();
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') onBlurOrHide();
    };

    // Block native image drag which otherwise fights our pan and can stick.
    const onDragStart = (e: DragEvent) => {
      if (phase !== 'idle') e.preventDefault();
      const t = e.target;
      if (t instanceof HTMLImageElement || (t instanceof Element && t.closest('img, a'))) {
        e.preventDefault();
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    // Document listeners so release outside the track (or window) still clears grab.
    // passive:false on move so preventDefault works while dragging.
    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', endDrag, true);
    document.addEventListener('pointercancel', endDrag, true);
    // Mouseup backup: some environments drop pointerup when the cursor leaves the UI.
    document.addEventListener('mouseup', endDrag, true);
    el.addEventListener('lostpointercapture', onLostCapture as EventListener);
    el.addEventListener('dragstart', onDragStart);
    window.addEventListener('blur', onBlurOrHide);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', endDrag, true);
      document.removeEventListener('pointercancel', endDrag, true);
      document.removeEventListener('mouseup', endDrag, true);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('lostpointercapture', onLostCapture as EventListener);
      el.removeEventListener('dragstart', onDragStart);
      window.removeEventListener('blur', onBlurOrHide);
      document.removeEventListener('visibilitychange', onVisibility);
      hardReset();
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
