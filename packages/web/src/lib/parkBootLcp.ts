/**
 * The HTML LCP <img id="pd-boot-lcp"> lives outside #root for homepage first paint.
 * WelcomePage parks it once React owns the in-hero photo. On every other route it
 * must be parked immediately — otherwise a full-viewport dog photo covers shop,
 * FAQ, magazine, auth, etc.
 */
export function isHomePath(pathname: string): boolean {
  const p = pathname.split('?')[0]?.split('#')[0] || '/';
  return p === '/' || p === '';
}

/** Hide the out-of-root boot LCP node (idempotent). */
export function parkBootLcp(): void {
  if (typeof document === 'undefined') return;
  const img = document.getElementById('pd-boot-lcp');
  if (!img) return;
  img.classList.add('is-parked');
}
