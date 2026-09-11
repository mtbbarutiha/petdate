/**
 * Atomic shop checkout paid with bot coins (users.coins).
 * Stars checkout uses Telegram XTR invoices (Stars → bot), then creates a paid shop order.
 */
import { randomBytes } from 'crypto';
import { tomanToShopCoins, tomanToShopStars, type PaymentOrder } from '@petdate/shared';
import { getDb, dbService } from '../db';
import { adminPlatform, type ShopOrderRow } from '../admin-platform';
import { lookupShopPrice } from './shop-price-index';
import { paymentCardFromEnv, paymentCardPublicInfo } from './payment-card';

/** payment_orders.package_id for shop checkout via Telegram Stars (XTR → bot) */
export const SHOP_XTR_PACKAGE_ID = 'shopxtr';

export type ShopXtrMeta = {
  v: 1;
  kind: 'shopxtr';
  items: ShopCheckoutItemInput[];
  customerName: string;
  customerPhone: string;
  address: string;
  note?: string;
  totalToman: number;
  stars: number;
  titleHint?: string;
  shopOrderId?: number;
  receiptToken?: string;
};

export function isShopXtrPackageId(packageId: string | null | undefined): boolean {
  return String(packageId || '') === SHOP_XTR_PACKAGE_ID;
}

export function encodeShopXtrMeta(meta: ShopXtrMeta): string {
  return JSON.stringify(meta);
}

export function parseShopXtrMeta(raw?: string | null): ShopXtrMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ShopXtrMeta;
    if (!parsed || parsed.kind !== 'shopxtr' || parsed.v !== 1) return null;
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export type ShopCheckoutItemInput = {
  productId: string;
  qty: number;
};

export type ShopCheckoutCoinsInput = {
  userId: number;
  items: ShopCheckoutItemInput[];
  customerName: string;
  customerPhone: string;
  address: string;
  note?: string;
};

export type ShopCheckoutStarsInput = ShopCheckoutCoinsInput;

export type ShopCheckoutLine = {
  productId: string;
  title: string;
  categorySlug: string;
  qty: number;
  priceToman: number;
  costToman?: number;
  lineCoins: number;
  lineStars: number;
};

export type ShopCheckoutCoinsOk = {
  ok: true;
  order: ShopOrderRow;
  coinsSpent: number;
  coinsRemaining: number;
  totalToman: number;
  lines: ShopCheckoutLine[];
};

export type ShopCheckoutStarsOk = {
  ok: true;
  order: ShopOrderRow;
  starsSpent: number;
  starsRemaining: number;
  totalToman: number;
  lines: ShopCheckoutLine[];
};

export type ShopCheckoutFail = {
  ok: false;
  reason:
    | 'empty_cart'
    | 'bad_item'
    | 'product_missing'
    | 'out_of_stock'
    | 'insufficient_coins'
    | 'insufficient_stars'
    | 'insufficient_toman'
    | 'user_missing'
    | 'bad_customer'
    | 'payment_missing'
    | 'bad_status'
    | 'bad_meta'
    | 'already';
  error: string;
  balance?: number;
  cost?: number;
  productId?: string;
};

export type ShopStarsXtrPrepareOk = {
  ok: true;
  paymentOrderId: number;
  stars: number;
  totalToman: number;
  lines: ShopCheckoutLine[];
  titleHint: string;
  botDeepLink: string;
  webSuccessUrl: string;
  receiptToken: string;
  message: string;
};

export type ShopStarsXtrStatusOk = {
  ok: true;
  paymentOrderId: number;
  status: 'awaiting_stars' | 'paid' | string;
  stars: number;
  totalToman: number;
  titleHint?: string;
  shopOrderId?: number;
  chargeId?: string;
  paidAt?: string;
  botDeepLink: string;
  webSuccessUrl: string;
  receiptToken?: string;
  paid: boolean;
};

export type ShopStarsXtrCompleteOk = {
  ok: true;
  paymentOrder: PaymentOrder;
  shopOrder: ShopOrderRow;
  starsSpent: number;
  totalToman: number;
  credited: boolean;
  creditKind: 'shop_order';
};

/** @deprecated use ShopCheckoutFail */
export type ShopCheckoutCoinsFail = ShopCheckoutFail;

function resolveLine(
  productId: string,
  qtyRaw: number
): { ok: true; line: ShopCheckoutLine } | { ok: false; fail: ShopCheckoutFail } {
  const qty = Math.floor(Number(qtyRaw));
  if (!productId || !Number.isFinite(qty) || qty <= 0) {
    return {
      ok: false,
      fail: {
        ok: false,
        reason: 'bad_item',
        error: 'آیتم سبد نامعتبر است.',
        productId,
      },
    };
  }

  const dbProd = adminPlatform.getShopProduct(productId);
  const indexed = lookupShopPrice(productId);

  if (!dbProd && !indexed) {
    return {
      ok: false,
      fail: {
        ok: false,
        reason: 'product_missing',
        error: 'محصول در کاتالوگ یافت نشد.',
        productId,
      },
    };
  }

  if (dbProd && !dbProd.inStock) {
    return {
      ok: false,
      fail: {
        ok: false,
        reason: 'out_of_stock',
        error: `«${dbProd.title}» موجود نیست.`,
        productId,
      },
    };
  }

  const priceToman = dbProd?.priceToman ?? indexed!.priceToman;
  const title = dbProd?.title ?? indexed!.title;
  const categorySlug = dbProd?.categorySlug ?? indexed!.categorySlug;
  const costToman = dbProd?.costToman;
  const id = dbProd?.id ?? indexed!.id;
  const unitCoins = tomanToShopCoins(priceToman);
  const unitStars = tomanToShopStars(priceToman);

  return {
    ok: true,
    line: {
      productId: id,
      title,
      categorySlug,
      qty,
      priceToman,
      costToman,
      lineCoins: unitCoins * qty,
      lineStars: unitStars * qty,
    },
  };
}

function validateCustomer(input: ShopCheckoutCoinsInput): ShopCheckoutFail | null {
  const name = input.customerName?.trim() ?? '';
  const phone = input.customerPhone?.trim() ?? '';
  const address = input.address?.trim() ?? '';
  if (!name || !phone || !address) {
    return {
      ok: false,
      reason: 'bad_customer',
      error: 'نام، موبایل و آدرس لازم است.',
    };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, reason: 'empty_cart', error: 'سبد خرید خالی است.' };
  }
  return null;
}

function buildLines(
  items: ShopCheckoutItemInput[]
): { ok: true; lines: ShopCheckoutLine[] } | { ok: false; fail: ShopCheckoutFail } {
  const lines: ShopCheckoutLine[] = [];
  for (const item of items) {
    const resolved = resolveLine(String(item.productId ?? ''), item.qty);
    if (!resolved.ok) return { ok: false, fail: resolved.fail };
    lines.push(resolved.line);
  }
  return { ok: true, lines };
}

function orderNote(address: string, note?: string): string {
  return [`آدرس ارسال: ${address}`, note?.trim() ? note.trim() : ''].filter(Boolean).join('\n');
}

function cogsOf(lines: ShopCheckoutLine[]): number {
  return lines.reduce((s, l) => {
    const unit = l.costToman != null ? l.costToman : Math.floor(l.priceToman * 0.65);
    return s + unit * l.qty;
  }, 0);
}

export function checkoutShopWithCoins(
  input: ShopCheckoutCoinsInput
): ShopCheckoutCoinsOk | ShopCheckoutFail {
  const bad = validateCustomer(input);
  if (bad) return bad;

  const user = dbService.getUserById(input.userId);
  if (!user) {
    return { ok: false, reason: 'user_missing', error: 'کاربر پیدا نشد.' };
  }

  const built = buildLines(input.items);
  if (!built.ok) return built.fail;
  const { lines } = built;

  const name = input.customerName.trim();
  const phone = input.customerPhone.trim();
  const address = input.address.trim();
  const totalToman = lines.reduce((s, l) => s + l.priceToman * l.qty, 0);
  const coinsNeeded = lines.reduce((s, l) => s + l.lineCoins, 0);
  const cogsToman = cogsOf(lines);

  const balance = user.coins ?? 0;
  if (balance < coinsNeeded) {
    return {
      ok: false,
      reason: 'insufficient_coins',
      error: `موجودی سکه کافی نیست. نیاز: ${coinsNeeded.toLocaleString('fa-IR')} — موجودی: ${balance.toLocaleString('fa-IR')}`,
      balance,
      cost: coinsNeeded,
    };
  }

  const note = orderNote(address, input.note);
  const d = getDb();
  try {
    const result = d.transaction(() => {
      const debited = dbService.debitCoins(input.userId, coinsNeeded, { skipLedger: true });
      if (!debited) {
        throw Object.assign(new Error('INSUFFICIENT'), {
          balance: dbService.getUserById(input.userId)?.coins ?? 0,
          cost: coinsNeeded,
        });
      }

      const order = adminPlatform.createShopOrder({
        userId: input.userId,
        status: 'paid',
        totalToman,
        items: lines.map((l) => ({
          productId: l.productId,
          title: l.title,
          categorySlug: l.categorySlug,
          qty: l.qty,
          priceToman: l.priceToman,
          costToman: l.costToman ?? Math.floor(l.priceToman * 0.65),
          coins: l.lineCoins,
        })),
        customerName: name,
        customerPhone: phone,
        note,
        paymentCurrency: 'coins',
        paymentAmount: coinsNeeded,
        cogsToman,
      });

      d.prepare(
        `INSERT INTO wallet_ledger (user_id, currency, amount, direction, reason, ref_type, ref_id)
         VALUES (?, 'coins', ?, 'debit', ?, 'shop_order', ?)`
      ).run(input.userId, coinsNeeded, 'خرید فروشگاه با سکه', String(order.id));

      // ثبت در payment_orders تا در پنل ادمین «پرداخت‌ها» دیده شود
      d.prepare(
        `INSERT INTO payment_orders (
          user_id, package_id, coins, amount_toman, amount_stars, method, status, admin_note, reviewed_at
        ) VALUES (?, 'shopcoins', ?, ?, NULL, 'coins', 'paid', ?, datetime('now'))`
      ).run(
        input.userId,
        coinsNeeded,
        totalToman,
        JSON.stringify({
          v: 1,
          kind: 'shopcoins',
          shopOrderId: order.id,
          titleHint: lines[0]?.title || 'خرید پت شاپ',
        })
      );

      return {
        order,
        coinsRemaining: debited.coins ?? 0,
      };
    })();

    return {
      ok: true,
      order: result.order,
      coinsSpent: coinsNeeded,
      coinsRemaining: result.coinsRemaining,
      totalToman,
      lines,
    };
  } catch (err) {
    const e = err as { message?: string; balance?: number; cost?: number };
    if (e?.message === 'INSUFFICIENT') {
      return {
        ok: false,
        reason: 'insufficient_coins',
        error: `موجودی سکه کافی نیست. نیاز: ${(e.cost ?? coinsNeeded).toLocaleString('fa-IR')} — موجودی: ${(e.balance ?? 0).toLocaleString('fa-IR')}`,
        balance: e.balance ?? 0,
        cost: e.cost ?? coinsNeeded,
      };
    }
    throw err;
  }
}

/**
 * پرداخت فروشگاه با ستاره کیف پول مشترک (users.wallet_stars).
 * نرخ: STAR_PRICE_TOMAN = ۲٬۰۰۰ (هم‌تراز ۱ Star = ۱ سکه در ربات).
 */
export function checkoutShopWithStars(
  input: ShopCheckoutStarsInput
): ShopCheckoutStarsOk | ShopCheckoutFail {
  const bad = validateCustomer(input);
  if (bad) return bad;

  const user = dbService.getUserById(input.userId);
  if (!user) {
    return { ok: false, reason: 'user_missing', error: 'کاربر پیدا نشد.' };
  }

  const built = buildLines(input.items);
  if (!built.ok) return built.fail;
  const { lines } = built;

  const name = input.customerName.trim();
  const phone = input.customerPhone.trim();
  const address = input.address.trim();
  const totalToman = lines.reduce((s, l) => s + l.priceToman * l.qty, 0);
  const starsNeeded = lines.reduce((s, l) => s + l.lineStars, 0);
  const cogsToman = cogsOf(lines);

  const balance = user.wallet?.stars ?? user.walletStars ?? 0;
  if (balance < starsNeeded) {
    return {
      ok: false,
      reason: 'insufficient_stars',
      error: `موجودی ستاره کافی نیست. نیاز: ${starsNeeded.toLocaleString('fa-IR')} — موجودی: ${balance.toLocaleString('fa-IR')}`,
      balance,
      cost: starsNeeded,
    };
  }

  const note = orderNote(address, input.note);
  const d = getDb();
  try {
    const result = d.transaction(() => {
      const debited = dbService.debitStars(input.userId, starsNeeded, { skipLedger: true });
      if (!debited) {
        const w = dbService.getWallet(input.userId);
        throw Object.assign(new Error('INSUFFICIENT'), {
          balance: w?.stars ?? 0,
          cost: starsNeeded,
        });
      }

      const order = adminPlatform.createShopOrder({
        userId: input.userId,
        status: 'paid',
        totalToman,
        items: lines.map((l) => ({
          productId: l.productId,
          title: l.title,
          categorySlug: l.categorySlug,
          qty: l.qty,
          priceToman: l.priceToman,
          costToman: l.costToman ?? Math.floor(l.priceToman * 0.65),
          coins: l.lineStars,
        })),
        customerName: name,
        customerPhone: phone,
        note,
        paymentCurrency: 'stars',
        paymentAmount: starsNeeded,
        cogsToman,
      });

      d.prepare(
        `INSERT INTO wallet_ledger (user_id, currency, amount, direction, reason, ref_type, ref_id)
         VALUES (?, 'stars', ?, 'debit', ?, 'shop_order', ?)`
      ).run(input.userId, starsNeeded, 'خرید فروشگاه با ستاره', String(order.id));

      // ثبت در payment_orders تا در پنل ادمین «پرداخت‌ها» دیده شود
      d.prepare(
        `INSERT INTO payment_orders (
          user_id, package_id, coins, amount_toman, amount_stars, method, status, admin_note, reviewed_at
        ) VALUES (?, 'shopwallet', 0, ?, ?, 'stars', 'paid', ?, datetime('now'))`
      ).run(
        input.userId,
        totalToman,
        starsNeeded,
        JSON.stringify({
          v: 1,
          kind: 'shopwallet',
          shopOrderId: order.id,
          titleHint: lines[0]?.title || 'خرید پت شاپ',
        })
      );

      return {
        order,
        starsRemaining: debited.wallet?.stars ?? debited.walletStars ?? 0,
      };
    })();

    return {
      ok: true,
      order: result.order,
      starsSpent: starsNeeded,
      starsRemaining: result.starsRemaining,
      totalToman,
      lines,
    };
  } catch (err) {
    const e = err as { message?: string; balance?: number; cost?: number };
    if (e?.message === 'INSUFFICIENT') {
      return {
        ok: false,
        reason: 'insufficient_stars',
        error: `موجودی ستاره کافی نیست. نیاز: ${(e.cost ?? starsNeeded).toLocaleString('fa-IR')} — موجودی: ${(e.balance ?? 0).toLocaleString('fa-IR')}`,
        balance: e.balance ?? 0,
        cost: e.cost ?? starsNeeded,
      };
    }
    throw err;
  }
}

function shopXtrBotDeepLink(paymentOrderId: number): string {
  const bot =
    String(process.env.TELEGRAM_BOT_USERNAME || 'Petdatebot').replace(/^@/, '') || 'Petdatebot';
  return `https://t.me/${bot}?start=shoppay_${paymentOrderId}`;
}

function shopXtrWebSuccessUrl(paymentOrderId: number, receiptToken?: string): string {
  const web = String(process.env.PUBLIC_WEB_URL || process.env.WEB_URL || 'https://petdate.ir').replace(
    /\/$/,
    ''
  );
  const base = `${web}/shop/stars-pay/${paymentOrderId}`;
  return receiptToken ? `${base}?t=${encodeURIComponent(receiptToken)}` : base;
}

/**
 * ثبت فاکتور در انتظار برای خرید فروشگاه با Telegram Stars (XTR → ربات).
 * موجودی wallet_stars کسر نمی‌شود؛ بعد از successful_payment سفارش شاپ ساخته می‌شود.
 */
export function prepareShopStarsXtrCheckout(
  input: ShopCheckoutStarsInput
): ShopStarsXtrPrepareOk | ShopCheckoutFail {
  const bad = validateCustomer(input);
  if (bad) return bad;

  const user = dbService.getUserById(input.userId);
  if (!user) {
    return { ok: false, reason: 'user_missing', error: 'کاربر پیدا نشد.' };
  }

  const built = buildLines(input.items);
  if (!built.ok) return built.fail;
  const { lines } = built;

  const totalToman = lines.reduce((s, l) => s + l.priceToman * l.qty, 0);
  const stars = lines.reduce((s, l) => s + l.lineStars, 0);
  if (stars <= 0) {
    return { ok: false, reason: 'empty_cart', error: 'مبلغ ستاره نامعتبر است.' };
  }

  const titleHint = lines
    .map((l) => l.title)
    .join(' · ')
    .slice(0, 80);
  const receiptToken = randomBytes(16).toString('hex');
  const meta: ShopXtrMeta = {
    v: 1,
    kind: 'shopxtr',
    items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    address: input.address.trim(),
    note: input.note?.trim() || undefined,
    totalToman,
    stars,
    titleHint,
    receiptToken,
  };

  const payment = dbService.createPaymentOrder({
    userId: input.userId,
    packageId: SHOP_XTR_PACKAGE_ID,
    coins: 0,
    amountToman: totalToman,
    amountStars: stars,
    method: 'stars',
    status: 'awaiting_stars',
    adminNote: encodeShopXtrMeta(meta),
  });

  return {
    ok: true,
    paymentOrderId: payment.id,
    stars,
    totalToman,
    lines,
    titleHint,
    botDeepLink: shopXtrBotDeepLink(payment.id),
    webSuccessUrl: shopXtrWebSuccessUrl(payment.id, receiptToken),
    receiptToken,
    message: `فاکتور ${stars.toLocaleString('fa-IR')} ستاره آماده است. با پرداخت Stars تلگرام، مبلغ مستقیم به ربات واریز و سفارش ثبت می‌شود.`,
  };
}

/** وضعیت فاکتور XTR شاپ برای صفحه انتظار/رسید وب */
export function getShopStarsXtrStatus(
  paymentOrderId: number,
  access: { userId?: number; receiptToken?: string }
): ShopStarsXtrStatusOk | { ok: false; reason: 'missing' | 'forbidden'; error: string } {
  const order = dbService.getPaymentOrder(paymentOrderId);
  if (!order || !isShopXtrPackageId(order.packageId)) {
    return { ok: false, reason: 'missing', error: 'فاکتور پیدا نشد.' };
  }
  const meta = parseShopXtrMeta(order.adminNote);
  const tokenOk =
    Boolean(access.receiptToken) &&
    Boolean(meta?.receiptToken) &&
    access.receiptToken === meta?.receiptToken;
  const ownerOk = access.userId != null && order.userId === access.userId;
  if (!ownerOk && !tokenOk) {
    return { ok: false, reason: 'forbidden', error: 'این فاکتور متعلق به حساب دیگری است.' };
  }
  const paid = order.status === 'paid';
  const receiptToken = meta?.receiptToken;
  return {
    ok: true,
    paymentOrderId: order.id,
    status: order.status,
    stars: Math.floor(Number(order.amountStars ?? meta?.stars ?? 0)),
    totalToman: Math.floor(Number(order.amountToman ?? meta?.totalToman ?? 0)),
    titleHint: meta?.titleHint,
    shopOrderId: meta?.shopOrderId,
    chargeId: order.telegramPaymentChargeId,
    paidAt: paid ? order.reviewedAt || order.createdAt : undefined,
    botDeepLink: shopXtrBotDeepLink(order.id),
    webSuccessUrl: shopXtrWebSuccessUrl(order.id, receiptToken),
    receiptToken,
    paid,
  };
}

/**
 * بعد از successful_payment (XTR): علامت‌گذاری payment_order و ساخت سفارش شاپ paid.
 * ستاره‌ها به اکانت ربات رفته‌اند — wallet_stars کاربر تغییر نمی‌کند،
 * ولی ردیف debit در wallet_ledger برای تاریخچه تراکنش‌های کاربر ثبت می‌شود.
 */
export function completeShopStarsXtrPayment(input: {
  orderId: number;
  telegramPaymentChargeId: string;
}):
  | ShopStarsXtrCompleteOk
  | { ok: false; reason: 'missing' | 'bad_status' | 'bad_meta' | 'already'; error: string } {
  const existing = dbService.getPaymentOrder(input.orderId);
  if (!existing) {
    return { ok: false, reason: 'missing', error: 'سفارش پرداخت پیدا نشد.' };
  }
  if (!isShopXtrPackageId(existing.packageId) || existing.method !== 'stars') {
    return { ok: false, reason: 'bad_status', error: 'این فاکتور برای خرید فروشگاه نیست.' };
  }

  if (existing.status === 'paid') {
    const meta = parseShopXtrMeta(existing.adminNote);
    const shopOrder =
      meta?.shopOrderId != null ? adminPlatform.getShopOrder(meta.shopOrderId) : null;
    if (shopOrder) {
      return {
        ok: true,
        paymentOrder: existing,
        shopOrder,
        starsSpent: Math.floor(Number(existing.amountStars ?? meta?.stars ?? 0)),
        totalToman: Math.floor(Number(existing.amountToman ?? meta?.totalToman ?? shopOrder.totalToman)),
        credited: false,
        creditKind: 'shop_order',
      };
    }
    return { ok: false, reason: 'already', error: 'پرداخت قبلاً ثبت شده ولی سفارش شاپ ناقص است.' };
  }

  if (existing.status !== 'awaiting_stars') {
    return { ok: false, reason: 'bad_status', error: 'وضعیت فاکتور برای تکمیل مناسب نیست.' };
  }

  const meta = parseShopXtrMeta(existing.adminNote);
  if (!meta) {
    return { ok: false, reason: 'bad_meta', error: 'اطلاعات سفارش فروشگاه نامعتبر است.' };
  }

  const built = buildLines(meta.items);
  if (!built.ok) {
    return { ok: false, reason: 'bad_meta', error: built.fail.error };
  }
  const { lines } = built;
  const totalToman = lines.reduce((s, l) => s + l.priceToman * l.qty, 0);
  const starsNeeded = lines.reduce((s, l) => s + l.lineStars, 0);
  const starsPaid = Math.floor(Number(existing.amountStars ?? 0));
  if (starsPaid !== starsNeeded || starsPaid <= 0) {
    return { ok: false, reason: 'bad_meta', error: 'مبلغ ستاره فاکتور با سبد هم‌خوان نیست.' };
  }

  const addressNote = orderNote(meta.address, meta.note);
  const chargeId = input.telegramPaymentChargeId.trim();
  const note = [
    addressNote,
    '—',
    'پرداخت: Telegram Stars (XTR → ربات)',
    `فاکتور پرداخت: #${input.orderId}`,
    `مبلغ: ${starsNeeded} ستاره`,
    chargeId ? `شناسه تراکنش تلگرام: ${chargeId}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  const cogsToman = cogsOf(lines);
  const d = getDb();

  try {
    const result = d.transaction(() => {
      const updated = d
        .prepare(
          `UPDATE payment_orders
           SET status = 'paid',
               telegram_payment_charge_id = ?,
               reviewed_at = datetime('now')
           WHERE id = ? AND status = 'awaiting_stars'`
        )
        .run(chargeId || null, input.orderId);
      if (updated.changes !== 1) throw new Error('BAD_STATUS');

      const order = adminPlatform.createShopOrder({
        userId: existing.userId,
        status: 'paid',
        totalToman,
        items: lines.map((l) => ({
          productId: l.productId,
          title: l.title,
          categorySlug: l.categorySlug,
          qty: l.qty,
          priceToman: l.priceToman,
          costToman: l.costToman ?? Math.floor(l.priceToman * 0.65),
          coins: l.lineStars,
          stars: l.lineStars,
        })),
        customerName: meta.customerName,
        customerPhone: meta.customerPhone,
        note,
        paymentCurrency: 'stars_xtr',
        paymentAmount: starsNeeded,
        cogsToman,
      });

      const nextMeta: ShopXtrMeta = { ...meta, shopOrderId: order.id, totalToman, stars: starsNeeded };
      d.prepare(`UPDATE payment_orders SET admin_note = ? WHERE id = ?`).run(
        encodeShopXtrMeta(nextMeta),
        input.orderId
      );

      // تاریخچه تراکنش کاربر: Stars از تلگرام رفته‌اند (نه wallet_stars)، ولی خرید باید در لجر دیده شود
      d.prepare(
        `INSERT INTO wallet_ledger (user_id, currency, amount, direction, reason, ref_type, ref_id)
         VALUES (?, 'stars', ?, 'debit', ?, 'shop_order', ?)`
      ).run(
        existing.userId,
        starsNeeded,
        'خرید پت شاپ با Stars تلگرام',
        String(order.id)
      );

      return order;
    })();

    return {
      ok: true,
      paymentOrder: dbService.getPaymentOrder(input.orderId)!,
      shopOrder: result,
      starsSpent: starsNeeded,
      totalToman,
      credited: true,
      creditKind: 'shop_order',
    };
  } catch (err) {
    if (err instanceof Error && err.message === 'BAD_STATUS') {
      const again = dbService.getPaymentOrder(input.orderId);
      if (again?.status === 'paid') {
        const m = parseShopXtrMeta(again.adminNote);
        const shopOrder = m?.shopOrderId != null ? adminPlatform.getShopOrder(m.shopOrderId) : null;
        if (shopOrder) {
          return {
            ok: true,
            paymentOrder: again,
            shopOrder,
            starsSpent: starsNeeded,
            totalToman,
            credited: false,
            creditKind: 'shop_order',
          };
        }
      }
      return { ok: false, reason: 'bad_status', error: 'تکمیل پرداخت ممکن نشد.' };
    }
    throw err;
  }
}

/** Quote coin cost for a cart without debiting. */
export function quoteShopCoins(
  items: ShopCheckoutItemInput[]
):
  | { ok: true; totalToman: number; coins: number; lines: ShopCheckoutLine[]; balanceNeeded: number }
  | ShopCheckoutFail {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, reason: 'empty_cart', error: 'سبد خرید خالی است.' };
  }
  const built = buildLines(items);
  if (!built.ok) return built.fail;
  const { lines } = built;
  const totalToman = lines.reduce((s, l) => s + l.priceToman * l.qty, 0);
  const coins = lines.reduce((s, l) => s + l.lineCoins, 0);
  return { ok: true, totalToman, coins, lines, balanceNeeded: coins };
}

/** Quote star cost for a cart without debiting. */
export function quoteShopStars(
  items: ShopCheckoutItemInput[]
):
  | { ok: true; totalToman: number; stars: number; lines: ShopCheckoutLine[]; balanceNeeded: number }
  | ShopCheckoutFail {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, reason: 'empty_cart', error: 'سبد خرید خالی است.' };
  }
  const built = buildLines(items);
  if (!built.ok) return built.fail;
  const { lines } = built;
  const totalToman = lines.reduce((s, l) => s + l.priceToman * l.qty, 0);
  const stars = lines.reduce((s, l) => s + l.lineStars, 0);
  return { ok: true, totalToman, stars, lines, balanceNeeded: stars };
}

/** payment_orders.package_id برای خرید شاپ با تومان پنل / کارت‌به‌کارت */
export const SHOP_TOMAN_PACKAGE_ID = 'shoptoman';
export const SHOP_CARD_PACKAGE_ID = 'shopcard';

export type ShopCardMeta = {
  v: 1;
  kind: 'shopcard';
  items: ShopCheckoutItemInput[];
  customerName: string;
  customerPhone: string;
  address: string;
  note?: string;
  totalToman: number;
  titleHint?: string;
  shopOrderId?: number;
  receiptToken?: string;
  rejectNote?: string;
};

export function isShopCardPackageId(packageId: string | null | undefined): boolean {
  return String(packageId || '') === SHOP_CARD_PACKAGE_ID;
}

export function encodeShopCardMeta(meta: ShopCardMeta): string {
  return JSON.stringify(meta);
}

export function parseShopCardMeta(raw?: string | null): ShopCardMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ShopCardMeta;
    if (!parsed || parsed.kind !== 'shopcard' || parsed.v !== 1) return null;
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export type ShopCheckoutTomanOk = {
  ok: true;
  order: ShopOrderRow;
  tomanSpent: number;
  tomanRemaining: number;
  totalToman: number;
  lines: ShopCheckoutLine[];
};

/**
 * پرداخت فروشگاه با تومان کیف‌پول (users.wallet_toman).
 */
export function checkoutShopWithToman(
  input: ShopCheckoutCoinsInput
): ShopCheckoutTomanOk | ShopCheckoutFail {
  const bad = validateCustomer(input);
  if (bad) return bad;

  const user = dbService.getUserById(input.userId);
  if (!user) {
    return { ok: false, reason: 'user_missing', error: 'کاربر پیدا نشد.' };
  }

  const built = buildLines(input.items);
  if (!built.ok) return built.fail;
  const { lines } = built;

  const name = input.customerName.trim();
  const phone = input.customerPhone.trim();
  const address = input.address.trim();
  const totalToman = lines.reduce((s, l) => s + l.priceToman * l.qty, 0);
  const cogsToman = cogsOf(lines);
  if (totalToman <= 0) {
    return { ok: false, reason: 'empty_cart', error: 'مبلغ سفارش نامعتبر است.' };
  }

  const balance = user.wallet?.toman ?? user.walletToman ?? 0;
  if (balance < totalToman) {
    return {
      ok: false,
      reason: 'insufficient_toman',
      error: `موجودی تومان کافی نیست. نیاز: ${totalToman.toLocaleString('fa-IR')} — موجودی: ${balance.toLocaleString('fa-IR')}`,
      balance,
      cost: totalToman,
    };
  }

  const note = orderNote(address, input.note);
  const d = getDb();
  try {
    const result = d.transaction(() => {
      const debited = dbService.creditWallet(input.userId, 'toman', -totalToman, {
        skipLedger: true,
        reason: 'خرید فروشگاه با تومان',
      });
      if (!debited.ok) {
        const w = dbService.getWallet(input.userId);
        throw Object.assign(new Error('INSUFFICIENT'), {
          balance: w?.toman ?? 0,
          cost: totalToman,
        });
      }

      const order = adminPlatform.createShopOrder({
        userId: input.userId,
        status: 'paid',
        totalToman,
        items: lines.map((l) => ({
          productId: l.productId,
          title: l.title,
          categorySlug: l.categorySlug,
          qty: l.qty,
          priceToman: l.priceToman,
          costToman: l.costToman ?? Math.floor(l.priceToman * 0.65),
          coins: l.lineCoins,
        })),
        customerName: name,
        customerPhone: phone,
        note,
        paymentCurrency: 'toman',
        paymentAmount: totalToman,
        cogsToman,
      });

      d.prepare(
        `INSERT INTO wallet_ledger (user_id, currency, amount, direction, reason, ref_type, ref_id)
         VALUES (?, 'toman', ?, 'debit', ?, 'shop_order', ?)`
      ).run(input.userId, totalToman, 'خرید فروشگاه با تومان', String(order.id));

      d.prepare(
        `INSERT INTO payment_orders (
          user_id, package_id, coins, amount_toman, amount_stars, method, status, admin_note, reviewed_at
        ) VALUES (?, 'shoptoman', 0, ?, NULL, 'toman', 'paid', ?, datetime('now'))`
      ).run(
        input.userId,
        totalToman,
        JSON.stringify({
          v: 1,
          kind: 'shoptoman',
          shopOrderId: order.id,
          titleHint: lines[0]?.title || 'خرید پت شاپ',
        })
      );

      return {
        order,
        tomanRemaining: debited.user.wallet?.toman ?? debited.user.walletToman ?? 0,
      };
    })();

    return {
      ok: true,
      order: result.order,
      tomanSpent: totalToman,
      tomanRemaining: result.tomanRemaining,
      totalToman,
      lines,
    };
  } catch (err) {
    const e = err as { message?: string; balance?: number; cost?: number };
    if (e?.message === 'INSUFFICIENT') {
      return {
        ok: false,
        reason: 'insufficient_toman',
        error: `موجودی تومان کافی نیست. نیاز: ${(e.cost ?? totalToman).toLocaleString('fa-IR')} — موجودی: ${(e.balance ?? 0).toLocaleString('fa-IR')}`,
        balance: e.balance ?? 0,
        cost: e.cost ?? totalToman,
      };
    }
    throw err;
  }
}

export type ShopCardPrepareOk = {
  ok: true;
  paymentOrderId: number;
  totalToman: number;
  lines: ShopCheckoutLine[];
  titleHint: string;
  botDeepLink: string;
  webSuccessUrl: string;
  receiptToken: string;
  cardNumber: string;
  cardHolder: string;
  message: string;
};

function shopCardBotDeepLink(paymentOrderId: number): string {
  const bot =
    String(process.env.TELEGRAM_BOT_USERNAME || 'Petdatebot').replace(/^@/, '') || 'Petdatebot';
  return `https://t.me/${bot}?start=shopcard_${paymentOrderId}`;
}

function shopCardWebSuccessUrl(paymentOrderId: number, receiptToken?: string): string {
  const web = String(process.env.PUBLIC_WEB_URL || process.env.WEB_URL || 'https://petdate.ir').replace(
    /\/$/,
    ''
  );
  const base = `${web}/shop/card-pay/${paymentOrderId}`;
  return receiptToken ? `${base}?t=${encodeURIComponent(receiptToken)}` : base;
}


/**
 * ثبت سفارش کارت‌به‌کارت شاپ — بعد از آپلود رسید و تأیید ادمین، سفارش شاپ ساخته می‌شود.
 */
export function prepareShopCardCheckout(
  input: ShopCheckoutCoinsInput
): ShopCardPrepareOk | ShopCheckoutFail {
  const bad = validateCustomer(input);
  if (bad) return bad;

  const user = dbService.getUserById(input.userId);
  if (!user) {
    return { ok: false, reason: 'user_missing', error: 'کاربر پیدا نشد.' };
  }

  const built = buildLines(input.items);
  if (!built.ok) return built.fail;
  const { lines } = built;

  const totalToman = lines.reduce((s, l) => s + l.priceToman * l.qty, 0);
  if (totalToman <= 0) {
    return { ok: false, reason: 'empty_cart', error: 'مبلغ سفارش نامعتبر است.' };
  }

  const titleHint = lines
    .map((l) => l.title)
    .join(' · ')
    .slice(0, 80);
  const receiptToken = randomBytes(16).toString('hex');
  const meta: ShopCardMeta = {
    v: 1,
    kind: 'shopcard',
    items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    address: input.address.trim(),
    note: input.note?.trim() || undefined,
    totalToman,
    titleHint,
    receiptToken,
  };

  const payment = dbService.createPaymentOrder({
    userId: input.userId,
    packageId: SHOP_CARD_PACKAGE_ID,
    coins: 0,
    amountToman: totalToman,
    amountStars: undefined,
    method: 'card',
    status: 'awaiting_receipt',
    adminNote: encodeShopCardMeta(meta),
  });

  const card = paymentCardFromEnv();
  return {
    ok: true,
    paymentOrderId: payment.id,
    totalToman,
    lines,
    titleHint,
    botDeepLink: shopCardBotDeepLink(payment.id),
    webSuccessUrl: shopCardWebSuccessUrl(payment.id, receiptToken),
    receiptToken,
    cardNumber: card.number,
    cardHolder: card.holder,
    message: `مبلغ ${totalToman.toLocaleString('fa-IR')} تومان را کارت‌به‌کارت واریز کن و عکس رسید را در ربات بفرست.`,
  };
}

/**
 * بعد از تأیید ادمین روی رسید کارت شاپ — ساخت سفارش paid.
 */
export function completeShopCardPayment(input: {
  orderId: number;
  adminNote?: string;
}):
  | { ok: true; paymentOrder: PaymentOrder; shopOrder: ShopOrderRow; user: ReturnType<typeof dbService.getUserById> }
  | ShopCheckoutFail {
  const payment = dbService.getPaymentOrder(input.orderId);
  if (!payment) {
    return { ok: false, reason: 'payment_missing', error: 'سفارش پرداخت پیدا نشد.' };
  }
  if (!isShopCardPackageId(payment.packageId)) {
    return { ok: false, reason: 'bad_meta', error: 'این سفارش شاپ کارت نیست.' };
  }
  if (payment.method !== 'card' || payment.status !== 'pending') {
    return { ok: false, reason: 'bad_status', error: 'وضعیت پرداخت برای تأیید مناسب نیست.' };
  }

  const meta = parseShopCardMeta(payment.adminNote);
  if (!meta) {
    return { ok: false, reason: 'bad_meta', error: 'اطلاعات سفارش شاپ ناقص است.' };
  }
  if (meta.shopOrderId) {
    const existingOrder = adminPlatform.getShopOrder(meta.shopOrderId);
    if (existingOrder) {
      return {
        ok: true,
        paymentOrder: payment,
        shopOrder: existingOrder,
        user: dbService.getUserById(payment.userId),
      };
    }
  }

  const built = buildLines(meta.items);
  if (!built.ok) return built.fail;
  const { lines } = built;
  const totalToman = lines.reduce((s, l) => s + l.priceToman * l.qty, 0);
  const cogsToman = cogsOf(lines);
  const note = orderNote(meta.address, meta.note);

  const d = getDb();
  try {
    const result = d.transaction(() => {
      const updated = d
        .prepare(
          `UPDATE payment_orders
           SET status = 'approved',
               admin_note = ?,
               reviewed_at = datetime('now')
           WHERE id = ? AND status = 'pending'`
        )
        .run(
          encodeShopCardMeta({
            ...meta,
            // keep cart meta; optional admin note stored separately in rejectNote field reuse
            rejectNote: input.adminNote?.trim() || meta.rejectNote,
          }),
          input.orderId
        );
      if (updated.changes !== 1) throw new Error('BAD_STATUS');

      const order = adminPlatform.createShopOrder({
        userId: payment.userId,
        status: 'paid',
        totalToman,
        items: lines.map((l) => ({
          productId: l.productId,
          title: l.title,
          categorySlug: l.categorySlug,
          qty: l.qty,
          priceToman: l.priceToman,
          costToman: l.costToman ?? Math.floor(l.priceToman * 0.65),
          coins: l.lineCoins,
        })),
        customerName: meta.customerName,
        customerPhone: meta.customerPhone,
        note: [
          note,
          'پرداخت: کارت‌به‌کارت (ریال)',
          `فاکتور پرداخت: #${input.orderId}`,
        ]
          .filter(Boolean)
          .join('\n'),
        paymentCurrency: 'toman_card',
        paymentAmount: totalToman,
        cogsToman,
      });

      d.prepare(
        `UPDATE payment_orders SET admin_note = ? WHERE id = ?`
      ).run(
        encodeShopCardMeta({
          ...meta,
          shopOrderId: order.id,
          rejectNote: input.adminNote?.trim() || meta.rejectNote,
        }),
        input.orderId
      );

      return order;
    })();

    return {
      ok: true,
      paymentOrder: dbService.getPaymentOrder(input.orderId)!,
      shopOrder: result,
      user: dbService.getUserById(payment.userId),
    };
  } catch (err) {
    if (err instanceof Error && err.message === 'BAD_STATUS') {
      return { ok: false, reason: 'bad_status', error: 'تأیید ممکن نشد.' };
    }
    throw err;
  }
}

export function getShopCardStatus(
  paymentOrderId: number,
  opts?: { userId?: number; receiptToken?: string }
):
  | {
      ok: true;
      paid: boolean;
      status: string;
      totalToman: number;
      shopOrderId?: number;
      botDeepLink: string;
      cardNumber: string;
      cardMasked: string;
      cardGrouped: string;
      cardHolder: string;
      transferRef?: string;
      receiptUrl?: string;
      paidAt?: string;
    }
  | { ok: false; reason: 'missing' | 'forbidden'; error: string } {
  const payment = dbService.getPaymentOrder(paymentOrderId);
  if (!payment || !isShopCardPackageId(payment.packageId)) {
    return { ok: false, reason: 'missing', error: 'فاکتور پیدا نشد.' };
  }
  const meta = parseShopCardMeta(payment.adminNote);
  if (opts?.userId != null && payment.userId !== opts.userId) {
    if (!opts.receiptToken || !meta?.receiptToken || opts.receiptToken !== meta.receiptToken) {
      return { ok: false, reason: 'forbidden', error: 'دسترسی ندارید.' };
    }
  } else if (opts?.userId == null && opts?.receiptToken) {
    if (!meta?.receiptToken || opts.receiptToken !== meta.receiptToken) {
      return { ok: false, reason: 'forbidden', error: 'دسترسی ندارید.' };
    }
  } else if (opts?.userId == null) {
    return { ok: false, reason: 'forbidden', error: 'دسترسی ندارید.' };
  }

  const card = paymentCardPublicInfo();
  const paid = payment.status === 'approved' || Boolean(meta?.shopOrderId);
  let receiptUrl = payment.receiptUrl;
  if (receiptUrl?.startsWith('/api/payments/receipts/') && meta?.receiptToken) {
    receiptUrl = `${receiptUrl}?t=${encodeURIComponent(meta.receiptToken)}`;
  }
  return {
    ok: true,
    paid,
    status: payment.status,
    totalToman: payment.amountToman ?? meta?.totalToman ?? 0,
    shopOrderId: meta?.shopOrderId,
    botDeepLink: shopCardBotDeepLink(paymentOrderId),
    cardNumber: card.cardNumber,
    cardMasked: card.cardMasked,
    cardGrouped: card.cardGrouped,
    cardHolder: card.cardHolder,
    transferRef: payment.transferRef,
    receiptUrl,
    paidAt: paid ? payment.reviewedAt ?? undefined : undefined,
  };
}
