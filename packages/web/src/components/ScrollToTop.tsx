import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * On every route change, jump to the top of the page (and common app scroll roots).
 * Skips hash-only navigation so in-page anchors still work.
 */
export function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash) return;

    const scrollRoots = [
      document.scrollingElement,
      document.documentElement,
      document.body,
      document.querySelector('.pepito-app-main'),
      document.querySelector('.pd-shop-main'),
      document.querySelector('.pepito-flow-panel'),
    ].filter(Boolean) as Element[];

    for (const el of scrollRoots) {
      if ('scrollTo' in el) {
        try {
          (el as Element & { scrollTo: (o: ScrollToOptions) => void }).scrollTo({
            top: 0,
            left: 0,
            behavior: 'auto',
          });
        } catch {
          (el as HTMLElement).scrollTop = 0;
          (el as HTMLElement).scrollLeft = 0;
        }
      } else {
        (el as HTMLElement).scrollTop = 0;
        (el as HTMLElement).scrollLeft = 0;
      }
    }

    window.scrollTo(0, 0);
  }, [pathname, search, hash]);

  return null;
}
