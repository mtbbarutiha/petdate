import { useEffect, useState } from 'react';

let hydratePromise: Promise<boolean> | null = null;

/** True for /shop and nested shop routes (not admin). */
export function isShopPath(pathname: string): boolean {
  const p = pathname.split('?')[0]?.split('#')[0] || '/';
  return p === '/shop' || p.startsWith('/shop/');
}

/** Guest marketing home — must not pull /api/shop onto the LCP critical path. */
export function isLandingHomePath(pathname: string): boolean {
  const p = pathname.split('?')[0]?.split('#')[0] || '/';
  return p === '/' || p === '' || p === '/welcome';
}

/**
 * Shared hydrate — call only from shop routes, landing #shop intersection,
 * or an explicit user action. Never schedule from ShopCartProvider on `/`.
 * Dynamic-imports shopCatalog so the static product seed stays off the landing entry.
 */
export async function hydrateShopCatalogOnce(): Promise<boolean> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const catalog = await import('../data/shopCatalog');
        if (catalog.isShopCatalogHydrated()) return true;
        const { fetchPublicShopCatalog } = await import('../lib/api');
        const data = await fetchPublicShopCatalog();
        if (!data.products?.length) return false;
        catalog.applyLiveShopCatalog({
          products: data.products,
          categories: data.categories,
          brands: data.brands,
        });
        return true;
      } catch {
        return false;
      }
    })();
  }
  return hydratePromise;
}

/** Hydrate shop listing helpers from /api/shop (DB) so web matches bot. */
export function useShopCatalogSync(): { ready: boolean; synced: boolean } {
  const [ready, setReady] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void hydrateShopCatalogOnce().then((ok) => {
      if (cancelled) return;
      setSynced(ok);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, synced };
}
