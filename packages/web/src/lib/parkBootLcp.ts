/**
 * The HTML LCP <img id="pd-boot-lcp"> lives outside #root for homepage first paint.
 * On home + slide 0 it stays visible (React must not display:none it — that caused
 * multi-second LCP "element render delay"). Park only when leaving slide 0 / home.
 * On every other route it must be parked immediately — otherwise a full-viewport
 * dog photo covers shop, FAQ, magazine, auth, etc.
 */

export const BOOT_LCP_OWNED_ATTR = 'data-pd-react-owned';

export function isHomePath(pathname: string): boolean {
  const p = pathname.split('?')[0]?.split('#')[0] || '/';
  return p === '/' || p === '';
}

/** Hide the out-of-root boot LCP node (idempotent). Marks React as owner so boot scripts cannot unpark. */
export function parkBootLcp(): void {
  if (typeof document === 'undefined') return;
  const img = document.getElementById('pd-boot-lcp');
  if (!img) return;
  img.classList.add('is-parked');
  img.setAttribute(BOOT_LCP_OWNED_ATTR, '1');
}

/** Show the boot LCP again (home slide 0). Clears React ownership so layout matches first paint. */
export function unparkBootLcp(): void {
  if (typeof document === 'undefined') return;
  const img = document.getElementById('pd-boot-lcp');
  if (!img) return;
  img.classList.remove('is-parked');
  img.removeAttribute(BOOT_LCP_OWNED_ATTR);
}

export function isBootLcpOwnedByReact(): boolean {
  if (typeof document === 'undefined') return false;
  const img = document.getElementById('pd-boot-lcp');
  return img?.getAttribute(BOOT_LCP_OWNED_ATTR) === '1';
}
