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
  checkoutShopWithCoinsTelegram,
  checkoutShopWithStarsTelegram,
  fetchShopCategories,
  fetchShopProduct,
  fetchShopProducts,
  type ShopApiCategory,
  type ShopApiProduct,
} from '../api-client';
import { getSession, upsertSession } from '../session';
import { effectiveWebUrl, isTelegramInlineUrl } from '../urls';
import { getCtxUser, menuKeyboardFor } from './helpers';

const PAGE_SIZE = 6;
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
  const site = webShopUrl('/shop');
  if (site) kb.url('🌐 باز کردن در سایت', site).row();
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
    kb.text('🛒 خرید با سکه', `shop:buy:${product.id}:1`).row();
    kb.text('⭐ خرید با ستاره', `shop:buyStars:${product.id}:1`).row();
  }
  const site = webShopUrl(`/shop/p/${product.slug || product.id}`);
  if (site) kb.url('🌐 جزئیات در سایت', site).row();
  if (categorySlug) kb.text('↩️ لیست', `shop:c:${categorySlug}`);
  else kb.text('↩️ پیشنهادی', 'shop:featured');
  kb.text('🏠 منوی شاپ', 'shop:home');
  return kb;
}

function confirmKeyboard(productId: string, qty: number, method: 'coins' | 'stars' = 'coins'): InlineKeyboard {
  const payCb = method === 'stars' ? `shop:payStars:${productId}:${qty}` : `shop:pay:${productId}:${qty}`;
  const label = method === 'stars' ? '✅ تأیید و پرداخت با ستاره' : '✅ تأیید و پرداخت سکه';
  return new InlineKeyboard()
    .text(label, payCb)
    .row()
    .text('❌ انصراف', 'shop:home');
}

export async function handlePetShop(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  const balance = user?.coins ?? user?.wallet?.coins ?? 0;
  const starsBalance = user?.wallet?.stars ?? user?.walletStars ?? 0;
  const cats = await fetchShopCategories().catch(() => ({ total: 0, categories: [] as ShopApiCategory[] }));
  const text = [
    '🛒 <b>پت شاپ</b>',
    '',
    'همان کاتالوگ و قیمت سایت — پرداخت با سکه یا ستاره (کیف پول مشترک وب و ربات).',
    `موجودی سکه: <b>${formatCoins(balance)}</b>`,
    `موجودی ستاره: ⭐ <b>${formatStars(starsBalance)}</b>`,
    `نرخ: هر سکه/ستاره ≈ ${COIN_PRICE_TOMAN.toLocaleString('fa-IR')} تومان`,
    cats.total ? `دسته‌ها در فروشگاه: ${cats.total.toLocaleString('fa-IR')}` : '',
    '',
    'نوع پت را انتخاب کن:',
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
  await ctx.reply('منوی اصلی 👇', { reply_markup: menuKeyboardFor(ctx, user) });
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
  method: 'coins' | 'stars' = 'coins'
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

  const coins = (p.coins ?? tomanToShopCoins(p.priceToman)) * qty;
  const stars = tomanToShopStars(p.priceToman) * qty;
  if (method === 'coins') {
    const balance = user.coins ?? user.wallet?.coins ?? 0;
    if (balance < coins) {
      await ctx.answerCallbackQuery({
        text: `سکه کافی نیست. نیاز ${coins.toLocaleString('fa-IR')} — موجودی ${balance.toLocaleString('fa-IR')}`,
        show_alert: true,
      });
      return;
    }
  } else {
    const starsBalance = user.wallet?.stars ?? user.walletStars ?? 0;
    if (starsBalance < stars) {
      await ctx.answerCallbackQuery({
        text: `ستاره کافی نیست. نیاز ${stars.toLocaleString('fa-IR')} — موجودی ${starsBalance.toLocaleString('fa-IR')}`,
        show_alert: true,
      });
      return;
    }
  }

  await patchSession(user.telegramId, {
    shopCheckout: {
      productId: p.id,
      qty,
      method,
      name: user.name,
      phone: user.phone,
    },
    step: user.phone ? 'shop_checkout_address' : 'shop_checkout_name',
  });

  const costLine =
    method === 'stars'
      ? `${formatStars(stars)} (≈ ${STAR_PRICE_TOMAN.toLocaleString('fa-IR')} تومان/ستاره)`
      : formatCoins(coins);

  await ctx.answerCallbackQuery().catch(() => undefined);
  if (!user.phone) {
    await ctx.reply(
      [
        `🛒 خرید: <b>${escapeHtml(p.title)}</b>`,
        `تعداد: ${qty.toLocaleString('fa-IR')} · ${costLine}`,
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
      `تعداد: ${qty.toLocaleString('fa-IR')} · ${costLine}`,
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
  await handleShopBuy(ctx, productId, qtyRaw, 'stars');
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
  const method = draft.method === 'stars' ? 'stars' : 'coins';
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
  await patchSession(telegramId, { shopCheckout: draft, step: 'ready' });

  const coins = (product.coins ?? tomanToShopCoins(product.priceToman)) * draft.qty;
  const stars = tomanToShopStars(product.priceToman) * draft.qty;
  const payLine =
    method === 'stars'
      ? `پرداخت: ${formatStars(stars)}`
      : `پرداخت: ${formatCoins(coins)}`;
  await ctx.reply(
    [
      '📋 <b>تأیید سفارش پت شاپ</b>',
      '',
      `محصول: ${escapeHtml(product.title)}`,
      `تعداد: ${draft.qty.toLocaleString('fa-IR')}`,
      `مبلغ: ${formatToman(product.priceToman * draft.qty)}`,
      payLine,
      `گیرنده: ${escapeHtml(draft.name || '')}`,
      `موبایل: ${escapeHtml(draft.phone || '')}`,
      `آدرس: ${escapeHtml(draft.address)}`,
      '',
      method === 'stars'
        ? 'با تأیید، ستاره از کیف پول مشترک وب و ربات کسر می‌شود.'
        : 'با تأیید، سکه از کیف پول مشترک کسر می‌شود.',
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: confirmKeyboard(draft.productId, draft.qty, method),
    }
  );
  return true;
}

export async function handleShopPay(
  ctx: Context,
  productId: string,
  qtyRaw: number,
  method: 'coins' | 'stars' = 'coins'
): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.telegramId) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }
  const session = await getSession(user.telegramId);
  const draft = session?.shopCheckout;
  const qty = Math.max(1, Math.min(10, Math.floor(qtyRaw || 1)));
  const payMethod = method === 'stars' || draft?.method === 'stars' ? 'stars' : 'coins';
  if (!draft || draft.productId !== productId) {
    await ctx.answerCallbackQuery({ text: 'سفارش منقضی شد — دوباره بخر', show_alert: true });
    return;
  }
  if (!draft.name || !draft.phone || !draft.address) {
    await ctx.answerCallbackQuery({ text: 'اطلاعات ارسال ناقص است', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: 'در حال پرداخت…' }).catch(() => undefined);
  try {
    if (payMethod === 'stars') {
      const result = await checkoutShopWithStarsTelegram({
        telegramId: user.telegramId,
        items: [{ productId, qty }],
        customerName: draft.name,
        customerPhone: draft.phone,
        address: draft.address,
      });
      await patchSession(user.telegramId, { shopCheckout: undefined, step: 'ready' });
      const site = webShopUrl('/shop');
      await ctx.reply(
        [
          '✅ <b>سفارش با ستاره ثبت شد</b>',
          `شماره: #${result.orderId}`,
          `کسر شده: ${formatStars(result.starsSpent)}`,
          `مانده ستاره: ${formatStars(result.starsRemaining)}`,
          `مبلغ معادل: ${formatToman(result.totalToman)}`,
          '',
          'سفارش در پنل ادمین و سایت هم دیده می‌شود.',
          site ? `سایت: ${site}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🛒 ادامه خرید', 'shop:home') }
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
      const site = webShopUrl('/shop');
      await ctx.reply(
        [
          '✅ <b>سفارش ثبت شد</b>',
          `شماره: #${result.orderId}`,
          `کسر شده: ${formatCoins(result.coinsSpent)}`,
          `مانده سکه: ${formatCoins(result.coinsRemaining)}`,
          `مبلغ معادل: ${formatToman(result.totalToman)}`,
          '',
          'سفارش در پنل ادمین و سایت هم دیده می‌شود.',
          site ? `سایت: ${site}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🛒 ادامه خرید', 'shop:home') }
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'پرداخت ناموفق بود';
    await ctx.reply(`❌ ${msg}`);
  }
}

export async function handleShopPayStars(
  ctx: Context,
  productId: string,
  qtyRaw: number
): Promise<void> {
  await handleShopPay(ctx, productId, qtyRaw, 'stars');
}

export async function handleShopNoop(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery().catch(() => undefined);
}
