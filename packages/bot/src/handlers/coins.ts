import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { WALLET_CURRENCY_LABELS_FA, WALLET_CURRENCY_SYMBOLS } from '@petdate/shared';
import {
  approveCardPayment,
  attachPaymentReceipt,
  claimDailyCoins,
  fetchWalletTransactions,
  completeStarsPayment,
  createPaymentOrder,
  getPaymentOrder,
  hasOpenCoinSell,
  rejectCardPayment,
  submitCoinSell,
  type PaymentOrder,
} from '../api-client';
import { config } from '../config';
import { effectiveWebUrl } from '../urls';
import { isAdminAuthorized } from './admin-auth';
import {
  COIN_PACKAGES,
  COIN_SELL_PRICE_TOMAN,
  DAILY_COIN_REWARD,
  MIN_SELL_COINS,
  canClaimDaily,
  cardPaymentInstructionsText,
  coinsShopIntroText,
  earnIntroText,
  formatNum,
  formatToman,
  packageCheckoutText,
  paymentCardInfo,
  sellAmountToman,
  validateIranCard,
  type CoinPackage,
} from '../economy';
import {
  adminPaymentKeyboard,
  coinPackagePayKeyboard,
  coinsShopKeyboard,
  earnCancelKeyboard,
  earnConfirmKeyboard,
  earnKeyboard,
  MENU_LABELS,
  paymentReceiptCancelKeyboard,
  paymentReceiptReplyKeyboard,
} from '../keyboards';
import { getSession, upsertSession } from '../session';
import { telegramWebLoginUrl } from '../telegram-web-link';
import { getCtxUser, menuKeyboardFor, pushMainMenuKeyboard } from './helpers';

export const SEND_RECEIPT_BTN = '📤 ارسال فیش';
export const CANCEL_PAYMENT_BTN = '↩️ انصراف از پرداخت';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function userStarsBalance(user: { wallet?: { stars?: number }; walletStars?: number } | null | undefined): number {
  return user?.wallet?.stars ?? user?.walletStars ?? 0;
}

export async function handleCoins(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  const balance = user?.coins ?? 0;
  const starsBalance = userStarsBalance(user);
  await ctx.reply(coinsShopIntroText(balance, starsBalance), {
    parse_mode: 'HTML',
    reply_markup: coinsShopKeyboard(user?.lastDailyCoinAt),
  });
  await pushMainMenuKeyboard(ctx, user);
}

export async function handleCoinsDaily(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.telegramId) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }

  if (!canClaimDaily(user.lastDailyCoinAt)) {
    await ctx.answerCallbackQuery({ text: 'امروز گرفتی — فردا بیا', show_alert: true });
    return;
  }

  const result = await claimDailyCoins(user.telegramId, DAILY_COIN_REWARD);
  if (!result.ok) {
    await ctx.answerCallbackQuery({
      text: result.reason === 'already' ? 'امروز گرفتی — فردا بیا' : 'خطا در دریافت سکه',
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery({
    text: `+${formatNum(result.awarded)} سکه 🎁`,
  });
  const text = coinsShopIntroText(
    result.user.coins ?? 0,
    userStarsBalance(result.user)
  );
  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: coinsShopKeyboard(result.user.lastDailyCoinAt),
    });
  } catch {
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: coinsShopKeyboard(result.user.lastDailyCoinAt),
    });
  }
}

export async function handleCoinsDailyDone(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery({ text: 'امروز گرفتی — فردا برگرد 🎁', show_alert: true });
}


export async function handleCoinsTransactions(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.telegramId) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  const telegramId = user.telegramId;
  const walletUrl = telegramWebLoginUrl(telegramId, '/wallet');
  const webKb = walletUrl
    ? new InlineKeyboard().url('🌐 کیف پول وب', walletUrl)
    : undefined;
  try {
    const txs = await fetchWalletTransactions(telegramId, 8);
    if (!txs.length) {
      await ctx.reply(
        [
          '📜 <b>تراکنش‌ها</b>',
          '',
          'هنوز تراکنشی ثبت نشده.',
          'از این به بعد کسر و واریزها اینجا و در صفحه کیف پول وب دیده می‌شوند.',
        ].join('\n'),
        { parse_mode: 'HTML', ...(webKb ? { reply_markup: webKb } : {}) }
      );
      return;
    }
    const lines = txs.map((tx) => {
      const sign = tx.direction === 'debit' ? '−' : '+';
      const amount = formatNum(Math.abs(tx.amount));
      const cur =
        tx.currency === 'toman'
          ? 'تومان'
          : WALLET_CURRENCY_SYMBOLS[tx.currency] || WALLET_CURRENCY_LABELS_FA[tx.currency];
      const when = String(tx.createdAt || '').slice(0, 16).replace('T', ' ');
      return `• <b>${escapeHtml(tx.labelFa || tx.reason)}</b>\n  ${sign}${amount} ${cur} — ${when}`;
    });
    const allKb = walletUrl
      ? new InlineKeyboard().url('🌐 همه در کیف پول وب', walletUrl)
      : undefined;
    await ctx.reply(['📜 <b>آخرین تراکنش‌ها</b>', '', ...lines].join('\n'), {
      parse_mode: 'HTML',
      ...(allKb ? { reply_markup: allKb } : {}),
    });
  } catch {
    await ctx.reply('نتوانستیم تراکنش‌ها را بخوانیم. کمی بعد دوباره امتحان کن.');
  }
}


export async function handleCoinsPackage(ctx: Context, pkgId: string): Promise<void> {
  const pkg = COIN_PACKAGES.find((p) => p.id === pkgId);
  if (!pkg) {
    await ctx.answerCallbackQuery({ text: 'بسته پیدا نشد', show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  const text = packageCheckoutText(pkg);
  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: coinPackagePayKeyboard(pkg.id),
    });
  } catch {
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: coinPackagePayKeyboard(pkg.id),
    });
  }
}

export async function handleCoinsPay(
  ctx: Context,
  method: 'stars' | 'card',
  pkgId: string
): Promise<void> {
  const pkg = COIN_PACKAGES.find((p) => p.id === pkgId);
  if (!pkg) {
    await ctx.answerCallbackQuery({ text: 'بسته پیدا نشد', show_alert: true });
    return;
  }
  if (method === 'card') {
    await startCardPayment(ctx, pkg);
    return;
  }
  await startStarsPayment(ctx, pkg);
}

async function startCardPayment(ctx: Context, pkg: CoinPackage): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.telegramId || !ctx.from) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }

  const created = await createPaymentOrder(user.telegramId, {
    packageId: pkg.id,
    coins: pkg.coins,
    amountToman: pkg.toman,
    amountStars: pkg.stars,
    method: 'card',
  });
  if (!created.ok) {
    await ctx.answerCallbackQuery({ text: 'ثبت سفارش ناموفق', show_alert: true });
    return;
  }

  await upsertSession(String(ctx.from.id), {
    step: 'payment_receipt',
    paymentPendingOrderId: created.order.id,
  });
  await ctx.answerCallbackQuery();

  const text = cardPaymentInstructionsText(pkg);
  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: paymentReceiptCancelKeyboard(),
    });
  } catch {
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: paymentReceiptCancelKeyboard(),
    });
  }
  await ctx.reply('برای ثبت فیش، دکمه زیر را بزن یا مستقیم عکس رسید را بفرست 👇', {
    reply_markup: paymentReceiptReplyKeyboard(),
  });
}

/** راهنمای ارسال فیش — کاربر هنوز باید عکس بفرستد */
export async function handleCoinsSendReceiptPrompt(ctx: Context): Promise<void> {
  const session = ctx.from ? await getSession(String(ctx.from.id)) : null;
  if (!session || session.step !== 'payment_receipt' || !session.paymentPendingOrderId) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: 'سفارش فعالی نیست — از فروشگاه سکه دوباره شروع کن',
        show_alert: true,
      });
    } else {
      await ctx.reply('سفارش فعالی نیست. از منو «🪙 سکه» را بزن و بسته را انتخاب کن.');
    }
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: 'عکس فیش را بفرست' });
  }

  await ctx.reply(
    [
      '📤 <b>ارسال فیش</b>',
      '',
      'الان <b>عکس رسید کارت‌به‌کارت</b> را همین‌جا بفرست.',
      'بعد از بررسی ادمین، سکه‌ها به حسابت اضافه می‌شود.',
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: paymentReceiptReplyKeyboard(),
    }
  );
}

async function startStarsPayment(ctx: Context, pkg: CoinPackage): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.telegramId || !ctx.from) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }

  const created = await createPaymentOrder(user.telegramId, {
    packageId: pkg.id,
    coins: pkg.coins,
    amountToman: pkg.toman,
    amountStars: pkg.stars,
    method: 'stars',
  });
  if (!created.ok) {
    await ctx.answerCallbackQuery({ text: 'ثبت سفارش ناموفق', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();
  const title = `خرید ${pkg.coins} سکه`.slice(0, 32);
  const description = `بسته سکه همبازی (@Petdatebot) — ${pkg.coins} سکه`.slice(0, 255);
  const payload = `pay:${created.order.id}:${pkg.id}`;

  try {
    await ctx.replyWithInvoice(
      title,
      description,
      payload,
      'XTR',
      [{ label: `${pkg.coins} سکه`, amount: pkg.stars }],
      { provider_token: '' }
    );
  } catch (err) {
    console.error('sendInvoice Stars failed:', err);
    await ctx.reply(
      'ارسال فاکتور ستاره ممکن نشد. اگر ربات برای پرداخت Stars فعال نیست، از کارت‌به‌کارت استفاده کن.',
      { reply_markup: coinPackagePayKeyboard(pkg.id) }
    );
  }
}

export async function handleCoinsPayCancel(ctx: Context): Promise<void> {
  if (ctx.from) {
    await upsertSession(String(ctx.from.id), {
      step: 'ready',
      paymentPendingOrderId: undefined,
    });
  }
  await ctx.answerCallbackQuery({ text: 'لغو شد' });
  const user = await getCtxUser(ctx);
  const text = coinsShopIntroText(user?.coins ?? 0, userStarsBalance(user));
  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: coinsShopKeyboard(user?.lastDailyCoinAt),
    });
  } catch {
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: coinsShopKeyboard(user?.lastDailyCoinAt),
    });
  }
}

export async function handleCoinsBack(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  await ctx.answerCallbackQuery();
  const text = coinsShopIntroText(user?.coins ?? 0, userStarsBalance(user));
  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: coinsShopKeyboard(user?.lastDailyCoinAt),
    });
  } catch {
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: coinsShopKeyboard(user?.lastDailyCoinAt),
    });
  }
}

/** عکس یا فایل رسید کارت‌به‌کارت */
export async function handlePaymentReceiptPhoto(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;

  const session = await getSession(String(from.id));
  if (!session || session.step !== 'payment_receipt' || !session.paymentPendingOrderId) {
    return false;
  }

  const photos = ctx.message?.photo;
  const doc = ctx.message?.document;
  let fileId: string | undefined;
  if (photos?.length) {
    fileId = photos[photos.length - 1]!.file_id;
  } else if (doc?.file_id) {
    const mime = doc.mime_type || '';
    if (mime.startsWith('image/') || !mime) {
      fileId = doc.file_id;
    }
  }
  if (!fileId) {
    await ctx.reply('لطفاً عکس فیش را به‌صورت تصویر بفرست (یا دکمه 📤 ارسال فیش را بزن).', {
      reply_markup: paymentReceiptReplyKeyboard(),
    });
    return true;
  }

  const orderId = session.paymentPendingOrderId;
  const result = await attachPaymentReceipt(orderId, fileId);
  await upsertSession(String(from.id), {
    step: 'ready',
    paymentPendingOrderId: undefined,
  });

  const user = await getCtxUser(ctx);
  if (!result.ok) {
    await ctx.reply(
      result.reason === 'bad_status'
        ? 'این سفارش دیگر در انتظار رسید نیست.'
        : 'ثبت رسید ناموفق بود. دوباره از فروشگاه سکه شروع کن.',
      { reply_markup: menuKeyboardFor(ctx, user) }
    );
    return true;
  }

  await ctx.reply(
    [
      '✅ رسید ثبت شد.',
      `شماره سفارش: #${result.order.id}`,
      '',
      'بعد از بررسی ادمین، سکه‌ها به موجودی‌ات اضافه می‌شود.',
    ].join('\n'),
    { reply_markup: menuKeyboardFor(ctx, user) }
  );

  await notifyAdminsPendingPayment(ctx, result.order);
  return true;
}

async function notifyAdminsPendingPayment(ctx: Context, order: PaymentOrder): Promise<void> {
  const admins = config.telegramAdminIds;
  if (!admins.length) {
    console.warn('No TELEGRAM_ADMIN_IDS — pending payment #%s not notified', order.id);
    return;
  }

  const card = paymentCardInfo();
  const caption = [
    '💳 <b>رسید کارت‌به‌کارت — بررسی</b>',
    '',
    `<b>سفارش:</b> #${order.id}`,
    `<b>کاربر:</b> ${escapeHtml(order.userName || '—')}`,
    order.userUsername ? `<b>یوزرنیم:</b> @${escapeHtml(order.userUsername)}` : null,
    order.userTelegramId
      ? `<b>تلگرام:</b> <code>${escapeHtml(order.userTelegramId)}</code>`
      : null,
    `<b>بسته:</b> ${escapeHtml(order.packageId)} · ${formatNum(order.coins)} سکه`,
    `<b>مبلغ:</b> ${formatToman(order.amountToman ?? 0)}`,
    `<b>کارت مقصد:</b> <code>${card.number}</code>`,
    `<b>به‌نام:</b> ${escapeHtml(card.holder)}`,
  ]
    .filter((l) => l !== null)
    .join('\n');

  const kb = adminPaymentKeyboard(order.id);
  for (const adminId of admins) {
    try {
      if (order.receiptFileId) {
        await ctx.api.sendPhoto(adminId, order.receiptFileId, {
          caption,
          parse_mode: 'HTML',
          reply_markup: kb,
        });
      } else {
        await ctx.api.sendMessage(adminId, caption, {
          parse_mode: 'HTML',
          reply_markup: kb,
        });
      }
    } catch (err) {
      console.warn('notify admin payment failed:', adminId, err);
    }
  }
}

export async function handlePaymentApprove(ctx: Context, orderId: number): Promise<void> {
  if (!(await isAdminAuthorized(ctx))) {
    await ctx.answerCallbackQuery({ text: 'فقط ادمین', show_alert: true });
    return;
  }

  const result = await approveCardPayment(orderId);
  if (!result.ok) {
    await ctx.answerCallbackQuery({
      text: result.reason === 'bad_status' ? 'قبلاً بررسی شده' : 'سفارش پیدا نشد',
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery({ text: 'تأیید شد ✅' });
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch {
    /* ignore */
  }
  await ctx.reply(
    `✅ سفارش #${orderId} تأیید شد.\n${formatNum(result.order.coins)} سکه به ${escapeHtml(result.user.name)} واریز شد.`,
    { parse_mode: 'HTML' }
  );

  if (result.user.telegramId) {
    try {
      await ctx.api.sendMessage(
        result.user.telegramId,
        [
          '✅ پرداخت کارت‌به‌کارت تأیید شد.',
          `${formatNum(result.order.coins)} سکه به موجودی‌ات اضافه شد.`,
          `موجودی فعلی: ${formatNum(result.user.coins ?? 0)} سکه`,
        ].join('\n')
      );
    } catch (err) {
      console.warn('notify user payment approved failed:', err);
    }
  }
}

export async function handlePaymentReject(ctx: Context, orderId: number): Promise<void> {
  if (!(await isAdminAuthorized(ctx))) {
    await ctx.answerCallbackQuery({ text: 'فقط ادمین', show_alert: true });
    return;
  }

  const result = await rejectCardPayment(orderId);
  if (!result.ok) {
    await ctx.answerCallbackQuery({
      text: result.reason === 'bad_status' ? 'قبلاً بررسی شده' : 'سفارش پیدا نشد',
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery({ text: 'رد شد' });
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch {
    /* ignore */
  }
  await ctx.reply(`❌ سفارش #${orderId} رد شد.`);

  const tgId = result.user?.telegramId ?? result.order.userTelegramId;
  if (tgId) {
    try {
      await ctx.api.sendMessage(
        tgId,
        [
          '❌ رسید کارت‌به‌کارت رد شد.',
          'اگر واریز کردی، با پشتیبانی هماهنگ کن یا دوباره از فروشگاه سکه اقدام کن.',
        ].join('\n')
      );
    } catch (err) {
      console.warn('notify user payment rejected failed:', err);
    }
  }
}

/** pre_checkout_query برای فاکتور Stars */
export async function handlePreCheckout(ctx: Context): Promise<void> {
  const q = ctx.preCheckoutQuery;
  if (!q) return;
  const payload = q.invoice_payload || '';
  const match = /^pay:(\d+):(.+)$/.exec(payload);
  if (!match) {
    await ctx.answerPreCheckoutQuery(false, {
      error_message: 'فاکتور نامعتبر است',
    });
    return;
  }
  const orderId = Number(match[1]);
  const pkgId = match[2]!;
  const order = await getPaymentOrder(orderId);
  if (
    !order ||
    order.method !== 'stars' ||
    order.status !== 'awaiting_stars' ||
    order.packageId !== pkgId ||
    q.currency !== 'XTR'
  ) {
    await ctx.answerPreCheckoutQuery(false, {
      error_message: 'این فاکتور منقضی یا نامعتبر است',
    });
    return;
  }

  // فاکتور XTR داخل همان چت تلگرام پرداخت می‌شود؛ مقایسهٔ سخت مالکیت
  // (number vs string / چند اکانت) خرید شاپ را بی‌دلیل بلاک می‌کرد.
  const payerTg = String(q.from?.id ?? ctx.from?.id ?? '').trim();
  const ownerTg = order.userTelegramId != null ? String(order.userTelegramId).trim() : '';
  if (ownerTg && payerTg && ownerTg !== payerTg && pkgId !== 'shopxtr') {
    console.warn('pre_checkout telegram mismatch', {
      orderId,
      pkgId,
      ownerTg,
      payerTg,
    });
    await ctx.answerPreCheckoutQuery(false, {
      error_message: 'این فاکتور برای حساب دیگری است',
    });
    return;
  }
  if (ownerTg && payerTg && ownerTg !== payerTg && pkgId === 'shopxtr') {
    console.warn('pre_checkout shopxtr telegram mismatch (allowed)', {
      orderId,
      ownerTg,
      payerTg,
    });
  }

  if (pkgId === 'shopxtr' || pkgId.startsWith('wstars:')) {
    const stars = Math.floor(Number(order.amountStars ?? 0));
    if (stars <= 0 || q.total_amount !== stars) {
      await ctx.answerPreCheckoutQuery(false, {
        error_message: 'مبلغ ستاره نامعتبر است',
      });
      return;
    }
    await ctx.answerPreCheckoutQuery(true);
    return;
  }

  const pkg = COIN_PACKAGES.find((p) => p.id === pkgId);
  if (!pkg || q.total_amount !== pkg.stars) {
    await ctx.answerPreCheckoutQuery(false, {
      error_message: 'این فاکتور منقضی یا نامعتبر است',
    });
    return;
  }
  await ctx.answerPreCheckoutQuery(true);
}

/** successful_payment — واریز سکه / شارژ wallet_stars / ثبت سفارش شاپ بعد از Stars (XTR → ربات) */
export async function handleSuccessfulPayment(ctx: Context): Promise<void> {
  const payment = ctx.message?.successful_payment;
  if (!payment) return;

  const match = /^pay:(\d+):(.+)$/.exec(payment.invoice_payload || '');
  if (!match) {
    await ctx.reply('پرداخت دریافت شد ولی سفارش پیدا نشد. با پشتیبانی هماهنگ کن.');
    return;
  }
  const orderId = Number(match[1]);
  const pkgId = match[2]!;
  const result = await completeStarsPayment(orderId, payment.telegram_payment_charge_id);
  if (!result.ok) {
    await ctx.reply('پرداخت ثبت شد ولی واریز موجودی با خطا روبه‌رو شد. با پشتیبانی هماهنگ کن.');
    console.error('completeStarsPayment failed:', result.reason, orderId);
    return;
  }

  const user = result.user;
  if (pkgId === 'shopxtr' || result.creditKind === 'shop_order') {
    const stars = Math.floor(
      Number(result.starsSpent ?? result.order.amountStars ?? payment.total_amount ?? 0)
    );
    const shopId = result.shopOrderId;
    const site = (() => {
      const base = effectiveWebUrl().replace(/\/$/, '');
      return base ? `${base}/shop` : '';
    })();
    await ctx.reply(
      [
        '✅ <b>خرید پت شاپ با Stars تلگرام موفق بود</b>',
        `ستاره‌ها از اکانت تلگرامت کسر و مستقیم به ربات واریز شد.`,
        shopId != null ? `شماره سفارش شاپ: #${shopId}` : null,
        `پرداخت: ⭐ ${formatNum(stars)}`,
        result.totalToman != null
          ? `معادل: ${Math.floor(result.totalToman).toLocaleString('fa-IR')} تومان`
          : null,
        site ? `سایت: ${site}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      {
        parse_mode: 'HTML',
        reply_markup: menuKeyboardFor(ctx, user),
      }
    );
    return;
  }

  if (pkgId.startsWith('wstars:') || result.creditKind === 'wallet_stars') {
    const stars = Math.floor(Number(result.order.amountStars ?? payment.total_amount ?? 0));
    await ctx.reply(
      [
        '⭐ پرداخت Stars تلگرام موفق بود!',
        `ستاره‌ها مستقیم به ربات واریز شد و <b>${formatNum(stars)}</b> ستاره به کیف‌پول پت‌دیتت اضافه شد.`,
        `موجودی ستاره کیف‌پول: <b>⭐ ${formatNum(user.wallet?.stars ?? user.walletStars ?? 0)}</b>`,
      ].join('\n'),
      {
        parse_mode: 'HTML',
        reply_markup: menuKeyboardFor(ctx, user),
      }
    );
    return;
  }

  await ctx.reply(
    [
      '⭐ پرداخت با ستاره موفق بود!',
      `ستاره‌ها به ربات واریز شد و <b>${formatNum(result.order.coins)}</b> سکه به موجودی‌ات اضافه شد.`,
      `موجودی فعلی: <b>${formatNum(user.coins ?? 0)}</b> سکه`,
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: menuKeyboardFor(ctx, user),
    }
  );
}

/** بسته‌های شارژ wallet_stars با پرداخت واقعی Telegram Stars (XTR) */
export const WALLET_STARS_TOPUP_PACKS = [10, 25, 50, 100, 250] as const;

export async function handleWalletStarsTopUpMenu(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.telegramId) {
    await ctx.reply('اول /start بزن.');
    return;
  }
  const stars = userStarsBalance(user);
  const kb = new InlineKeyboard();
  for (const amount of WALLET_STARS_TOPUP_PACKS) {
    kb.text(`⭐ ${formatNum(amount)} ستاره`, `wstars:buy:${amount}`).row();
  }
  await ctx.reply(
    [
      '⭐ <b>شارژ ستاره کیف‌پول با Stars تلگرام</b>',
      '',
      'تلگرام موجودی Stars حساب شخصی‌ات را به ربات نشان نمی‌دهد.',
      'با فاکتور زیر، Stars واقعی‌ات مستقیم به ربات واریز می‌شود و همان مقدار در کیف‌پول پت‌دیت شارژ می‌گردد.',
      '',
      `موجودی فعلی کیف‌پول: ⭐ <b>${formatNum(stars)}</b>`,
      '',
      'بسته را انتخاب کن:',
    ].join('\n'),
    { parse_mode: 'HTML', reply_markup: kb }
  );
  await pushMainMenuKeyboard(ctx, user);
}

export async function handleWalletStarsTopUpBuy(ctx: Context, amountRaw: string): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.telegramId || !ctx.from) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }
  const amount = Math.floor(Number(amountRaw));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) {
    await ctx.answerCallbackQuery({ text: 'مبلغ نامعتبر', show_alert: true });
    return;
  }

  const packageId = `wstars:${amount}`;
  const created = await createPaymentOrder(user.telegramId, {
    packageId,
    coins: 0,
    amountStars: amount,
    method: 'stars',
  });
  if (!created.ok) {
    await ctx.answerCallbackQuery({ text: 'ثبت سفارش ناموفق', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();
  const title = `شارژ ${amount} ستاره`.slice(0, 32);
  const description = `شارژ کیف‌پول پت‌دیت — ${amount} Telegram Stars مستقیم به ربات`.slice(0, 255);
  const payload = `pay:${created.order.id}:${packageId}`;

  try {
    await ctx.replyWithInvoice(
      title,
      description,
      payload,
      'XTR',
      [{ label: `${amount} ستاره کیف‌پول`, amount }],
      { provider_token: '' }
    );
  } catch (err) {
    console.error('sendInvoice wallet stars top-up failed:', err);
    await ctx.reply(
      'ارسال فاکتور Stars ممکن نشد. اگر پرداخت Stars برای ربات فعال نیست، با پشتیبانی هماهنگ کن.',
      { reply_markup: menuKeyboardFor(ctx, user) }
    );
  }
}

export async function handleEarn(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.telegramId) {
    await ctx.reply('اول /start بزن.');
    return;
  }
  const balance = user.coins ?? 0;
  const pending = await hasOpenCoinSell(user.telegramId);
  const canSell = balance >= MIN_SELL_COINS && !pending;
  const extra = pending
    ? '\n\n⏳ یک درخواست تسویه باز داری — تا بررسی ادمین صبر کن.'
    : '';
  await ctx.reply(earnIntroText(balance) + extra, {
    parse_mode: 'HTML',
    reply_markup: earnKeyboard(canSell),
  });
  await pushMainMenuKeyboard(ctx, user);
}

export async function handleEarnSell(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.telegramId) {
    await ctx.answerCallbackQuery();
    return;
  }
  const balance = user.coins ?? 0;
  if (await hasOpenCoinSell(user.telegramId)) {
    await ctx.answerCallbackQuery({ text: 'یک درخواست تسویه باز داری', show_alert: true });
    return;
  }
  if (balance < MIN_SELL_COINS) {
    await ctx.answerCallbackQuery({
      text: `حداقل ${formatNum(MIN_SELL_COINS)} سکه لازم است`,
      show_alert: true,
    });
    return;
  }

  const coins = balance;
  const toman = sellAmountToman(coins, COIN_SELL_PRICE_TOMAN);
  await ctx.answerCallbackQuery();
  const text = [
    '💵 <b>تأیید فروش</b>',
    '',
    `تعداد سکه: <b>${formatNum(coins)}</b>`,
    `نرخ: هر سکه ${formatNum(COIN_SELL_PRICE_TOMAN)} تومان`,
    `مبلغ پرداختی: <b>${formatToman(toman)}</b>`,
    '',
    'با ارسال شماره کارت، سکه‌ها تا تأیید/رد ادمین نگه داشته می‌شوند.',
  ].join('\n');

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: earnConfirmKeyboard(coins),
    });
  } catch {
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: earnConfirmKeyboard(coins),
    });
  }
}

export async function handleEarnConfirm(ctx: Context, coins: number): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.telegramId || !ctx.from) {
    await ctx.answerCallbackQuery();
    return;
  }
  if (!Number.isFinite(coins) || coins < MIN_SELL_COINS) {
    await ctx.answerCallbackQuery({ text: 'مقدار نامعتبر', show_alert: true });
    return;
  }
  if ((user.coins ?? 0) < coins) {
    await ctx.answerCallbackQuery({ text: 'سکه کافی نیست', show_alert: true });
    return;
  }
  if (await hasOpenCoinSell(user.telegramId)) {
    await ctx.answerCallbackQuery({ text: 'یک درخواست تسویه باز داری', show_alert: true });
    return;
  }

  await upsertSession(String(ctx.from.id), {
    step: 'earn_card',
    earnPendingCoins: coins,
  });
  await ctx.answerCallbackQuery();
  const prompt = [
    '🏦 شماره کارت بانکی ۱۶ رقمی را برای واریز بفرست.',
    `مبلغ در انتظار: ${formatNum(coins)} سکه ≈ ${formatToman(sellAmountToman(coins))}`,
    '',
    'فقط رقم (فاصله/خط تیره مجاز است). کارت بانکی ایران.',
  ].join('\n');

  try {
    await ctx.editMessageText(prompt, { reply_markup: earnCancelKeyboard() });
  } catch {
    await ctx.reply(prompt, { reply_markup: earnCancelKeyboard() });
  }
}

export async function handleEarnCancel(ctx: Context): Promise<void> {
  if (ctx.from) {
    await upsertSession(String(ctx.from.id), {
      step: 'ready',
      earnPendingCoins: undefined,
    });
  }
  await ctx.answerCallbackQuery({ text: 'لغو شد' });
  try {
    await ctx.editMessageText('فروش لغو شد.');
  } catch {
    /* ignore */
  }
}

export async function handleEarnClose(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch {
    /* ignore */
  }
}

/** شماره کارت هنگام step=earn_card */
export async function handleEarnCardText(ctx: Context, text: string): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;

  const session = await getSession(String(from.id));
  if (!session || session.step !== 'earn_card' || !session.earnPendingCoins) {
    return false;
  }

  if (MENU_LABELS.has(text) || text.startsWith('/')) {
    await upsertSession(String(from.id), {
      step: 'ready',
      earnPendingCoins: undefined,
    });
    return false;
  }

  const user = await getCtxUser(ctx);
  if (!user?.telegramId) return true;

  const cardCheck = validateIranCard(text);
  if (!cardCheck.ok) {
    await ctx.reply(
      cardCheck.reason === 'luhn'
        ? 'شماره کارت معتبر نیست (چک رقم). ۱۶ رقم را دوباره بفرست.'
        : 'شماره کارت ۱۶ رقمی بانکی ایران را درست بفرست.',
      { reply_markup: earnCancelKeyboard() }
    );
    return true;
  }

  const coins = session.earnPendingCoins;
  const result = await submitCoinSell(user.telegramId, {
    coins,
    cardNumber: cardCheck.card,
    rateToman: COIN_SELL_PRICE_TOMAN,
    minCoins: MIN_SELL_COINS,
  });

  await upsertSession(String(from.id), {
    step: 'ready',
    earnPendingCoins: undefined,
  });

  if (!result.ok) {
    const msg =
      result.reason === 'min'
        ? `حداقل ${formatNum(MIN_SELL_COINS)} سکه لازم است.`
        : result.reason === 'balance'
          ? 'سکه کافی نیست.'
          : result.reason === 'pending'
            ? 'یک درخواست تسویه باز داری.'
            : 'ثبت درخواست ممکن نشد.';
    await ctx.reply(msg, { reply_markup: menuKeyboardFor(ctx, user) });
    return true;
  }

  await ctx.reply(
    [
      '✅ درخواست فروش ثبت شد.',
      `شماره درخواست: #${result.requestId}`,
      `${formatNum(coins)} سکه رزرو شد · ${formatToman(result.amountToman)}`,
      '',
      'ممنون! پرداخت پس از بررسی ادمین انجام می‌شود.',
    ].join('\n'),
    { reply_markup: menuKeyboardFor(ctx, result.user) }
  );
  return true;
}
