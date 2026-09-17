/**
 * App chrome CSS (global + pepito + theme-dark) — not on the landing entry graph.
 * Homepage first paint uses the inlined critical block in index.html; these sheets
 * load after input / long idle on `/`, or immediately on other routes.
 */
let appCssPromise: Promise<void> | null = null;
let shopCssPromise: Promise<void> | null = null;

export function loadAppCss(): Promise<void> {
  if (!appCssPromise) {
    /* theme-dark first so :root light tokens in pepito.css cannot paint dark-on-dark FAQ. */
    appCssPromise = import('./theme-dark.css')
      .then(() => Promise.all([import('./global.css'), import('./pepito.css')]))
      .then(() => undefined);
  }
  return appCssPromise;
}

/** Full /shop chrome — never on the guest homepage entry. */
export function loadShopCss(): Promise<void> {
  if (!shopCssPromise) {
    shopCssPromise = Promise.all([
      loadAppCss(),
      import('./pepito-shop.css'),
      import('./theme-dark-shop.css'),
    ]).then(() => undefined);
  }
  return shopCssPromise;
}

/** Homepage: keep full chrome CSS off the Lighthouse unused-css / critical path. */
export function scheduleLandingAppCss(): void {
  if (typeof window === 'undefined') return;
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    void loadAppCss();
  };
  const arm = () => {
    window.setTimeout(go, 8000);
    for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) {
      window.addEventListener(ev, go, { once: true, passive: true });
    }
  };
  if (document.readyState === 'complete') arm();
  else window.addEventListener('load', arm, { once: true });
}
