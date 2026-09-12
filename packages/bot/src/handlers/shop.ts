/**
 * پت شاپ ربات — کاتالوگ و پرداخت از همان API/DB وب.
 */
import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import {
  COIN_PRICE_TOMAN,
  STAR_PRICE_TOMAN,
  tomanToShopCoins,
  tomanToShopStars,
  type BotSession,
} from '@petdate/shared';
import {
  checkoutShopWithCardTelegram,
  checkoutShopWithCoinsTelegram,
  checkoutShopWithStarsTelegram,
  checkoutShopWithTomanTelegram,
  checkoutShopWithWalletStarsTelegram,
  fetchMyShopOrdersTelegram,
  fetchShopCategories,
  fetchShopProduct,
  fetchShopProducts,
  type ShopApiCategory,
  type ShopApiProduct,
} from '../api-client';
import { paymentCardInfo } from '../economy';
import { getSession, upsertSession } from '../session';
import { effectiveWebUrl, isTelegramInlineUrl } from '../urls';
import { getCtxUser, menuKeyboardFor, pushMainMenuKeyboard } from './helpers';
import { replyIfFeatureOff } from '../runtime-config';

const PAGE_SIZE = 6;
type ShopPayMethod = 'coins' | 'wallet_stars' | 'telegram_stars' | 'toman' | 'card';

function normalizeShopPayMethod(raw?: string | null): ShopPayMethod {
  const m = String(raw || '').trim();
  if (m === 'wallet_stars' || m === 'wstars') return 'wallet_stars';
  if (m === 'telegram_stars' || m === 'stars' || m === 'xtr') return 'telegram_stars';
  if (m === 'toman' || m === 'rial' || m === 'irr') return 'toman';
  if (m === 'card' || m === 'card2card') return 'card';
  return 'coins';
}

const PET_TYPES = [
  { id: 'dog' as const, label: '🐕 سگ' },
  { id: 'cat' as const, label: '🐈 گربه' },
  { id: 'bird' as const, label: '🐦 پرنده' },
];

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatToman(n: number): string {
  return `${Math.floor(n || 0).toLocaleString('fa-IR')} تومان`;
}

function formatCoins(n: number): string {
  return `${Math.floor(n || 0).toLocaleString('fa-IR')} سکه`;
}

function formatStars(n: number): string {
  return `${Math.floor(n || 0).toLocaleString('fa-IR')} ستاره`;
}

function webShopUrl(path = '/shop'): string | null {
  const base = effectiveWebUrl().replace(/\/$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  return isTelegramInlineUrl(url) ? url : null;
}

function absoluteImageUrl(image?: string): string | null {
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  const base = effectiveWebUrl().replace(/\/$/, '');
  if (!isTelegramInlineUrl(base)) return null;
  return `${base}${image.startsWith('/') ? image : `/${image}`}`;
}

async function patchSession(
  telegramId: string,
  patch: Partial<BotSession>
): Promise<BotSession> {
  const prev = (await getSession(telegramId)) ?? {
    telegramId,
    step: 'ready' as const,
    locale: 'fa',
    updatedAt: new Date().toISOString(),
  };
  const next = { ...prev, ...patch, telegramId, updatedAt: new Date().toISOString() };
  await upsertSession(telegramId, next);
  return next;
}

function homeKeyboard(balance: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const [i, pet] of PET_TYPES.entries()) {
    kb.text(pet.label, `shop:pet:${pet.id}`);
    if (i % 2 === 1) kb.row();
  }
  if (PET_TYPES.length % 2 === 1) kb.row();
  kb.text('⭐ پیشنهادی', 'shop:featured').row();
  kb.text('📦 سفارش‌های من', 'shop:orders').row();
  const site = webShopUrl('/shop');
  const ordersSite = webShopUrl('/shop/orders');
  if (site) kb.url('🌐 باز کردن در سایت', site).row();
  if (ordersSite) kb.url('🌐 سفارش‌ها در سایت', ordersSite).row();
  kb.text('🪙 کیف سکه', 'coins:back');
  void balance;
  return kb;
}

function categoriesKeyboard(cats: ShopApiCategory[], petType: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  cats.forEach((c, i) => {
    const label = `${c.emoji || '🛒'} ${c.labelFa}`.slice(0, 28);
    kb.text(label, `shop:c:${c.slug}`);
    if (i % 2 === 1) kb.row();
  });
  if (cats.length % 2 === 1) kb.row();
  kb.text('↩️ بازگشت', 'shop:home');
  void petType;
  return kb;
}

function productsKeyboard(
  products: ShopApiProduct[],
  categorySlug: string | 'featured',
  page: number,
  total: number
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const p of products) {
    const coins = p.coins ?? tomanToShopCoins(p.priceToman);
    const title = p.title.length > 26 ? `${p.title.slice(0, 24)}…` : p.title;
    kb.text(`${title} · ${coins.toLocaleString('fa-IR')}🪙`, `shop:v:${p.id}`).row();
  }
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  if (page > 0 || page < maxPage) {
    if (page > 0) kb.text('◀️ قبل', `shop:page:${categorySlug}:${page - 1}`);
    kb.text(`${(page + 1).toLocaleString('fa-IR')}/${(maxPage + 1).toLocaleString('fa-IR')}`, 'shop:noop');
    if (page < maxPage) kb.text('بعد ▶️', `shop:page:${categorySlug}:${page + 1}`);
    kb.row();
  }
  if (categorySlug === 'featured') {
    kb.text('↩️ منوی شاپ', 'shop:home');
  } else {
    kb.text('↩️ دسته‌ها', 'shop:backcat').text('🏠 منوی شاپ', 'shop:home');
  }
  return kb;
}

function productKeyboard(product: ShopApiProduct, categorySlug?: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (product.inStock) {
    kb.text('🛒 خرید', `shop:buy:${product.id}:1`).row();
  }
  const site = webShopUrl(`/shop/p/${product.slug || product.id}`);
  if (site) kb.url('🌐 جزئیات در سایت', site).row();
  if (categorySlug) kb.text('↩️ لیست', `shop:c:${categorySlug}`);
  else kb.text('↩️ پیشنهادی', 'shop:featured');
  kb.text('🏠 منوی شاپ', 'shop:home');
  return kb;
}

function confirmKeyboard(productId: string, qty: number, method: ShopPayMethod = 'coins'): InlineKeyboard {
  const mark = (m: ShopPayMethod, label: string) => (method === m ? `✓ ${label}` : label);
  return new InlineKeyboard()
    .text(mark('coins', '🪙 سکه پنل'), `shop:method:coins:${productId}:${qty}`)
    .row()
    .text(mark('wallet_stars', '⭐ ستاره پنل'), `shop:method:wstars:${productId}:${qty}`)
    .row()
    .text(mark('toman', '﷼ ریال پنل'), `shop:method:toman:${productId}:${qty}`)
    .row()
    .text(mark('card', '💳 کارت‌به‌کارت'), `shop:method:card:${productId}:${qty}`)
    .row()
    .text(mark('telegram_stars', '📱 فاکتور تلگرام'), `shop:method:xtr:${productId}:${qty}`)
    .row()
    .text('✅ پرداخت', `shop:payNow:${productId}:${qty}`)
    .row()
    .text('❌ انصراف', 'shop:home');
}

function payMethodHint(method: ShopPayMethod): string {
  if (method === 'wallet_stars') {
    return 'با پرداخت، ستاره از پنل پت‌دیت (کیف‌پول مشترک) کسر می‌شود.';
  }
  if (method === 'toman') {
    return 'با پرداخت، تومان از کیف‌پول پنل کسر می‌شود.';
  }
  if (method === 'card') {
    return 'کارت‌به‌کارت واریز کن و عکس رسید را بفرست؛ بعد از تأیید ادمین سفارش ثبت می‌شود.';
  }
  if (method === 'telegram_stars') {
    return 'فاکتور Stars صادر می‌شود؛ همان‌جا در تلگرام پرداخت کن (مستقیم به ربات).';
  }
  return 'با پرداخت، سکه از پنل پت‌دیت (کیف‌پول مشترک) کسر می‌شود.';
}

function payMethodLine(method: ShopPayMethod, coins: number, stars: number, toman: number): string {
  if (method === 'wallet_stars') return `روش: ستاره پنل · ${formatStars(stars)}`;
  if (method === 'toman') return `روش: ریال پنل · ${formatToman(toman)}`;
  if (method === 'card') return `روش: کارت‌به‌کارت · ${formatToman(toman)}`;
  if (method === 'telegram_stars') return `روش: فاکتور تلگرام · ${formatStars(stars)}`;
  return `روش: سکه پنل · ${formatCoins(coins)}`;
}

export async function handlePetShop(ctx: Context): Promise<void> {
  if (await replyIfFeatureOff(ctx, 'shopEnabled')) return;
  const user = await getCtxUser(ctx);
  const balance = user?.coins ?? user?.wallet?.coins ?? 0;
  const starsBalance = user?.wallet?.stars ?? user?.walletStars ?? 0;
  const cats = await fetchShopCategories().catch(() => ({ total: 0, categories: [] as ShopApiCategory[] }));
  const text = [
    '🛒 <b>پت شاپ</b>',
    '',
    'همان کاتالوگ و قیمت سایت — پرداخت با سکه، ریال پنل، کارت‌به‌کارت یا Stars.',
    `موجودی سکه: <b>${formatCoins(balance)}</b>`,
    `موجودی ستاره کیف‌پول: ⭐ <b>${formatStars(starsBalance)}</b>`,
    `موجودی ریال: <b>${formatToman(user?.wallet?.toman ?? user?.walletToman ?? 0)}</b>`,
    `نرخ: هر سکه/ستاره ≈ ${COIN_PRICE_TOMAN.toLocaleString('fa-IR')} تومان`,
    cats.total ? `دسته‌ها در فروشگاه: ${cats.total.toLocaleString('fa-IR')}` : '',
    '',
    'نوع پت را انتخاب کن یا سفارش‌هایت را ببین:',
  ]
    .filter(Boolean)
    .join('\n');

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => undefined);
    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: homeKeyboard(balance) });
      return;
    } catch {
      /* fall through */
    }
  }
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: homeKeyboard(balance) });
  await pushMainMenuKeyboard(ctx, user);
}

export async function handleShopHome(ctx: Context): Promise<void> {
  if (ctx.from) {
    await patchSession(String(ctx.from.id), {
      step: 'ready',
      shopCheckout: undefined,
      shopCategorySlug: undefined,
      shopPage: 0,
    });
  }
  await handlePetShop(ctx);
}

export async function handleShopPetType(ctx: Context, petType: string): Promise<void> {
  const allowed = PET_TYPES.some((p) => p.id === petType);
  if (!allowed) {
    await ctx.answerCallbackQuery({ text: 'نوع پت نامعتبر', show_alert: true });
    return;
  }
  const typed = petType as 'dog' | 'cat' | 'bird';
  if (ctx.from) {
    await patchSession(String(ctx.from.id), {
      shopPetType: typed,
      shopCategorySlug: undefined,
      shopPage: 0,
      step: 'ready',
    });
  }
  const { categories } = await fetchShopCategories(typed);
  await ctx.answerCallbackQuery().catch(() => undefined);
  const label = PET_TYPES.find((p) => p.id === typed)?.label ?? typed;
  const text = [
    `🛒 <b>پت شاپ — ${escapeHtml(label)}</b>`,
    '',
    categories.length
      ? 'یک دسته‌بندی انتخاب کن:'
      : 'دسته‌ای برای این نوع پت پیدا نشد.',
  ].join('\n');
  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: categoriesKeyboard(categories, typed),
    });
  } catch {
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: categoriesKeyboard(categories, typed),
    });
  }
}

export async function handleShopBackCategories(ctx: Context): Promise<void> {
  const session = ctx.from ? await getSession(String(ctx.from.id)) : null;
  const petType = session?.shopPetType;
  if (!petType || petType === 'all') {
    await handleShopHome(ctx);
    return;
  }
  await handleShopPetType(ctx, petType);
}

async function showProductList(
  ctx: Context,
  categorySlug: string | 'featured',
  page: number
): Promise<void> {
  const offset = Math.max(0, page) * PAGE_SIZE;
  const data =
    categorySlug === 'featured'
      ? await fetchShopProducts({ featured: true, inStock: true, limit: PAGE_SIZE, offset })
      : await fetchShopProducts({
          category: categorySlug,
          inStock: true,
          limit: PAGE_SIZE,
          offset,
        });

  if (ctx.from) {
    await patchSession(String(ctx.from.id), {
      shopCategorySlug: categorySlug === 'featured' ? undefined : categorySlug,
      shopPage: page,
      step: 'ready',
    });
  }

  let catTitle = categorySlug;
  if (categorySlug !== 'featured') {
    const cats = await fetchShopCategories().catch(() => ({ categories: [] as ShopApiCategory[] }));
    const found = cats.categories.find((c) => c.slug === categorySlug);
    if (found) catTitle = `${found.emoji || '🛒'} ${found.labelFa}`;
  }

  const title =
    categorySlug === 'featured'
      ? '⭐ محصولات پیشنهادی'
      : `🛒 ${escapeHtml(catTitle)}`;
  const text = [
    `<b>${title}</b>`,
    '',
    data.total
      ? `${data.total.toLocaleString('fa-IR')} محصول — صفحه ${(page + 1).toLocaleString('fa-IR')}`
      : 'محصولی در این دسته نیست.',
    `قیمت‌ها هم‌تراز سایت (هر سکه ≈ ${COIN_PRICE_TOMAN.toLocaleString('fa-IR')} تومان)`,
  ].join('\n');

  await ctx.answerCallbackQuery().catch(() => undefined);
  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: productsKeyboard(data.products, categorySlug, page, data.total),
    });
  } catch {
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: productsKeyboard(data.products, categorySlug, page, data.total),
    });
  }
}

export async function handleShopCategory(ctx: Context, slug: string): Promise<void> {
  await showProductList(ctx, slug, 0);
}

export async function handleShopFeatured(ctx: Context): Promise<void> {
  await showProductList(ctx, 'featured', 0);
}

export async function handleShopPage(
  ctx: Context,
  categorySlug: string,
  page: number
): Promise<void> {
  await showProductList(ctx, categorySlug as 'featured' | string, Math.max(0, page));
}

export async function handleShopView(ctx: Context, productId: string): Promise<void> {
  const data = await fetchShopProduct(productId);
  if (!data?.product) {
    await ctx.answerCallbackQuery({ text: 'محصول پیدا نشد', show_alert: true });
    return;
  }
  const p = data.product;
  const coins = p.coins ?? tomanToShopCoins(p.priceToman);
  const catLabel = data.category?.labelFa ?? p.categorySlug;
  const session = ctx.from ? await getSession(String(ctx.from.id)) : null;
  const backCat = session?.shopCategorySlug ?? p.categorySlug;

  const lines = [
    `🛍 <b>${escapeHtml(p.title)}</b>`,
    catLabel ? `دسته: ${escapeHtml(catLabel)}` : '',
    '',
    `💰 ${formatToman(p.priceToman)}`,
    `🪙 ${formatCoins(coins)}`,
    p.inStock ? '✅ موجود' : '⛔ ناموجود',
    p.description ? `\n${escapeHtml(p.description.slice(0, 280))}` : '',
    '',
    '<i>پرداخت با سکه مشترک وب و ربات</i>',
  ].filter(Boolean);

  await ctx.answerCallbackQuery().catch(() => undefined);
  const markup = productKeyboard(p, backCat);
  const photo = absoluteImageUrl(p.image);
  if (photo) {
    try {
      await ctx.replyWithPhoto(photo, {
        caption: lines.join('\n'),
        parse_mode: 'HTML',
        reply_markup: markup,
      });
      return;
    } catch {
      /* text fallback */
    }
  }
  try {
    await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: markup });
  } catch {
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: markup });
  }
}

export async function handleShopBuy(
  ctx: Context,
  productId: string,
  qtyRaw: number,
  method: ShopPayMethod | 'stars' = 'coins'
): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.telegramId) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }
  const qty = Math.max(1, Math.min(10, Math.floor(qtyRaw || 1)));
  const data = await fetchShopProduct(productId);
  const p = data?.product;
  if (!p || !p.inStock) {
    await ctx.answerCallbackQuery({ text: 'محصول موجود نیست', show_alert: true });
    return;
  }

  const payMethod = normalizeShopPayMethod(method);
  const coins = (p.coins ?? tomanToShopCoins(p.priceToman)) * qty;
  const stars = tomanToShopStars(p.priceToman) * qty;

  await patchSession(user.telegramId, {
    shopCheckout: {
      productId: p.id,
      qty,
      method: payMethod,
      name: user.name,
      phone: user.phone,
    },
    step: user.phone ? 'shop_checkout_address' : 'shop_checkout_name',
  });

  await ctx.answerCallbackQuery().catch(() => undefined);
  if (!user.phone) {
    await ctx.reply(
      [
        `🛒 خرید: <b>${escapeHtml(p.title)}</b>`,
        `تعداد: ${qty.toLocaleString('fa-IR')}`,
        `معادل: ${formatCoins(coins)} یا ${formatStars(stars)}`,
        '',
        'نام گیرنده را بفرست:',
      ].join('\n'),
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ انصراف', 'shop:home') }
    );
    return;
  }

  await ctx.reply(
    [
      `🛒 خرید: <b>${escapeHtml(p.title)}</b>`,
      `تعداد: ${qty.toLocaleString('fa-IR')}`,
      `معادل: ${formatCoins(coins)} یا ${formatStars(stars)}`,
      `گیرنده: ${escapeHtml(user.name)}`,
      `موبایل: ${escapeHtml(user.phone)}`,
      '',
      'آدرس کامل ارسال را بفرست:',
    ].join('\n'),
    { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ انصراف', 'shop:home') }
  );
}

export async function handleShopBuyStars(
  ctx: Context,
  productId: string,
  qtyRaw: number
): Promise<void> {
  await handleShopBuy(ctx, productId, qtyRaw, 'telegram_stars');
}

export async function handleShopCheckoutText(ctx: Context, text: string): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session?.shopCheckout) return false;
  if (
    session.step !== 'shop_checkout_name' &&
    session.step !== 'shop_checkout_phone' &&
    session.step !== 'shop_checkout_address'
  ) {
    return false;
  }

  const draft = { ...session.shopCheckout };
  const method = normalizeShopPayMethod(draft.method);
  const product = (await fetchShopProduct(draft.productId))?.product;
  if (!product) {
    await patchSession(telegramId, { step: 'ready', shopCheckout: undefined });
    await ctx.reply('محصول دیگر در کاتالوگ نیست. از منوی پت شاپ دوباره شروع کن.');
    return true;
  }

  if (session.step === 'shop_checkout_name') {
    draft.name = text.trim().slice(0, 80);
    if (!draft.name) {
      await ctx.reply('نام معتبر بفرست.');
      return true;
    }
    await patchSession(telegramId, { shopCheckout: draft, step: 'shop_checkout_phone' });
    await ctx.reply('شماره موبایل گیرنده را بفرست (مثلاً 0912…):');
    return true;
  }

  if (session.step === 'shop_checkout_phone') {
    const digits = text.replace(/[^\d]/g, '');
    if (digits.length < 10) {
      await ctx.reply('شماره موبایل معتبر نیست.');
      return true;
    }
    draft.phone = text.trim().slice(0, 20);
    await patchSession(telegramId, { shopCheckout: draft, step: 'shop_checkout_address' });
    await ctx.reply('آدرس کامل ارسال را بفرست:');
    return true;
  }

  // address
  draft.address = text.trim().slice(0, 400);
  if (draft.address.length < 8) {
    await ctx.reply('آدرس کامل‌تری بفرست (حداقل چند کلمه).');
    return true;
  }
  draft.method = method;
  await patchSession(telegramId, { shopCheckout: draft, step: 'ready' });

  const coins = (product.coins ?? tomanToShopCoins(product.priceToman)) * draft.qty;
  const stars = tomanToShopStars(product.priceToman) * draft.qty;
  await ctx.reply(
    [
      '📋 <b>تأیید سفارش پت شاپ</b>',
      '',
      `محصول: ${escapeHtml(product.title)}`,
      `تعداد: ${draft.qty.toLocaleString('fa-IR')}`,
      `مبلغ: ${formatToman(product.priceToman * draft.qty)}`,
      payMethodLine(method, coins, stars, product.priceToman * draft.qty),
      `گیرنده: ${escapeHtml(draft.name || '')}`,
      `موبایل: ${escapeHtml(draft.phone || '')}`,
      `آدرس: ${escapeHtml(draft.address)}`,
      '',
      'روش پرداخت را انتخاب کن، بعد «پرداخت» را بزن.',
      payMethodHint(method),
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: confirmKeyboard(draft.productId, draft.qty, method),
    }
  );
  return true;
}

export async function handleShopSetPayMethod(
  ctx: Context,
  methodRaw: string,
  productId: string,
  qtyRaw: number
): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.telegramId) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }
  const session = await getSession(user.telegramId);
  const draft = session?.shopCheckout;
  const qty = Math.max(1, Math.min(10, Math.floor(qtyRaw || 1)));
  if (!draft || draft.productId !== productId) {
    await ctx.answerCallbackQuery({ text: 'سفارش منقضی شد — دوباره بخر', show_alert: true });
    return;
  }
  const method = normalizeShopPayMethod(methodRaw);
  if (method === 'card' && (await replyIfFeatureOff(ctx, 'paymentCardEnabled'))) return;
  if (
    (method === 'telegram_stars' || method === 'wallet_stars') &&
    (await replyIfFeatureOff(ctx, 'paymentStarsEnabled'))
  ) {
    return;
  }
  const next = { ...draft, method, qty };
  await patchSession(user.telegramId, { shopCheckout: next, step: 'ready' });
  const product = (await fetchShopProduct(productId))?.product;
  if (!product) {
    await ctx.answerCallbackQuery({ text: 'محصول پیدا نشد', show_alert: true });
    return;
  }
  const coins = (product.coins ?? tomanToShopCoins(product.priceToman)) * qty;
  const stars = tomanToShopStars(product.priceToman) * qty;
  await ctx.answerCallbackQuery({ text: 'روش پرداخت انتخاب شد' }).catch(() => undefined);
  const textMsg = [
    '📋 <b>تأیید سفارش پت شاپ</b>',
    '',
    `محصول: ${escapeHtml(product.title)}`,
    `تعداد: ${qty.toLocaleString('fa-IR')}`,
    `مبلغ: ${formatToman(product.priceToman * qty)}`,
    payMethodLine(method, coins, stars, product.priceToman * qty),
    `گیرنده: ${escapeHtml(next.name || '')}`,
    `موبایل: ${escapeHtml(next.phone || '')}`,
    `آدرس: ${escapeHtml(next.address || '')}`,
    '',
    'روش پرداخت را انتخاب کن، بعد «پرداخت» را بزن.',
    payMethodHint(method),
  ].join('\n');
  try {
    await ctx.editMessageText(textMsg, {
      parse_mode: 'HTML',
      reply_markup: confirmKeyboard(productId, qty, method),
    });
  } catch {
    await ctx.reply(textMsg, {
      parse_mode: 'HTML',
      reply_markup: confirmKeyboard(productId, qty, method),
    });
  }
}

export async function handleShopPay(
  ctx: Context,
  productId: string,
  qtyRaw: number,
  methodHint?: string
): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.telegramId) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }
  const session = await getSession(user.telegramId);
  const draft = session?.shopCheckout;
  const qty = Math.max(1, Math.min(10, Math.floor(qtyRaw || 1)));
  const payMethod = normalizeShopPayMethod(methodHint || draft?.method);
  if (!draft || draft.productId !== productId) {
    await ctx.answerCallbackQuery({ text: 'سفارش منقضی شد — دوباره بخر', show_alert: true });
    return;
  }
  if (!draft.name || !draft.phone || !draft.address) {
    await ctx.answerCallbackQuery({ text: 'اطلاعات ارسال ناقص است', show_alert: true });
    return;
  }

  const product = (await fetchShopProduct(productId))?.product;
  const coinsNeeded = product
    ? (product.coins ?? tomanToShopCoins(product.priceToman)) * qty
    : 0;
  const starsNeeded = product ? tomanToShopStars(product.priceToman) * qty : 0;
  if (payMethod === 'coins') {
    const balance = user.coins ?? user.wallet?.coins ?? 0;
    if (balance < coinsNeeded) {
      await ctx.answerCallbackQuery({
        text: `سکه کافی نیست. نیاز ${coinsNeeded.toLocaleString('fa-IR')} — موجودی ${balance.toLocaleString('fa-IR')}`,
        show_alert: true,
      });
      return;
    }
  }
  if (payMethod === 'wallet_stars') {
    const balance = user.wallet?.stars ?? user.walletStars ?? 0;
    if (balance < starsNeeded) {
      await ctx.answerCallbackQuery({
        text: `ستاره پنل کافی نیست. نیاز ${starsNeeded.toLocaleString('fa-IR')} — موجودی ${balance.toLocaleString('fa-IR')}`,
        show_alert: true,
      });
      return;
    }
  }
  const tomanNeeded = product ? product.priceToman * qty : 0;
  if (payMethod === 'toman') {
    const balance = user.wallet?.toman ?? user.walletToman ?? 0;
    if (balance < tomanNeeded) {
      await ctx.answerCallbackQuery({
        text: `تومان کافی نیست. نیاز ${tomanNeeded.toLocaleString('fa-IR')} — موجودی ${balance.toLocaleString('fa-IR')}`,
        show_alert: true,
      });
      return;
    }
  }

  await ctx.answerCallbackQuery({ text: 'در حال پرداخت…' }).catch(() => undefined);
  try {
    if (payMethod === 'telegram_stars') {
      const prepared = await checkoutShopWithStarsTelegram({
        telegramId: user.telegramId,
        items: [{ productId, qty }],
        customerName: draft.name,
        customerPhone: draft.phone,
        address: draft.address,
      });
      await patchSession(user.telegramId, { shopCheckout: undefined, step: 'ready' });
      const stars = prepared.stars ?? prepared.starsNeeded;
      const title = `خرید شاپ ${stars}⭐`.slice(0, 32);
      const description = `پت شاپ همبازی — ${(prepared.titleHint || 'سفارش').slice(0, 200)}`.slice(
        0,
        255
      );
      const payload = `pay:${prepared.paymentOrderId}:shopxtr`;
      try {
        await ctx.replyWithInvoice(
          title,
          description,
          payload,
          'XTR',
          [{ label: 'خرید پت شاپ', amount: stars }],
          { provider_token: '' }
        );
        await ctx.reply(
          [
            '⭐ فاکتور Telegram Stars ارسال شد.',
            `مبلغ: ${formatStars(stars)} (≈ ${formatToman(prepared.totalToman)})`,
            '',
            'با پرداخت، ستاره‌ها مستقیم به ربات واریز و سفارش شاپ ثبت می‌شود.',
          ].join('\n'),
          { reply_markup: new InlineKeyboard().text('🛒 پت شاپ', 'shop:home') }
        );
      } catch (err) {
        console.error('sendInvoice shop stars failed:', err);
        await ctx.reply(
          'ارسال فاکتور Stars ممکن نشد. اگر پرداخت Stars برای ربات فعال نیست، با پشتیبانی هماهنگ کن.',
          { reply_markup: new InlineKeyboard().text('🛒 پت شاپ', 'shop:home') }
        );
      }
    } else if (payMethod === 'wallet_stars') {
      const result = await checkoutShopWithWalletStarsTelegram({
        telegramId: user.telegramId,
        items: [{ productId, qty }],
        customerName: draft.name,
        customerPhone: draft.phone,
        address: draft.address,
      });
      await patchSession(user.telegramId, { shopCheckout: undefined, step: 'ready' });
      const site = webShopUrl('/shop/orders');
      const kb = new InlineKeyboard().text('🛒 پت شاپ', 'shop:home');
      if (site) kb.row().url('📦 سفارش‌ها در سایت', site);
      await ctx.reply(
        [
          '✅ <b>سفارش ثبت شد</b>',
          `شماره: #${result.orderId}`,
          `کسر شده: ${formatStars(result.starsSpent)} از پنل پت‌دیت`,
          `مانده ستاره پنل: ${formatStars(result.starsRemaining)}`,
        ].join('\n'),
        { parse_mode: 'HTML', reply_markup: kb }
      );
    } else if (payMethod === 'toman') {
      const result = await checkoutShopWithTomanTelegram({
        telegramId: user.telegramId,
        items: [{ productId, qty }],
        customerName: draft.name,
        customerPhone: draft.phone,
        address: draft.address,
      });
      await patchSession(user.telegramId, { shopCheckout: undefined, step: 'ready' });
      const site = webShopUrl('/shop/orders');
      const kb = new InlineKeyboard().text('🛒 پت شاپ', 'shop:home');
      if (site) kb.row().url('📦 سفارش‌ها در سایت', site);
      await ctx.reply(
        [
          '✅ <b>سفارش ثبت شد</b>',
          `شماره: #${result.orderId}`,
          `کسر شده: ${formatToman(result.tomanSpent)} از کیف‌پول`,
          `مانده تومان: ${formatToman(result.tomanRemaining)}`,
        ].join('\n'),
        { parse_mode: 'HTML', reply_markup: kb }
      );
    } else if (payMethod === 'card') {
      const prepared = await checkoutShopWithCardTelegram({
        telegramId: user.telegramId,
        items: [{ productId, qty }],
        customerName: draft.name,
        customerPhone: draft.phone,
        address: draft.address,
      });
      const card = paymentCardInfo();
      await patchSession(user.telegramId, {
        shopCheckout: undefined,
        step: 'payment_receipt',
        paymentPendingOrderId: prepared.paymentOrderId,
      });
      await ctx.reply(
        [
          '🛒 <b>پرداخت کارت‌به‌کارت شاپ</b>',
          '',
          `شماره پیگیری: #${prepared.paymentOrderId}`,
          `مبلغ: ${formatToman(prepared.totalToman)}`,
          '',
          `کارت: <code>${escapeHtml(prepared.cardNumber || card.number)}</code>`,
          `به‌نام: ${escapeHtml(prepared.cardHolder || card.holder)}`,
          '',
          'بعد از واریز، همین‌جا <b>عکس رسید</b> را بفرست.',
          'ادمین بررسی می‌کند و سفارش فروشگاه ثبت می‌شود.',
        ].join('\n'),
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('🛒 پت شاپ', 'shop:home'),
        }
      );
    } else {
      const result = await checkoutShopWithCoinsTelegram({
        telegramId: user.telegramId,
        items: [{ productId, qty }],
        customerName: draft.name,
        customerPhone: draft.phone,
        address: draft.address,
      });
      await patchSession(user.telegramId, { shopCheckout: undefined, step: 'ready' });
      const site = webShopUrl('/shop/orders');
      const kb = new InlineKeyboard().text('🛒 پت شاپ', 'shop:home');
      if (site) kb.row().url('📦 سفارش‌ها در سایت', site);
      await ctx.reply(
        [
          '✅ <b>سفارش ثبت شد</b>',
          `شماره: #${result.orderId}`,
          `کسر شده: ${formatCoins(result.coinsSpent)}`,
          `مانده سکه: ${formatCoins(result.coinsRemaining)}`,
        ].join('\n'),
        { parse_mode: 'HTML', reply_markup: kb }
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'پرداخت ناموفق بود.';
    await ctx.reply(`❌ ${msg}`, {
      reply_markup: new InlineKeyboard().text('🛒 پت شاپ', 'shop:home'),
    });
  }
}

export async function handleShopPayStars(
  ctx: Context,
  productId: string,
  qtyRaw: number
): Promise<void> {
  await handleShopPay(ctx, productId, qtyRaw, 'telegram_stars');
}

/** ارسال دوباره فاکتور XTR برای سفارش در انتظار (deep link shoppay_<id>) */
export async function sendShopStarsInvoiceForPaymentOrder(
  ctx: Context,
  paymentOrderId: number
): Promise<boolean> {
  const user = await getCtxUser(ctx);
  if (!user?.telegramId) {
    await ctx.reply('اول /start بزن.');
    return true;
  }
  const { getPaymentOrder } = await import('../api-client');
  const order = await getPaymentOrder(paymentOrderId);
  if (!order || order.packageId !== 'shopxtr' || order.method !== 'stars') {
    await ctx.reply('فاکتور فروشگاه پیدا نشد یا منقضی است.');
    return true;
  }
  const ownerTg = order.userTelegramId != null ? String(order.userTelegramId).trim() : '';
  const payerTg = String(user.telegramId).trim();
  if (ownerTg && payerTg && ownerTg !== payerTg) {
    // همان کاربر ممکن است چند اکانت داشته باشد؛ فاکتور را برای پرداخت‌کننده فعلی می‌فرستیم.
    console.warn('shoppay deep-link telegram mismatch (sending invoice anyway)', {
      paymentOrderId,
      ownerTg,
      payerTg,
    });
  }
  if (order.status === 'paid') {
    await ctx.reply('این سفارش قبلاً پرداخت شده است.');
    return true;
  }
  if (order.status !== 'awaiting_stars') {
    await ctx.reply('وضعیت این فاکتور برای پرداخت مناسب نیست.');
    return true;
  }
  const stars = Math.floor(Number(order.amountStars ?? 0));
  if (stars <= 0) {
    await ctx.reply('مبلغ ستاره نامعتبر است.');
    return true;
  }
  let titleHint = 'سفارش پت شاپ';
  try {
    const meta = JSON.parse(String(order.adminNote || '{}')) as { titleHint?: string };
    if (meta.titleHint) titleHint = meta.titleHint;
  } catch {
    /* ignore */
  }
  const title = `خرید شاپ ${stars}⭐`.slice(0, 32);
  const description = `پت شاپ همبازی — ${titleHint}`.slice(0, 255);
  const payload = `pay:${order.id}:shopxtr`;
  try {
    await ctx.replyWithInvoice(
      title,
      description,
      payload,
      'XTR',
      [{ label: 'خرید پت شاپ', amount: stars }],
      { provider_token: '' }
    );
  } catch (err) {
    console.error('sendInvoice shoppay deep link failed:', err);
    await ctx.reply('ارسال فاکتور Stars ممکن نشد.');
  }
  return true;
}

export async function handleShopNoop(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery().catch(() => undefined);
}

const STATUS_FA: Record<string, string> = {
  pending: 'در انتظار',
  paid: 'پرداخت‌شده',
  shipped: 'ارسال‌شده',
  completed: 'تکمیل‌شده',
  cancelled: 'لغوشده',
};

function orderPayLine(o: {
  paymentCurrency?: string;
  paymentAmount?: number;
  totalToman: number;
}): string {
  const cur = o.paymentCurrency || 'toman';
  const amt = o.paymentAmount ?? o.totalToman;
  if (cur === 'stars_xtr') return `⭐ ${formatStars(Number(amt))} (تلگرام)`;
  if (cur === 'stars') return `⭐ ${formatStars(Number(amt))}`;
  if (cur === 'coins') return formatCoins(Number(amt));
  return formatToman(o.totalToman);
}

export async function handleShopOrders(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.telegramId) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true }).catch(() => undefined);
    return;
  }
  await ctx.answerCallbackQuery().catch(() => undefined);

  let orders: Awaited<ReturnType<typeof fetchMyShopOrdersTelegram>>['orders'] = [];
  try {
    const data = await fetchMyShopOrdersTelegram(user.telegramId);
    orders = data.orders;
  } catch (err) {
    console.warn('fetchMyShopOrdersTelegram failed', err);
    await ctx.reply('❌ دریافت سفارش‌ها ناموفق بود. دوباره تلاش کن.', {
      reply_markup: new InlineKeyboard().text('🏠 منوی شاپ', 'shop:home'),
    });
    return;
  }

  if (!orders.length) {
    await ctx.reply(
      ['📦 <b>سفارش‌های من</b>', '', 'هنوز سفارشی ثبت نشده.', 'از منوی شاپ خرید کن.'].join('\n'),
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text('🛒 خرید', 'shop:home')
          .row()
          .text('🏠 منوی شاپ', 'shop:home'),
      }
    );
    await pushMainMenuKeyboard(ctx, user);
    return;
  }

  const lines = [
    '📦 <b>سفارش‌های من</b>',
    `آخرین ${orders.length.toLocaleString('fa-IR')} سفارش:`,
    '',
  ];
  for (const o of orders.slice(0, 12)) {
    const items = Array.isArray(o.items) ? o.items : [];
    const titles = items
      .map((it) => {
        const t = escapeHtml(String(it.title || it.productId || 'کالا'));
        const q = Math.max(1, Number(it.qty) || 1);
        return q > 1 ? `${t}×${q}` : t;
      })
      .join('، ');
    const st = STATUS_FA[o.status] || o.status;
    lines.push(
      [
        `<b>#${o.id}</b> — ${escapeHtml(st)}`,
        titles ? `· ${titles}` : null,
        `· ${formatToman(o.totalToman)} · ${orderPayLine(o)}`,
        o.createdAt ? `· <code>${escapeHtml(o.createdAt)}</code>` : null,
      ]
        .filter(Boolean)
        .join('\n')
    );
    lines.push('');
  }

  const kb = new InlineKeyboard().text('🏠 منوی شاپ', 'shop:home').row();
  const site = webShopUrl('/shop/orders');
  if (site) kb.url('🌐 سفارش‌ها در سایت', site);

  await ctx.reply(lines.join('\n').trim(), {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
  await pushMainMenuKeyboard(ctx, user);
}
