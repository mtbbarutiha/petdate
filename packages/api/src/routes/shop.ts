import { Router } from 'express';
import multer from 'multer';
import { STAR_PRICE_TOMAN, tomanToShopCoins, parseOrderIdFromPublicId } from '@petdate/shared';
import { getCoinPriceToman } from '../economy-rates';
import { getUserFromBearer } from '../services/web-otp';
import {
  checkoutShopWithCoins,
  checkoutShopWithStars,
  checkoutShopWithToman,
  getShopCardStatus,
  getShopStarsXtrStatus,
  parseShopCardMeta,
  prepareShopCardCheckout,
  prepareShopStarsXtrCheckout,
  quoteShopCoins,
  quoteShopStars,
} from '../services/shop-checkout';
import {
  addShopCartLine,
  clearShopCart,
  mergeAndPersistShopCart,
  normalizeCartLines,
  publicCartPayload,
  removeShopCartLine,
  replaceShopCart,
  requestHasShopCartUserRemoveIntent,
  setShopCartLine,
} from '../services/shop-cart';
import { adminPlatform } from '../admin-platform';
import { dbService } from '../db';
import { rejectIfFlagOff } from '../runtime-settings';
import {
  MAX_PAYMENT_RECEIPT_BYTES,
  savePaymentReceipt,
} from '../services/payment-receipt-store';
import { publicShopParams } from '../data/shop-product-images';

export const shopRouter = Router();

shopRouter.use((req, res, next) => {
  if (rejectIfFlagOff(res, 'shopEnabled')) return;
  if (req.method !== 'GET') {
    if (/\/checkout\/card/.test(req.path) && rejectIfFlagOff(res, 'paymentCardEnabled')) return;
    if (
      /\/checkout\/(stars|wallet-stars|stars-telegram|wallet-stars-telegram)|\/quote-stars/.test(
        req.path
      ) &&
      rejectIfFlagOff(res, 'paymentStarsEnabled')
    ) {
      return;
    }
  }
  next();
});

const shopReceiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PAYMENT_RECEIPT_BYTES, files: 1 },
});

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

/** After a successful checkout (paid or invoice prepared), drop the shared cart. */
function clearCartAfterCheckout(userId: number) {
  try {
    clearShopCart(userId);
  } catch (err) {
    console.warn('shop cart clear after checkout skipped:', (err as Error).message);
  }
}

function parseBool(raw: unknown): boolean | undefined {
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return undefined;
}

function publicProduct(p: ReturnType<typeof adminPlatform.getShopProduct>) {
  if (!p) return null;
  const titleEn = p.params.__titleEn?.trim() || undefined;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    titleEn,
    brandId: p.brandId,
    categorySlug: p.categorySlug,
    petTypes: p.petTypes,
    priceToman: p.priceToman,
    compareAtToman: p.compareAtToman,
    image: p.image,
    images: p.images,
    badge: p.badge,
    inStock: p.inStock,
    stockQty: p.stockQty,
    params: publicShopParams(p.params),
    description: p.description,
    featured: p.featured,
    coins: tomanToShopCoins(p.priceToman, getCoinPriceToman()),
    coinPriceToman: getCoinPriceToman(),
    starPriceToman: STAR_PRICE_TOMAN,
  };
}

/** نرخ و قواعد نمایش قیمت سکه فروشگاه */
shopRouter.get('/coin-rate', (_req, res) => {
  res.json({
    ok: true,
    coinPriceToman: getCoinPriceToman(),
    noteFa: `هر سکه ≈ ${getCoinPriceToman().toLocaleString('fa-IR')} تومان در پرداخت فروشگاه`,
  });
});

/** نرخ ستاره فروشگاه — هم‌تراز اقتصاد ربات (۱ Star = ۱ سکه = ۲٬۰۰۰ تومان) */
shopRouter.get('/star-rate', (_req, res) => {
  res.json({
    ok: true,
    starPriceToman: STAR_PRICE_TOMAN,
    coinPriceToman: getCoinPriceToman(),
    noteFa: `هر ستاره ≈ ${STAR_PRICE_TOMAN.toLocaleString('fa-IR')} تومان (کیف پول مشترک وب و ربات)`,
  });
});

shopRouter.get('/brands', (_req, res) => {
  let brands = adminPlatform.listShopBrands();
  if (!brands.length) {
    // fall through empty — web uses static SHOP_BRANDS
  }
  res.json({
    ok: true,
    brands: brands.filter((b) => b.active !== false).map((b) => ({
      id: b.id,
      labelFa: b.labelFa,
      labelEn: b.labelEn,
      logoUrl: b.logoUrl,
      sortOrder: b.sortOrder,
      featured: b.featured,
      active: b.active,
    })),
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
    coinPriceToman: getCoinPriceToman(),
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
    coinPriceToman: getCoinPriceToman(),
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
    coinPriceToman: getCoinPriceToman(),
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
    coinPriceToman: getCoinPriceToman(),
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

  clearCartAfterCheckout(session.user.id);
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
    message: `سفارش ${result.order.publicId} با ${result.coinsSpent.toLocaleString('fa-IR')} سکه پرداخت شد.`,
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

  clearCartAfterCheckout(session.user.id);
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

/** پرداخت با ستاره پنل پت‌دیت (wallet_stars) — کسر از موجودی مشترک وب/ربات */
shopRouter.post('/checkout/wallet-stars', (req, res) => {
  const session = requireSession(req, res, 'برای پرداخت با ستاره پنل وارد حساب شوید.');
  if (!session) return;

  const body = req.body ?? {};
  const items = Array.isArray(body.items) ? body.items : [];
  const result = checkoutShopWithStars({
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

  clearCartAfterCheckout(session.user.id);
  const user = dbService.getUserById(session.user.id);
  res.status(201).json({
    ok: true,
    orderId: result.order.id,
    order: result.order,
    starsSpent: result.starsSpent,
    starsRemaining: result.starsRemaining,
    totalToman: result.totalToman,
    lines: result.lines,
    wallet: user?.wallet ?? dbService.getWallet(session.user.id),
    message: `سفارش ${result.order.publicId} با ${result.starsSpent.toLocaleString('fa-IR')} ستاره پنل پرداخت شد.`,
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

/** پرداخت با تومان پنل (wallet_toman) */
shopRouter.post('/checkout/toman', (req, res) => {
  const session = requireSession(req, res, 'برای پرداخت با ریال وارد حساب شوید.');
  if (!session) return;

  const body = req.body ?? {};
  const items = Array.isArray(body.items) ? body.items : [];
  const result = checkoutShopWithToman({
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

  clearCartAfterCheckout(session.user.id);
  const user = dbService.getUserById(session.user.id);
  res.status(201).json({
    ok: true,
    orderId: result.order.id,
    order: result.order,
    tomanSpent: result.tomanSpent,
    tomanRemaining: result.tomanRemaining,
    totalToman: result.totalToman,
    lines: result.lines,
    wallet: user?.wallet ?? dbService.getWallet(session.user.id),
    message: `سفارش ${result.order.publicId} با ${result.tomanSpent.toLocaleString('fa-IR')} تومان پرداخت شد.`,
  });
});

/** کارت‌به‌کارت شاپ — منتظر رسید */
shopRouter.post('/checkout/card', (req, res) => {
  const session = requireSession(req, res, 'برای پرداخت کارت‌به‌کارت وارد حساب شوید.');
  if (!session) return;

  const body = req.body ?? {};
  const items = Array.isArray(body.items) ? body.items : [];
  const result = prepareShopCardCheckout({
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

  clearCartAfterCheckout(session.user.id);
  res.status(201).json({
    ok: true,
    paymentOrderId: result.paymentOrderId,
    totalToman: result.totalToman,
    lines: result.lines,
    titleHint: result.titleHint,
    botDeepLink: result.botDeepLink,
    webSuccessUrl: result.webSuccessUrl,
    receiptToken: result.receiptToken,
    cardNumber: result.cardNumber,
    cardHolder: result.cardHolder,
    requiresCardReceipt: true,
    message: result.message,
  });
});

shopRouter.get('/checkout/card-status/:paymentOrderId', (req, res) => {
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
  const result = getShopCardStatus(paymentOrderId, {
    userId: session?.user.id,
    receiptToken,
  });
  if (!result.ok) {
    res.status(result.reason === 'forbidden' ? 403 : 404).json(result);
    return;
  }
  res.json(result);
});

/** آپلود رسید کارت‌به‌کارت شاپ از وب */
shopRouter.post('/checkout/card-receipt/:paymentOrderId', (req, res) => {
  const session = requireSession(req, res, 'برای ارسال رسید وارد حساب شوید.');
  if (!session) return;
  shopReceiptUpload.single('file')(req, res, (uploadErr) => {
    if (uploadErr) {
      const tooBig =
        uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE';
      res.status(400).json({
        ok: false,
        error: tooBig ? 'حجم فایل زیاد است (حداکثر ۸ مگابایت).' : 'آپلود ناموفق بود.',
      });
      return;
    }
    try {
      const paymentOrderId = Number(req.params.paymentOrderId);
      const existing = dbService.getPaymentOrder(paymentOrderId);
      if (!existing || String(existing.packageId) !== 'shopcard') {
        res.status(404).json({ ok: false, reason: 'missing', error: 'فاکتور پیدا نشد.' });
        return;
      }
      const receiptToken = String(req.body?.receiptToken ?? req.query?.t ?? '').trim();
      const meta = parseShopCardMeta(existing.adminNote);
      const ownerOk = existing.userId === session.user.id;
      const tokenOk =
        Boolean(receiptToken) &&
        Boolean(meta?.receiptToken) &&
        receiptToken === meta?.receiptToken;
      if (!ownerOk && !tokenOk) {
        res.status(403).json({ ok: false, reason: 'forbidden', error: 'دسترسی ندارید.' });
        return;
      }
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ ok: false, reason: 'no_file', error: 'فایل رسید لازم است.' });
        return;
      }
      const transferRef =
        typeof req.body?.transferRef === 'string' ? req.body.transferRef.trim().slice(0, 64) : undefined;
      const saved = savePaymentReceipt({
        orderId: paymentOrderId,
        originalName: file.originalname || 'receipt.jpg',
        mimeType: file.mimetype,
        buffer: file.buffer,
      });
      const result = dbService.attachPaymentReceipt(paymentOrderId, saved.urlPath, { transferRef });
      if (!result.ok) {
        res.status(result.reason === 'bad_status' ? 409 : 400).json({
          ok: false,
          reason: result.reason,
          error:
            result.reason === 'bad_status'
              ? 'این فاکتور دیگر منتظر رسید نیست.'
              : 'ثبت رسید ناموفق بود.',
        });
        return;
      }
      void import('../services/card2card-finance')
        .then(({ notifyAdminsPendingCardReceipt }) =>
          notifyAdminsPendingCardReceipt(result.order)
        )
        .catch((err) => console.warn('shop receipt admin notify skipped:', (err as Error).message));
      res.json({ ok: true, order: result.order, status: result.order.status });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'FILE_TOO_LARGE') {
        res.status(400).json({ ok: false, error: 'حجم فایل زیاد است.' });
        return;
      }
      if (msg === 'INVALID_MIME') {
        res.status(400).json({ ok: false, error: 'فقط تصویر JPG/PNG/WebP/GIF یا PDF مجاز است.' });
        return;
      }
      console.warn('shop card receipt upload failed:', msg);
      res.status(500).json({ ok: false, error: 'خطا در ذخیره رسید.' });
    }
  });
});

shopRouter.post('/checkout/toman-telegram', (req, res) => {
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
  const result = checkoutShopWithToman({
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
    res.status(result.reason === 'user_missing' ? 404 : 400).json(result);
    return;
  }
  clearCartAfterCheckout(user.id);
  const fresh = dbService.getUserById(user.id);
  res.status(201).json({
    ok: true,
    orderId: result.order.id,
    order: result.order,
    tomanSpent: result.tomanSpent,
    tomanRemaining: result.tomanRemaining,
    totalToman: result.totalToman,
    lines: result.lines,
    wallet: fresh?.wallet ?? dbService.getWallet(user.id),
    message: `سفارش ${result.order.publicId} با ${result.tomanSpent.toLocaleString('fa-IR')} تومان پرداخت شد.`,
  });
});

shopRouter.post('/checkout/card-telegram', (req, res) => {
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
  const result = prepareShopCardCheckout({
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
    res.status(result.reason === 'user_missing' ? 404 : 400).json(result);
    return;
  }
  clearCartAfterCheckout(user.id);
  res.status(201).json({
    ok: true,
    paymentOrderId: result.paymentOrderId,
    totalToman: result.totalToman,
    lines: result.lines,
    titleHint: result.titleHint,
    botDeepLink: result.botDeepLink,
    cardNumber: result.cardNumber,
    cardHolder: result.cardHolder,
    requiresCardReceipt: true,
    message: result.message,
  });
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

  clearCartAfterCheckout(user.id);
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
    message: `سفارش ${result.order.publicId} با ${result.coinsSpent.toLocaleString('fa-IR')} سکه پرداخت شد.`,
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

  clearCartAfterCheckout(user.id);
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

shopRouter.post('/checkout/wallet-stars-telegram', (req, res) => {
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
  const result = checkoutShopWithStars({
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

  clearCartAfterCheckout(user.id);
  const fresh = dbService.getUserById(user.id);
  res.status(201).json({
    ok: true,
    orderId: result.order.id,
    order: result.order,
    starsSpent: result.starsSpent,
    starsRemaining: result.starsRemaining,
    totalToman: result.totalToman,
    lines: result.lines,
    wallet: fresh?.wallet ?? dbService.getWallet(user.id),
    message: `سفارش ${result.order.publicId} با ${result.starsSpent.toLocaleString('fa-IR')} ستاره پنل پرداخت شد.`,
  });
});
function publicShopOrder(o: ReturnType<typeof adminPlatform.getShopOrder>) {
  if (!o) return null;
  const items = Array.isArray(o.items) ? o.items : [];
  let invoicePdfUrl: string | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const inv = require('../services/shop-invoice-pdf') as typeof import('../services/shop-invoice-pdf');
    const meta = inv.getShopOrderInvoiceMeta(o.id);
    if (meta?.token) invoicePdfUrl = inv.shopInvoicePdfPublicUrl(meta.token);
  } catch {
    /* optional */
  }
  return {
    id: o.id,
    /** شناسه فاکتور فروشگاه — PD-O##### (جدا از PD-R پرداخت) */
    publicId: o.publicId,
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
    invoicePdfUrl,
  };
}

const ORDER_STATUS_FA: Record<string, string> = {
  pending: 'در انتظار',
  paid: 'پرداخت‌شده',
  shipped: 'ارسال‌شده',
  completed: 'تکمیل‌شده',
  cancelled: 'لغوشده',
};

function resolveTelegramUser(telegramIdRaw: unknown) {
  const telegramId = String(telegramIdRaw ?? '').trim();
  if (!telegramId) return { error: 'telegramId الزامی است.' as const, user: null };
  const user = dbService.getUserByTelegramId(telegramId);
  if (!user) return { error: 'کاربر پیدا نشد. اول /start بزن.' as const, user: null };
  return { error: null, user };
}

/** سبد خرید مشترک وب — منبع حقیقت برای کاربر لاگین‌شده */
shopRouter.get('/cart', (req, res) => {
  const session = requireSession(req, res, 'برای دیدن سبد وارد حساب شوید.');
  if (!session) return;
  res.json(publicCartPayload(session.user.id));
});

/** ادغام سبد مهمان (localStorage) با سبد سرور — merge-then-persist */
shopRouter.post('/cart/merge', (req, res) => {
  const session = requireSession(req, res, 'برای همسان‌سازی سبد وارد حساب شوید.');
  if (!session) return;
  const guest = normalizeCartLines(req.body?.items ?? req.body?.lines);
  const result = mergeAndPersistShopCart(session.user.id, guest);
  res.json({
    ...publicCartPayload(session.user.id),
    merged: result.merged,
  });
});

/** جایگزینی کامل سبد (پس از ادغام کلاینت یا ویرایش دسته‌ای) */
shopRouter.put('/cart', (req, res) => {
  const session = requireSession(req, res, 'برای ذخیره سبد وارد حساب شوید.');
  if (!session) return;
  const lines = normalizeCartLines(req.body?.items ?? req.body?.lines);
  replaceShopCart(session.user.id, lines);
  res.json(publicCartPayload(session.user.id));
});

shopRouter.post('/cart/items', (req, res) => {
  const session = requireSession(req, res, 'برای افزودن به سبد وارد حساب شوید.');
  if (!session) return;
  const productId = String(req.body?.productId ?? '').trim();
  const qty = Number(req.body?.qty ?? 1);
  const result = addShopCartLine(session.user.id, productId, qty);
  if (!result.ok) {
    res.status(result.reason === 'missing' ? 404 : 400).json(result);
    return;
  }
  res.json(publicCartPayload(session.user.id));
});

shopRouter.patch('/cart/items/:productId', (req, res) => {
  const session = requireSession(req, res, 'برای ویرایش سبد وارد حساب شوید.');
  if (!session) return;
  const qty = Number(req.body?.qty ?? 0);
  const result = setShopCartLine(session.user.id, req.params.productId, qty);
  if (!result.ok) {
    res.status(result.reason === 'missing' ? 404 : 400).json(result);
    return;
  }
  res.json(publicCartPayload(session.user.id));
});

shopRouter.delete('/cart/items/:productId', (req, res) => {
  const session = requireSession(req, res, 'برای حذف از سبد وارد حساب شوید.');
  if (!session) return;
  removeShopCartLine(session.user.id, req.params.productId, {
    userIntent: requestHasShopCartUserRemoveIntent(req),
  });
  res.json(publicCartPayload(session.user.id));
});

shopRouter.delete('/cart', (req, res) => {
  const session = requireSession(req, res, 'برای خالی کردن سبد وارد حساب شوید.');
  if (!session) return;
  clearShopCart(session.user.id);
  res.json(publicCartPayload(session.user.id));
});

/** سبد تلگرام — همان جدول shop_carts کاربر لینک‌شده */
shopRouter.get('/cart-telegram', (req, res) => {
  const { error, user } = resolveTelegramUser(req.query.telegramId);
  if (!user) {
    res.status(error === 'telegramId الزامی است.' ? 400 : 404).json({
      ok: false,
      reason: error === 'telegramId الزامی است.' ? 'bad_user' : 'user_missing',
      error,
    });
    return;
  }
  res.json(publicCartPayload(user.id));
});

shopRouter.post('/cart-telegram/merge', (req, res) => {
  const { error, user } = resolveTelegramUser(req.body?.telegramId);
  if (!user) {
    res.status(error === 'telegramId الزامی است.' ? 400 : 404).json({
      ok: false,
      reason: error === 'telegramId الزامی است.' ? 'bad_user' : 'user_missing',
      error,
    });
    return;
  }
  const guest = normalizeCartLines(req.body?.items ?? req.body?.lines);
  const result = mergeAndPersistShopCart(user.id, guest);
  res.json({ ...publicCartPayload(user.id), merged: result.merged });
});

shopRouter.put('/cart-telegram', (req, res) => {
  const { error, user } = resolveTelegramUser(req.body?.telegramId);
  if (!user) {
    res.status(error === 'telegramId الزامی است.' ? 400 : 404).json({
      ok: false,
      reason: error === 'telegramId الزامی است.' ? 'bad_user' : 'user_missing',
      error,
    });
    return;
  }
  replaceShopCart(user.id, normalizeCartLines(req.body?.items ?? req.body?.lines));
  res.json(publicCartPayload(user.id));
});

shopRouter.post('/cart-telegram/items', (req, res) => {
  const { error, user } = resolveTelegramUser(req.body?.telegramId);
  if (!user) {
    res.status(error === 'telegramId الزامی است.' ? 400 : 404).json({
      ok: false,
      reason: error === 'telegramId الزامی است.' ? 'bad_user' : 'user_missing',
      error,
    });
    return;
  }
  const result = addShopCartLine(user.id, String(req.body?.productId ?? ''), Number(req.body?.qty ?? 1));
  if (!result.ok) {
    res.status(result.reason === 'missing' ? 404 : 400).json(result);
    return;
  }
  res.json(publicCartPayload(user.id));
});

shopRouter.patch('/cart-telegram/items', (req, res) => {
  const { error, user } = resolveTelegramUser(req.body?.telegramId);
  if (!user) {
    res.status(error === 'telegramId الزامی است.' ? 400 : 404).json({
      ok: false,
      reason: error === 'telegramId الزامی است.' ? 'bad_user' : 'user_missing',
      error,
    });
    return;
  }
  const result = setShopCartLine(
    user.id,
    String(req.body?.productId ?? ''),
    Number(req.body?.qty ?? 0)
  );
  if (!result.ok) {
    res.status(result.reason === 'missing' ? 404 : 400).json(result);
    return;
  }
  res.json(publicCartPayload(user.id));
});

shopRouter.delete('/cart-telegram/items', (req, res) => {
  const { error, user } = resolveTelegramUser(req.body?.telegramId ?? req.query.telegramId);
  if (!user) {
    res.status(error === 'telegramId الزامی است.' ? 400 : 404).json({
      ok: false,
      reason: error === 'telegramId الزامی است.' ? 'bad_user' : 'user_missing',
      error,
    });
    return;
  }
  removeShopCartLine(user.id, String(req.body?.productId ?? req.query.productId ?? ''), {
    userIntent: requestHasShopCartUserRemoveIntent(req),
  });
  res.json(publicCartPayload(user.id));
});

shopRouter.delete('/cart-telegram', (req, res) => {
  const { error, user } = resolveTelegramUser(req.body?.telegramId ?? req.query.telegramId);
  if (!user) {
    res.status(error === 'telegramId الزامی است.' ? 400 : 404).json({
      ok: false,
      reason: error === 'telegramId الزامی است.' ? 'bad_user' : 'user_missing',
      error,
    });
    return;
  }
  clearShopCart(user.id);
  res.json(publicCartPayload(user.id));
});

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
  const raw = String(req.params.id ?? '').trim();
  let id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    id = parseOrderIdFromPublicId(raw) ?? NaN;
  }
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, reason: 'bad_id', error: 'شناسه فاکتور نامعتبر است.' });
    return;
  }
  const order = adminPlatform.getShopOrder(id);
  if (!order || order.userId !== session.user.id) {
    res.status(404).json({ ok: false, reason: 'missing', error: 'سفارش پیدا نشد.' });
    return;
  }
  // فاکتور فروشگاه (PD-O) — جدا از فاکتور پرداخت کارت/Stars (PD-R)
  res.json({
    ok: true,
    order: publicShopOrder(order),
    statusLabelsFa: ORDER_STATUS_FA,
  });
});

/** Authenticated PDF download / generate for owner. */
shopRouter.get('/my-orders/:id/invoice.pdf', (req, res) => {
  const session = requireSession(req, res, 'برای دانلود فاکتور وارد حساب شوید.');
  if (!session) return;
  const raw = String(req.params.id ?? '').trim();
  let id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    id = parseOrderIdFromPublicId(raw) ?? NaN;
  }
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, reason: 'bad_id', error: 'شناسه فاکتور نامعتبر است.' });
    return;
  }
  const order = adminPlatform.getShopOrder(id);
  if (!order || order.userId !== session.user.id) {
    res.status(404).json({ ok: false, reason: 'missing', error: 'سفارش پیدا نشد.' });
    return;
  }
  void import('../services/shop-invoice-pdf')
    .then(async (inv) => {
      const pdf = await inv.ensureShopInvoicePdf(order);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="petdate-${order.publicId || order.id}.pdf"`
      );
      res.setHeader('Cache-Control', 'private, max-age=60');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs') as typeof import('fs');
      fs.createReadStream(pdf.pdfPath).pipe(res);
    })
    .catch((err) => {
      console.warn('invoice pdf download failed:', (err as Error).message);
      res.status(500).json({ ok: false, error: 'ساخت PDF ناموفق بود.' });
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
