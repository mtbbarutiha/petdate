import { Router } from 'express';
import { COIN_PRICE_TOMAN, STAR_PRICE_TOMAN, tomanToShopCoins } from '@petdate/shared';
import { getUserFromBearer } from '../services/web-otp';
import {
  checkoutShopWithCoins,
  getShopStarsXtrStatus,
  prepareShopStarsXtrCheckout,
  quoteShopCoins,
  quoteShopStars,
} from '../services/shop-checkout';
import { adminPlatform } from '../admin-platform';
import { dbService } from '../db';

export const shopRouter = Router();

function requireSession(
  req: { header: (name: string) => string | undefined },
  res: {
    status: (code: number) => { json: (body: unknown) => void };
  },
  unauthorizedMessage = 'برای پرداخت وارد حساب شوید.'
) {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: unauthorizedMessage, reason: 'unauthorized' });
    return null;
  }
  return session;
}

function parseBool(raw: unknown): boolean | undefined {
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return undefined;
}

function publicProduct(p: ReturnType<typeof adminPlatform.getShopProduct>) {
  if (!p) return null;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    brandId: p.brandId,
    categorySlug: p.categorySlug,
    petTypes: p.petTypes,
    priceToman: p.priceToman,
    compareAtToman: p.compareAtToman,
    image: p.image,
    badge: p.badge,
    inStock: p.inStock,
    stockQty: p.stockQty,
    params: p.params,
    description: p.description,
    featured: p.featured,
    coins: tomanToShopCoins(p.priceToman),
    coinPriceToman: COIN_PRICE_TOMAN,
    starPriceToman: STAR_PRICE_TOMAN,
  };
}

/** نرخ و قواعد نمایش قیمت سکه فروشگاه */
shopRouter.get('/coin-rate', (_req, res) => {
  res.json({
    ok: true,
    coinPriceToman: COIN_PRICE_TOMAN,
    noteFa: `هر سکه ≈ ${COIN_PRICE_TOMAN.toLocaleString('fa-IR')} تومان در پرداخت فروشگاه`,
  });
});

/** نرخ ستاره فروشگاه — هم‌تراز اقتصاد ربات (۱ Star = ۱ سکه = ۲٬۰۰۰ تومان) */
shopRouter.get('/star-rate', (_req, res) => {
  res.json({
    ok: true,
    starPriceToman: STAR_PRICE_TOMAN,
    coinPriceToman: COIN_PRICE_TOMAN,
    noteFa: `هر ستاره ≈ ${STAR_PRICE_TOMAN.toLocaleString('fa-IR')} تومان (کیف پول مشترک وب و ربات)`,
  });
});

shopRouter.get('/categories', (req, res) => {
  const petType = typeof req.query.petType === 'string' ? req.query.petType.trim() : '';
  let categories = adminPlatform.listShopCategories();
  if (petType && petType !== 'all') {
    categories = categories.filter((c) => c.petType === petType);
  }
  res.json({
    ok: true,
    total: categories.length,
    categories,
    coinPriceToman: COIN_PRICE_TOMAN,
    starPriceToman: STAR_PRICE_TOMAN,
  });
});

shopRouter.get('/products', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
  const categorySlug =
    typeof req.query.category === 'string'
      ? req.query.category.trim()
      : typeof req.query.categorySlug === 'string'
        ? req.query.categorySlug.trim()
        : undefined;
  const petType = typeof req.query.petType === 'string' ? req.query.petType.trim() : undefined;
  const featuredOnly = parseBool(req.query.featured) === true;
  const inStock = parseBool(req.query.inStock);

  let products = adminPlatform.listShopProducts({
    q,
    categorySlug: categorySlug || undefined,
    inStock,
  });

  if (petType && petType !== 'all') {
    products = products.filter((p) => p.petTypes.includes(petType));
  }
  if (featuredOnly) {
    products = products.filter((p) => p.featured);
  }

  const limitRaw = Number(req.query.limit ?? 100);
  const offsetRaw = Number(req.query.offset ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 300) : 100;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.floor(offsetRaw), 0) : 0;
  const total = products.length;
  const page = products.slice(offset, offset + limit).map((p) => publicProduct(p)!);

  res.json({
    ok: true,
    total,
    offset,
    limit,
    products: page,
    coinPriceToman: COIN_PRICE_TOMAN,
    starPriceToman: STAR_PRICE_TOMAN,
  });
});

shopRouter.get('/products/:idOrSlug', (req, res) => {
  const product = adminPlatform.getShopProduct(req.params.idOrSlug);
  if (!product) {
    res.status(404).json({ ok: false, error: 'محصول پیدا نشد' });
    return;
  }
  const category = adminPlatform.listShopCategories().find((c) => c.slug === product.categorySlug);
  res.json({
    ok: true,
    product: publicProduct(product),
    category: category ?? null,
    coinPriceToman: COIN_PRICE_TOMAN,
    starPriceToman: STAR_PRICE_TOMAN,
  });
});

shopRouter.post('/quote-coins', (req, res) => {
  const session = requireSession(req, res, 'برای پرداخت با سکه وارد حساب شوید.');
  if (!session) return;

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const quoted = quoteShopCoins(
    items.map((it: { productId?: string; qty?: number }) => ({
      productId: String(it?.productId ?? ''),
      qty: Number(it?.qty ?? 0),
    }))
  );
  if (!quoted.ok) {
    res.status(200).json(quoted);
    return;
  }

  const wallet = dbService.getWallet(session.user.id);
  const balance = wallet?.coins ?? session.user.coins ?? 0;
  res.json({
    ok: true,
    totalToman: quoted.totalToman,
    coins: quoted.coins,
    lines: quoted.lines,
    balance,
    canAfford: balance >= quoted.coins,
    coinPriceToman: COIN_PRICE_TOMAN,
  });
});

shopRouter.post('/quote-stars', (req, res) => {
  const session = requireSession(req, res, 'برای پرداخت با ستاره وارد حساب شوید.');
  if (!session) return;

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const quoted = quoteShopStars(
    items.map((it: { productId?: string; qty?: number }) => ({
      productId: String(it?.productId ?? ''),
      qty: Number(it?.qty ?? 0),
    }))
  );
  if (!quoted.ok) {
    res.status(200).json(quoted);
    return;
  }

  const wallet = dbService.getWallet(session.user.id);
  const balance = wallet?.stars ?? session.user.walletStars ?? 0;
  res.json({
    ok: true,
    totalToman: quoted.totalToman,
    stars: quoted.stars,
    lines: quoted.lines,
    balance,
    canAfford: balance >= quoted.stars,
    starPriceToman: STAR_PRICE_TOMAN,
  });
});

shopRouter.post('/checkout/coins', (req, res) => {
  const session = requireSession(req, res, 'برای پرداخت با سکه وارد حساب شوید.');
  if (!session) return;

  const body = req.body ?? {};
  const items = Array.isArray(body.items) ? body.items : [];
  const result = checkoutShopWithCoins({
    userId: session.user.id,
    items: items.map((it: { productId?: string; qty?: number }) => ({
      productId: String(it?.productId ?? ''),
      qty: Number(it?.qty ?? 0),
    })),
    customerName: String(body.customerName ?? body.name ?? ''),
    customerPhone: String(body.customerPhone ?? body.phone ?? ''),
    address: String(body.address ?? ''),
    note: body.note != null ? String(body.note) : undefined,
  });

  if (!result.ok) {
    res.status(200).json(result);
    return;
  }

  const user = dbService.getUserById(session.user.id);
  res.status(201).json({
    ok: true,
    orderId: result.order.id,
    order: result.order,
    coinsSpent: result.coinsSpent,
    coinsRemaining: result.coinsRemaining,
    totalToman: result.totalToman,
    lines: result.lines,
    wallet: user?.wallet ?? dbService.getWallet(session.user.id),
    coins: result.coinsRemaining,
    message: `سفارش #${result.order.id} با ${result.coinsSpent.toLocaleString('fa-IR')} سکه پرداخت شد.`,
  });
});

shopRouter.post('/checkout/stars', (req, res) => {
  const session = requireSession(req, res, 'برای پرداخت با ستاره وارد حساب شوید.');
  if (!session) return;

  const body = req.body ?? {};
  const items = Array.isArray(body.items) ? body.items : [];
  const result = prepareShopStarsXtrCheckout({
    userId: session.user.id,
    items: items.map((it: { productId?: string; qty?: number }) => ({
      productId: String(it?.productId ?? ''),
      qty: Number(it?.qty ?? 0),
    })),
    customerName: String(body.customerName ?? body.name ?? ''),
    customerPhone: String(body.customerPhone ?? body.phone ?? ''),
    address: String(body.address ?? ''),
    note: body.note != null ? String(body.note) : undefined,
  });

  if (!result.ok) {
    res.status(200).json(result);
    return;
  }

  res.status(201).json({
    ok: true,
    paymentOrderId: result.paymentOrderId,
    stars: result.stars,
    starsNeeded: result.stars,
    totalToman: result.totalToman,
    lines: result.lines,
    titleHint: result.titleHint,
    botDeepLink: result.botDeepLink,
    webSuccessUrl: result.webSuccessUrl,
    receiptToken: result.receiptToken,
    requiresTelegramStars: true,
    message: result.message,
  });
});

shopRouter.get('/checkout/stars-status/:paymentOrderId', (req, res) => {
  const paymentOrderId = Number(req.params.paymentOrderId);
  if (!Number.isFinite(paymentOrderId) || paymentOrderId <= 0) {
    res.status(400).json({ ok: false, reason: 'bad_id', error: 'شناسه فاکتور نامعتبر است.' });
    return;
  }
  const receiptToken = String(req.query.t ?? req.query.token ?? '').trim() || undefined;
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session && !receiptToken) {
    res.status(401).json({ error: 'برای پیگیری پرداخت وارد حساب شوید.', reason: 'unauthorized' });
    return;
  }
  const result = getShopStarsXtrStatus(paymentOrderId, {
    userId: session?.user.id,
    receiptToken,
  });
  if (!result.ok) {
    res.status(result.reason === 'forbidden' ? 403 : 404).json(result);
    return;
  }
  res.json(result);
});

shopRouter.post('/checkout/coins-telegram', (req, res) => {
  const body = req.body ?? {};
  const telegramId = String(body.telegramId ?? '').trim();
  if (!telegramId) {
    res.status(400).json({ ok: false, reason: 'bad_user', error: 'telegramId الزامی است.' });
    return;
  }

  const user = dbService.getUserByTelegramId(telegramId);
  if (!user) {
    res.status(404).json({ ok: false, reason: 'user_missing', error: 'کاربر پیدا نشد. اول /start بزن.' });
    return;
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const result = checkoutShopWithCoins({
    userId: user.id,
    items: items.map((it: { productId?: string; qty?: number }) => ({
      productId: String(it?.productId ?? ''),
      qty: Number(it?.qty ?? 0),
    })),
    customerName: String(body.customerName ?? body.name ?? user.name ?? ''),
    customerPhone: String(body.customerPhone ?? body.phone ?? user.phone ?? ''),
    address: String(body.address ?? ''),
    note: body.note != null ? String(body.note) : undefined,
  });

  if (!result.ok) {
    const status = result.reason === 'user_missing' ? 404 : 400;
    res.status(status).json(result);
    return;
  }

  const fresh = dbService.getUserById(user.id);
  res.status(201).json({
    ok: true,
    orderId: result.order.id,
    order: result.order,
    coinsSpent: result.coinsSpent,
    coinsRemaining: result.coinsRemaining,
    totalToman: result.totalToman,
    lines: result.lines,
    wallet: fresh?.wallet ?? dbService.getWallet(user.id),
    coins: result.coinsRemaining,
    message: `سفارش #${result.order.id} با ${result.coinsSpent.toLocaleString('fa-IR')} سکه پرداخت شد.`,
  });
});

shopRouter.post('/checkout/stars-telegram', (req, res) => {
  const body = req.body ?? {};
  const telegramId = String(body.telegramId ?? '').trim();
  if (!telegramId) {
    res.status(400).json({ ok: false, reason: 'bad_user', error: 'telegramId الزامی است.' });
    return;
  }

  const user = dbService.getUserByTelegramId(telegramId);
  if (!user) {
    res.status(404).json({ ok: false, reason: 'user_missing', error: 'کاربر پیدا نشد. اول /start بزن.' });
    return;
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const result = prepareShopStarsXtrCheckout({
    userId: user.id,
    items: items.map((it: { productId?: string; qty?: number }) => ({
      productId: String(it?.productId ?? ''),
      qty: Number(it?.qty ?? 0),
    })),
    customerName: String(body.customerName ?? body.name ?? user.name ?? ''),
    customerPhone: String(body.customerPhone ?? body.phone ?? user.phone ?? ''),
    address: String(body.address ?? ''),
    note: body.note != null ? String(body.note) : undefined,
  });

  if (!result.ok) {
    const status = result.reason === 'user_missing' ? 404 : 400;
    res.status(status).json(result);
    return;
  }

  res.status(201).json({
    ok: true,
    paymentOrderId: result.paymentOrderId,
    stars: result.stars,
    starsNeeded: result.stars,
    totalToman: result.totalToman,
    lines: result.lines,
    titleHint: result.titleHint,
    botDeepLink: result.botDeepLink,
    webSuccessUrl: result.webSuccessUrl,
    requiresTelegramStars: true,
    message: result.message,
  });
});
function publicShopOrder(o: ReturnType<typeof adminPlatform.getShopOrder>) {
  if (!o) return null;
  const items = Array.isArray(o.items) ? o.items : [];
  return {
    id: o.id,
    status: o.status,
    totalToman: o.totalToman,
    paymentCurrency: o.paymentCurrency ?? 'toman',
    paymentAmount: o.paymentAmount ?? o.totalToman,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    note: o.note,
    items,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

const ORDER_STATUS_FA: Record<string, string> = {
  pending: 'در انتظار',
  paid: 'پرداخت‌شده',
  shipped: 'ارسال‌شده',
  completed: 'تکمیل‌شده',
  cancelled: 'لغوشده',
};

shopRouter.get('/my-orders', (req, res) => {
  const session = requireSession(req, res, 'برای دیدن سفارش‌ها وارد حساب شوید.');
  if (!session) return;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const orders = adminPlatform.listShopOrdersForUser(session.user.id, { limit }).map(publicShopOrder);
  res.json({
    ok: true,
    total: orders.length,
    orders,
    statusLabelsFa: ORDER_STATUS_FA,
  });
});

shopRouter.get('/my-orders/:id', (req, res) => {
  const session = requireSession(req, res, 'برای دیدن سفارش وارد حساب شوید.');
  if (!session) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, reason: 'bad_id', error: 'شناسه نامعتبر است.' });
    return;
  }
  const order = adminPlatform.getShopOrder(id);
  if (!order || order.userId !== session.user.id) {
    res.status(404).json({ ok: false, reason: 'missing', error: 'سفارش پیدا نشد.' });
    return;
  }
  res.json({
    ok: true,
    order: publicShopOrder(order),
    statusLabelsFa: ORDER_STATUS_FA,
  });
});

shopRouter.get('/orders-telegram', (req, res) => {
  const telegramId = String(req.query.telegramId ?? '').trim();
  if (!telegramId) {
    res.status(400).json({ ok: false, reason: 'bad_user', error: 'telegramId الزامی است.' });
    return;
  }
  const user = dbService.getUserByTelegramId(telegramId);
  if (!user) {
    res.status(404).json({ ok: false, reason: 'user_missing', error: 'کاربر پیدا نشد.' });
    return;
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  const orders = adminPlatform.listShopOrdersForUser(user.id, { limit }).map(publicShopOrder);
  res.json({
    ok: true,
    total: orders.length,
    orders,
    statusLabelsFa: ORDER_STATUS_FA,
  });
});
