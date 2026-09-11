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
import { getProduct, type ShopProduct } from '../data/shopCatalog';
import { trackAddToCart } from '../lib/siteAnalytics';

const STORAGE_KEY = 'petdate.shop.cart.v1';
const ORDERS_KEY = 'petdate.shop.orders.v1';

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
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

function pulseCartTarget() {
  const el = document.querySelector<HTMLElement>('[data-shop-cart-target]');
  if (!el) return;
  el.classList.remove('is-cart-pulse');
  // restart animation
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
  itemCount: number;
  totalToman: number;
  totalCoins: number;
  totalStars: number;
  add: (productId: string, qty?: number) => void;
  /** افزودن با لودینگ دکمه + toast گوشه‌ای */
  addAnimated: (productId: string, qty?: number) => Promise<void>;
  pendingAddId: string | null;
  addToast: ShopAddToast | null;
  dismissAddToast: () => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
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
  const [lines, setLines] = useState<CartLine[]>(() =>
    typeof window === 'undefined' ? [] : readLines()
  );
  const [pendingAddId, setPendingAddId] = useState<string | null>(null);
  const [addToast, setAddToast] = useState<ShopAddToast | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const toastSeqRef = useRef(0);
  const pendingLockRef = useRef(false);

  useEffect(() => {
    writeLines(lines);
  }, [lines]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLines(readLines());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
    },
    []
  );

  const views: CartLineView[] = useMemo(() => {
    return lines
      .map((l) => {
        const product = getProduct(l.productId);
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
  }, [lines]);

  const itemCount = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);
  const totalToman = useMemo(() => views.reduce((s, l) => s + l.lineTotal, 0), [views]);
  const totalCoins = useMemo(() => views.reduce((s, l) => s + l.lineCoins, 0), [views]);
  const totalStars = useMemo(() => views.reduce((s, l) => s + l.lineStars, 0), [views]);

  const add = useCallback((productId: string, qty = 1) => {
    const n = Math.max(1, Math.floor(qty) || 1);
    setLines((prev) => {
      const i = prev.findIndex((l) => l.productId === productId);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i]!, qty: next[i]!.qty + n };
        return next;
      }
      return [...prev, { productId, qty: n }];
    });
    const product = getProduct(productId);
    if (product) {
      trackAddToCart({
        itemId: product.id,
        itemName: product.title,
        price: product.priceToman,
        quantity: n,
        category: product.categorySlug,
      });
    }
  }, []);

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
      const product = getProduct(productId);
      if (!product?.inStock) return;
      const n = Math.max(1, Math.min(10, Math.floor(qty) || 1));
      pendingLockRef.current = true;
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
      }
    },
    [add]
  );

  const setQty = useCallback((productId: string, qty: number) => {
    setLines((prev) => {
      if (qty <= 0) return prev.filter((l) => l.productId !== productId);
      return prev.map((l) => (l.productId === productId ? { ...l, qty } : l));
    });
  }, []);

  const remove = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

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
      add,
      addAnimated,
      pendingAddId,
      addToast,
      dismissAddToast,
      setQty,
      remove,
      clear,
      placeOrderStub,
      rememberPaidOrder,
    }),
    [
      views,
      itemCount,
      totalToman,
      totalCoins,
      totalStars,
      add,
      addAnimated,
      pendingAddId,
      addToast,
      dismissAddToast,
      setQty,
      remove,
      clear,
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
