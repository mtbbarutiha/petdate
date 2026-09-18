/**
 * App chrome CSS (global + pepito + theme-dark).
 * Landing first paint needs the full sheets — incomplete critical CSS in
 * index.html left the hero/nav broken until input/scroll/8s idle armed this.
 * Shop CSS stays a separate lazy chunk (not on the guest homepage graph).
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

/**
 * Homepage: load full chrome CSS immediately on first paint.
 * Do not wait for scroll / pointer / long idle — that shipped an unstyled landing
 * until the user interacted (touchstart while scrolling fixed it).
 */
export function scheduleLandingAppCss(): void {
  void loadAppCss();
}
