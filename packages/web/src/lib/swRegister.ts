/**
 * Service worker registration with a one-shot migration off stale PWA caches.
 *
 * Phones were stuck on an older controlling SW (1.5s /chats ajax polls) because
 * `registerType: 'prompt'` left the newer worker waiting forever. This deploy's
 * sw.js uses skipWaiting+clientsClaim; the client reloads once on controllerchange
 * and clears obsolete Workbox caches.
 */

// v14 cacheId stayed active even after later bust *keys*, so #213's guest
// shell never replaced the controlling worker. New cacheId + generation.
const BUST_GENERATION = 'petdate-sw-20260912-mobile-v19';
const BUST_KEY = `pd_sw_bust_${BUST_GENERATION}`;
const RELOAD_KEY = `pd_sw_reload_${BUST_GENERATION}`;
/** Current Workbox cacheId from vite.config — never wipe this generation. */
const ACTIVE_CACHE_ID = 'petdate-web-v19-mobile';

function markBusted() {
  try {
    localStorage.setItem(BUST_KEY, '1');
  } catch {
    /* ignore */
  }
}

function alreadyBusted() {
  try {
    return localStorage.getItem(BUST_KEY) === '1';
  } catch {
    return false;
  }
}

async function clearStaleCaches() {
  if (!('caches' in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        // Keep only the active cacheId prefix. NOTE: do NOT use includes('petdate-web-v3')
        // — that incorrectly preserved v13+ caches (substring of "v13").
        .filter((k) => /workbox|precache|petdate/i.test(k) && !k.includes(ACTIVE_CACHE_ID))
        .map((k) => caches.delete(k)),
    );
  } catch {
    /* ignore */
  }
}

function reloadOnce() {
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === '1') return;
    sessionStorage.setItem(RELOAD_KEY, '1');
  } catch {
    /* still reload */
  }
  window.location.reload();
}

/**
 * Call once from main.tsx before React mounts.
 */
export async function registerPetdateSW(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const bustPending = !alreadyBusted();

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    markBusted();
    void clearStaleCaches().finally(() => {
      // Always reload once per tab for this generation so a new precache
      // is not left sitting behind the old in-memory bundle.
      reloadOnce();
    });
  });

  try {
    if (bustPending) {
      await clearStaleCaches();
    }

    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    // If a worker is waiting (prompt-era), ask it to activate.
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          nw.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    if (navigator.serviceWorker.controller) {
      markBusted();
      if (bustPending) await clearStaleCaches();
    }

    void reg.update().catch(() => undefined);
  } catch {
    markBusted();
  }
}
