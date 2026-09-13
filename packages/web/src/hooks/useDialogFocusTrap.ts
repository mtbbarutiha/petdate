import { useEffect, useRef } from 'react';
import { dialogFocusables, initialDialogFocusTarget } from '../lib/dialogFocus';

/**
 * Esc + Tab trap, overflow lock, restore focus on close.
 * Initial focus runs once when `active` becomes true — not when the
 * parent re-renders with a new inline onClose/onCancel (every keystroke).
 */
export function useDialogFocusTrap(opts: {
  active: boolean;
  panelRef: { readonly current: HTMLElement | null };
  onDismiss: () => void;
  busy?: boolean;
}): void {
  const { active, panelRef, onDismiss, busy = false } = opts;
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onDismissRef = useRef(onDismiss);
  const busyRef = useRef(busy);
  onDismissRef.current = onDismiss;
  busyRef.current = busy;

  useEffect(() => {
    if (!active) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      initialDialogFocusTarget(panelRef.current)?.focus?.();
    }, 0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
    // Only `active`: callers pass inline onDismiss that changes every keystroke.
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) {
        e.preventDefault();
        onDismissRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = dialogFocusables(panelRef.current);
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);
}
