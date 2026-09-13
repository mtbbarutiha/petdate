import { useEffect, useState } from 'react';
import {
  applyLiveShopCatalog,
  isShopCatalogHydrated,
} from '../data/shopCatalog';
import { fetchPublicShopCatalog } from '../lib/api';

let hydratePromise: Promise<boolean> | null = null;

/** Shared hydrate — shop chrome + cart provider (cart runs on every route). */
export async function hydrateShopCatalogOnce(): Promise<boolean> {
  if (isShopCatalogHydrated()) return true;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const data = await fetchPublicShopCatalog();
        if (!data.products?.length) return false;
        applyLiveShopCatalog({
          products: data.products,
          categories: data.categories,
        });
        return true;
      } catch {
        return false;
      } finally {
        /* keep promise so we don't hammer API on failure loops within same page */
      }
    })();
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
