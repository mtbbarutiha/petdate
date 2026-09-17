import { useEffect, useState } from 'react';
import {
  applyLiveShopCatalog,
  isShopCatalogHydrated,
} from '../data/shopCatalog';

let hydratePromise: Promise<boolean> | null = null;

function scheduleAfterLoadIdle(run: () => void) {
  if (typeof window === 'undefined') {
    run();
    return;
  }
  const arm = () => {
    window.setTimeout(run, 2500);
  };
  if (document.readyState === 'complete') arm();
  else window.addEventListener('load', arm, { once: true });
}

/** Shared hydrate — shop chrome + cart provider (cart runs on every route).
 *  Catalog fetch is deferred until after load+idle so the guest homepage
 *  does not pull /api/shop onto the LCP critical path. */
export async function hydrateShopCatalogOnce(): Promise<boolean> {
  if (isShopCatalogHydrated()) return true;
  if (!hydratePromise) {
    hydratePromise = new Promise((resolve) => {
      scheduleAfterLoadIdle(() => {
        void (async () => {
          try {
            const { fetchPublicShopCatalog } = await import('../lib/api');
            const data = await fetchPublicShopCatalog();
            if (!data.products?.length) {
              resolve(false);
              return;
            }
            applyLiveShopCatalog({
              products: data.products,
              categories: data.categories,
              brands: data.brands,
            });
            resolve(true);
          } catch {
            resolve(false);
          }
        })();
      });
    });
  }
  return hydratePromise;
}

/** Hydrate shop listing helpers from /api/shop (DB) so web matches bot. */
export function useShopCatalogSync(): { ready: boolean; synced: boolean } {
  const [ready, setReady] = useState(isShopCatalogHydrated());
  const [synced, setSynced] = useState(isShopCatalogHydrated());

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
