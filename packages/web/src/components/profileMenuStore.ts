/**
 * One account menu for every avatar (header, mobile dock, chat chrome).
 * Anchors only toggle this flag — ProfileMenu renders the single panel.
 */
type Listener = () => void;

let open = false;
let anchor: HTMLElement | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeProfileMenu(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getProfileMenuOpen() {
  return open;
}

export function getProfileMenuAnchor() {
  return anchor;
}

export function toggleProfileMenu(nextAnchor?: HTMLElement | null) {
  if (open) {
    open = false;
    anchor = null;
  } else {
    open = true;
    anchor = nextAnchor ?? null;
  }
  emit();
}

export function closeProfileMenu() {
  if (!open && anchor == null) return;
  open = false;
  anchor = null;
  emit();
}
