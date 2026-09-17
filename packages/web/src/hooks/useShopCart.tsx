import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { tomanToShopCoins, tomanToShopStars } from '@petdate/shared';
import { isRetiredShopProduct } from '../data/retired-shop-products';
import { getProduct, type ShopProduct } from '../data/shopCatalog';
import type { ShopCartApiLine } from '../lib/api';
import { useAuthStore } from './useAuthStore';
import { hydrateShopCatalogOnce, isLandingHomePath, isShopPath } from './useShopCatalogSync';
import { localCartIsAhead, mergeCartLinesKeepLocal } from './shopCartMerge';
import { useLocation } from 'react-router-dom';

/** Guest / offline draft. When logged in, localStorage mirrors the server cart. */
const STORAGE_KEY = 'petdate.shop.cart.v1';
const ORDERS_KEY = 'petdate.shop.orders.v1';
/** Sync rule documented for ops / PR: guest ∪ server (sum qty) then persist server. */
export const SHOP_CART_SYNC_RULE = 'merge-then-persist' as const;

/** Keep the large api.ts client off the landing entry; load when cart syncs. */
function shopCartApi() {
  return import('../lib/api');
}

export interface CartLine {
  productId: string;
  qty: number;
}

export interface CartLineView extends CartLine {
  product: ShopProduct;
  lineTotal: number;
  lineCoins: number;
  lineStars: number;
}

export interface ShopOrderStub {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  address: string;
  note?: string;
  items: CartLine[];
  totalToman: number;
  totalCoins?: number;
  totalStars?: number;
  status: 'pending' | 'paid';
  paymentCurrency?: 'coins' | 'stars' | 'toman';
}

export type ShopAddToast = {
  id: number;
  productId: string;
  title: string;
  image?: string;
  qty: number;
};

function readLines(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((l) => l && typeof l.productId === 'string' && l.qty > 0);
  } catch {
    return [];
  }
}

function writeLines(lines: CartLine[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* quota / private mode */
  }
}

function clearLocalLines() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function readOrders(): ShopOrderStub[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ShopOrderStub[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function apiLinesToCart(lines: ShopCartApiLine[]): CartLine[] {
  return lines
    .filter((l) => l && typeof l.productId === 'string' && l.qty > 0)
    .map((l) => ({ productId: l.productId, qty: Math.floor(l.qty) }));
}

/** Build a minimal ShopProduct from server cart enrichment when local catalog lags. */
function productFromServerMeta(meta: ShopCartApiLine): ShopProduct | null {
  if (!meta?.productId || meta.priceToman == null || !Number.isFinite(meta.priceToman)) {
    return null;
  }
  return {
    id: meta.productId,
    slug: meta.slug || meta.productId,
    title: meta.title || meta.productId,
    brandId: 'petdate',
    categorySlug: 'dog-food',
    petTypes: ['dog'],
    priceToman: meta.priceToman,
    image: meta.image || '/pepito/img/logo.png',
    inStock: meta.inStock !== false,
    params: {},
    description: '',
  };
}

function pulseCartTarget() {
  const el = document.querySelector<HTMLElement>('[data-shop-cart-target]');
  if (!el) return;
  el.classList.remove('is-cart-pulse');
  void el.offsetWidth;
  el.classList.add('is-cart-pulse');
  window.setTimeout(() => el.classList.remove('is-cart-pulse'), 520);
  const badge = el.querySelector('.pepito-nav-cart-count, .pd-shop-cart-count');
  if (badge) {
    badge.classList.remove('is-badge-pop');
    void (badge as HTMLElement).offsetWidth;
    badge.classList.add('is-badge-pop');
    window.setTimeout(() => badge.classList.remove('is-badge-pop'), 480);
  }
}

interface ShopCartContextValue {
  lines: CartLineView[];
  /** Badge + totals: only resolved catalog lines (never counts ghost localStorage rows). */
  itemCount: number;
  totalToman: number;
  totalCoins: number;
  totalStars: number;
  syncing: boolean;
  syncRule: typeof SHOP_CART_SYNC_RULE;
  add: (productId: string, qty?: number) => void;
  addAnimated: (productId: string, qty?: number) => Promise<void>;
  pendingAddId: string | null;
  addToast: ShopAddToast | null;
  dismissAddToast: () => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  refreshFromServer: () => Promise<void>;
  /** @deprecated local stub — prefer API coin checkout */
  placeOrderStub: (form: {
    name: string;
    phone: string;
    address: string;
    note?: string;
  }) => ShopOrderStub;
  rememberPaidOrder: (order: ShopOrderStub) => void;
}

const ShopCartContext = createContext<ShopCartContextValue | null>(null);

export function ShopCartProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn, token } = useAuthStore();
  const { pathname } = useLocation();
  const [lines, setLines] = useState<CartLine[]>(() =>
    typeof window === 'undefined' ? [] : readLines()
  );
  const [pendingAddId, setPendingAddId] = useState<string | null>(null);
  const [addToast, setAddToast] = useState<ShopAddToast | null>(null);
  const [syncing, setSyncing] = useState(false);
  /** Catalog revision — bump after hydrate so views re-resolve product ids. */
  const [catalogEpoch, setCatalogEpoch] = useState(0);
  const toastTimerRef = useRef<number | null>(null);
  const toastSeqRef = useRef(0);
  const pendingLockRef = useRef(false);
  const mergedForTokenRef = useRef<string | null>(null);
  const skipNextLocalWriteRef = useRef(false);
  /** Skip poll/focus refresh while add/qty/remove round-trips are in flight. */
  const inflightMutationsRef = useRef(0);
  /** After an explicit clear/checkout, do not restore rows from a stale GET /cart. */
  const userClearedRef = useRef(false);
  const linesRef = useRef(lines);
  const serverMetaRef = useRef<Map<string, ShopCartApiLine>>(new Map());
  linesRef.current = lines;

  const rememberServerMeta = useCallback((serverLines: ShopCartApiLine[]) => {
    const map = serverMetaRef.current;
    for (const line of serverLines) {
      if (!line?.productId) continue;
      map.set(line.productId, line);
    }
  }, []);

  const applyServerLines = useCallback(
    (serverLines: ShopCartApiLine[], mode: 'replace' | 'merge' = 'replace') => {
      rememberServerMeta(serverLines);
      const fromServer = apiLinesToCart(serverLines);
      const next =
        mode === 'merge'
          ? mergeCartLinesKeepLocal(fromServer, linesRef.current)
          : fromServer;
      skipNextLocalWriteRef.current = true;
      setLines(next);
      writeLines(next);
      return next;
    },
    [rememberServerMeta]
  );

  /** Boot/focus GET /cart must not wipe rows added while that request was in flight. */
  const applyFetchedServerLines = useCallback(
    (serverLines: ShopCartApiLine[]) => {
      if (userClearedRef.current && linesRef.current.length === 0) return;
      const fromServer = apiLinesToCart(serverLines);
      const next = applyServerLines(serverLines, 'merge');
      if (!token || !localCartIsAhead(fromServer, next)) return;
      void shopCartApi()
        .then(({ mergeShopCart }) => mergeShopCart(token, next))
        .then((data) => {
          if (userClearedRef.current && linesRef.current.length === 0) return;
          applyServerLines(data.lines, 'merge');
        })
        .catch(() => undefined);
    },
    [token, applyServerLines]
  );

  /** Hydrate live catalog on /shop only — never on guest homepage critical path.
   *  Landing #shop section triggers hydrate via WelcomeBelowFold intersection. */
  useEffect(() => {
    if (isLandingHomePath(pathname) || !isShopPath(pathname)) return;
    let cancelled = false;
    void hydrateShopCatalogOnce().then((ok) => {
      if (!cancelled && ok) setCatalogEpoch((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const refreshFromServer = useCallback(async () => {
    if (!token) return;
    if (inflightMutationsRef.current > 0) return;
    try {
      const data = await (await shopCartApi()).fetchShopCart(token);
      applyFetchedServerLines(data.lines);
    } catch {
      /* keep local mirror on transient errors */
    }
  }, [token, applyFetchedServerLines]);

  /** On login: merge guest localStorage into server, then mirror server (source of truth). */
  useEffect(() => {
    if (!isLoggedIn || !token) {
      mergedForTokenRef.current = null;
      return;
    }
    if (mergedForTokenRef.current === token) return;
    let cancelled = false;
    mergedForTokenRef.current = token;
    setSyncing(true);
    const guest = readLines();
    void (async () => {
      try {
        const api = await shopCartApi();
        const data =
          guest.length > 0
            ? await api.mergeShopCart(token, guest)
            : await api.fetchShopCart(token);
        if (cancelled) return;
        applyFetchedServerLines(data.lines);
      } catch {
        if (!cancelled) mergedForTokenRef.current = null;
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, token, applyFetchedServerLines]);

  /** Guest: persist draft. Logged-in: keep localStorage as mirror only (already written in applyServerLines). */
  useEffect(() => {
    if (skipNextLocalWriteRef.current) {
      skipNextLocalWriteRef.current = false;
      return;
    }
    if (!isLoggedIn) {
      writeLines(lines);
    } else {
      writeLines(lines);
    }
  }, [lines, isLoggedIn]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLines(readLines());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /** Pull bot/web mutations when tab becomes visible again. */
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshFromServer();
    };
    const onFocus = () => {
      void refreshFromServer();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshFromServer();
    }, 25_000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(poll);
    };
  }, [isLoggedIn, token, refreshFromServer]);

  useEffect(
    () => () => {
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
    },
    []
  );

  /** On logout, keep last mirrored lines as guest draft (already in localStorage). */
  useEffect(() => {
    if (!isLoggedIn) {
      setLines(readLines());
    }
  }, [isLoggedIn]);

  const resolveProduct = useCallback((productId: string): ShopProduct | undefined => {
    const fromCatalog = getProduct(productId);
    if (fromCatalog) return fromCatalog;
    const meta = serverMetaRef.current.get(productId);
    if (!meta) return undefined;
    return productFromServerMeta(meta) ?? undefined;
  }, [catalogEpoch]);

  const views: CartLineView[] = useMemo(() => {
    return lines
      .map((l) => {
        const product = resolveProduct(l.productId);
        if (!product) return null;
        const unitCoins = tomanToShopCoins(product.priceToman);
        const unitStars = tomanToShopStars(product.priceToman);
        return {
          ...l,
          product,
          lineTotal: product.priceToman * l.qty,
          lineCoins: unitCoins * l.qty,
          lineStars: unitStars * l.qty,
        };
      })
      .filter(Boolean) as CartLineView[];
  }, [lines, resolveProduct]);

  /** Critical: badge must match visible cart lines, not stale unknown productIds. */
  const itemCount = useMemo(() => views.reduce((s, l) => s + l.qty, 0), [views]);
  const totalToman = useMemo(() => views.reduce((s, l) => s + l.lineTotal, 0), [views]);
  const totalCoins = useMemo(() => views.reduce((s, l) => s + l.lineCoins, 0), [views]);
  const totalStars = useMemo(() => views.reduce((s, l) => s + l.lineStars, 0), [views]);

  /**
   * Drop retired demo SKUs (p1–p220) from local + server carts.
   * Never DELETE live server rows just because this tab cannot resolve the id yet —
   * nginx showed 20k+ DELETE /cart/items from / and /chats while catalog hydrate
   * only ran under ShopChrome on /shop*.
   * Server also refuses live-SKU DELETE without user-remove intent (stale SPA guard).
   */
  useEffect(() => {
    if (!lines.length) return;
    const retired = lines.filter((l) => isRetiredShopProduct(l.productId));
    if (!retired.length) return;
    const retiredIds = new Set(retired.map((l) => l.productId));
    setLines(lines.filter((l) => !retiredIds.has(l.productId)));
    if (token) {
      for (const ghost of retired) {
        /* no userIntent — server allows missing/retired demo cleanup only */
        void shopCartApi()
          .then(({ removeShopCartItem }) => removeShopCartItem(token, ghost.productId))
          .catch(() => undefined);
      }
    }
  }, [lines, token]);

  const add = useCallback(
    (productId: string, qty = 1) => {
      const n = Math.max(1, Math.floor(qty) || 1);
      userClearedRef.current = false;
      setLines((prev) => {
        const i = prev.findIndex((l) => l.productId === productId);
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i]!, qty: next[i]!.qty + n };
          return next;
        }
        return [...prev, { productId, qty: n }];
      });
      if (token) {
        inflightMutationsRef.current += 1;
        void shopCartApi()
          .then(({ addShopCartItem }) => addShopCartItem(token, productId, n))
          .then((data) =>
            applyServerLines(data.lines, inflightMutationsRef.current > 1 ? 'merge' : 'replace')
          )
          .catch(() => undefined)
          .finally(() => {
            inflightMutationsRef.current = Math.max(0, inflightMutationsRef.current - 1);
          });
      }
      const product = resolveProduct(productId);
      if (product) {
        void import('../lib/siteAnalytics').then((m) => {
          m.trackAddToCart({
            itemId: product.id,
            itemName: product.title,
            price: product.priceToman,
            quantity: n,
            category: product.categorySlug,
          });
        });
      }
    },
    [token, applyServerLines, resolveProduct]
  );

  const dismissAddToast = useCallback(() => {
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setAddToast(null);
  }, []);

  const addAnimated = useCallback(
    async (productId: string, qty = 1) => {
      if (pendingLockRef.current) return;
      const product = resolveProduct(productId);
      if (!product?.inStock) return;
      const n = Math.max(1, Math.min(10, Math.floor(qty) || 1));
      pendingLockRef.current = true;
      inflightMutationsRef.current += 1;
      setPendingAddId(productId);
      try {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 380);
        });
        add(productId, n);
        pulseCartTarget();
        toastSeqRef.current += 1;
        const toast: ShopAddToast = {
          id: toastSeqRef.current,
          productId,
          title: product.title,
          image: product.image,
          qty: n,
        };
        setAddToast(toast);
        if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = window.setTimeout(() => {
          setAddToast((cur) => (cur?.id === toast.id ? null : cur));
          toastTimerRef.current = null;
        }, 2800);
      } finally {
        setPendingAddId(null);
        pendingLockRef.current = false;
        inflightMutationsRef.current = Math.max(0, inflightMutationsRef.current - 1);
      }
    },
    [add, resolveProduct]
  );

  const setQty = useCallback(
    (productId: string, qty: number) => {
      setLines((prev) => {
        if (qty <= 0) return prev.filter((l) => l.productId !== productId);
        return prev.map((l) => (l.productId === productId ? { ...l, qty } : l));
      });
      if (token) {
        inflightMutationsRef.current += 1;
        void shopCartApi()
          .then(({ setShopCartItemQty }) => setShopCartItemQty(token, productId, qty))
          .then((data) =>
            applyServerLines(data.lines, inflightMutationsRef.current > 1 ? 'merge' : 'replace')
          )
          .catch(() => undefined)
          .finally(() => {
            inflightMutationsRef.current = Math.max(0, inflightMutationsRef.current - 1);
          });
      }
    },
    [token, applyServerLines]
  );

  const remove = useCallback(
    (productId: string) => {
      setLines((prev) => prev.filter((l) => l.productId !== productId));
      if (token) {
        inflightMutationsRef.current += 1;
        void shopCartApi()
          .then(({ removeShopCartItem }) =>
            removeShopCartItem(token, productId, { userIntent: true })
          )
          .then((data) =>
            applyServerLines(data.lines, inflightMutationsRef.current > 1 ? 'merge' : 'replace')
          )
          .catch(() => undefined)
          .finally(() => {
            inflightMutationsRef.current = Math.max(0, inflightMutationsRef.current - 1);
          });
      }
    },
    [token, applyServerLines]
  );

  const clear = useCallback(() => {
    userClearedRef.current = true;
    setLines([]);
    clearLocalLines();
    if (token) {
      void shopCartApi()
        .then(({ clearShopCartApi }) => clearShopCartApi(token))
        .catch(() => undefined);
    }
  }, [token]);

  const rememberPaidOrder = useCallback((order: ShopOrderStub) => {
    localStorage.setItem(ORDERS_KEY, JSON.stringify([order, ...readOrders()]));
  }, []);

  const placeOrderStub = useCallback(
    (form: { name: string; phone: string; address: string; note?: string }) => {
      const order: ShopOrderStub = {
        id: `ORD-${Date.now()}`,
        createdAt: new Date().toISOString(),
        name: form.name,
        phone: form.phone,
        address: form.address,
        note: form.note,
        items: lines,
        totalToman,
        totalCoins,
        status: 'pending',
      };
      rememberPaidOrder(order);
      clear();
      return order;
    },
    [lines, totalToman, totalCoins, clear, rememberPaidOrder]
  );

  const value = useMemo(
    () => ({
      lines: views,
      itemCount,
      totalToman,
      totalCoins,
      totalStars,
      syncing,
      syncRule: SHOP_CART_SYNC_RULE,
      add,
      addAnimated,
      pendingAddId,
      addToast,
      dismissAddToast,
      setQty,
      remove,
      clear,
      refreshFromServer,
      placeOrderStub,
      rememberPaidOrder,
    }),
    [
      views,
      itemCount,
      totalToman,
      totalCoins,
      totalStars,
      syncing,
      add,
      addAnimated,
      pendingAddId,
      addToast,
      dismissAddToast,
      setQty,
      remove,
      clear,
      refreshFromServer,
      placeOrderStub,
      rememberPaidOrder,
    ]
  );

  return <ShopCartContext.Provider value={value}>{children}</ShopCartContext.Provider>;
}

export function useShopCart() {
  const ctx = useContext(ShopCartContext);
  if (!ctx) {
    throw new Error('useShopCart must be used within ShopCartProvider');
  }
  return ctx;
}
