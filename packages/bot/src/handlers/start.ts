import type { Context } from 'grammy';
import type { User, UserRole } from '@petdate/shared';
import {
  BRAND,
  ROLE_CONFIRM_LABEL,
  USER_ROLE_LABELS,
  normalizeRoles,
  parseUserIdFromCommand,
  primaryRole,
} from '@petdate/shared';
import {
  registerTelegramUser,
  setUserOnboarding,
  setUserPrimaryRole,
  setUserRoles,
  completeWebTelegramLink,
  completeTelegramPendingLogin,
} from '../api-client';
import { formatCoinAwardMessage } from '../economy';
import { sendWelcomeLogo } from '../branding';
import { roleWelcomeHint } from '../format';
import {
  mainMenuKeyboard,
  myRolesSwitchKeyboard,
  roleKeyboard,
  roleReplyKeyboard,
  webAutoLoginKeyboard,
  webLinksKeyboard,
  webPendingLoginConfirmKeyboard,
} from '../keyboards';
import { getSession, upsertSession } from '../session';
import { parseWebLoginStartPayload, parseWebPendingLoginPayload } from '../telegram-web-link';
import { webLinkHint } from '../urls';
import { displayName, getCtxUser, menuKeyboardFor } from './helpers';
import { resumeOwnerChatOnStart } from './owner-chat';
import { showPublicUserById, startProfileWizard } from './profile';

export {
  displayName,
  getCtxUser,
  menuKeyboardFor,
  pushMainMenuKeyboard,
  pushReplyKeyboard,
} from './helpers';

function roleLabels(user: User): string {
  const roles = normalizeRoles(user.roles, user.role);
  if (!roles.length) return '—';
  return roles.map((r) => USER_ROLE_LABELS[r]).join(' · ');
}

function startPayload(ctx: Context): string {
  const text = ctx.message?.text?.trim() ?? '';
  const parts = text.split(/\s+/);
  if (parts.length < 2) return '';
  return parts.slice(1).join(' ').trim();
}

async function tryHandleWebLinkAttach(ctx: Context, payload: string): Promise<boolean> {
  const m = /^wlink_([a-f0-9]{32})$/i.exec(payload);
  if (!m) return false;
  const from = ctx.from;
  if (!from) return true;

  const telegramId = String(from.id);
  try {
    const result = await completeWebTelegramLink({
      token: m[1]!,
      telegramId,
      username: from.username,
      name: displayName(from),
    });
    const stars = result.wallet?.stars ?? result.user.wallet?.stars ?? result.user.walletStars ?? 0;
    const starsFa = new Intl.NumberFormat('fa-IR').format(Math.max(0, Math.floor(stars)));
    await ctx.reply(
      [
        '✅ حساب وب به تلگرام وصل شد.',
        result.merged ? 'حساب‌های قبلی ادغام شدند تا موجودی مشترک بماند.' : '',
        '',
        `⭐ موجودی ستاره مشترک با ربات: ${starsFa}`,
        'از صفحه کیف پول وب می‌توانی دوباره همگام‌سازی کنی.',
      ]
        .filter(Boolean)
        .join('\n'),
      { reply_markup: webLinksKeyboard(telegramId) }
    );
  } catch (err) {
    console.error('web telegram link failed:', err);
    const msg = err instanceof Error ? err.message : '';
    const fa =
      /410|expired|منقضی/i.test(msg)
        ? 'لینک منقضی شده — از کیف پول وب دوباره «اتصال تلگرام» را بزن.'
        : /409|already_linked/i.test(msg)
          ? 'این حساب وب قبلاً به تلگرام دیگری وصل است.'
          : 'اتصال ناموفق بود. از کیف پول وب دوباره تلاش کن.';
    await ctx.reply(fa);
  }
  return true;
}

/** Mobile pending login: show confirm callback (no website URL → Telegram WebView). */
async function tryHandleWebPendingLogin(ctx: Context, payload: string): Promise<boolean> {
  const pendingId = parseWebPendingLoginPayload(payload);
  if (!pendingId) return false;
  const from = ctx.from;
  if (!from) return true;

  const telegramId = String(from.id);
  const name = displayName(from);

  try {
    const user = await registerTelegramUser({
      telegramId,
      name,
      username: from.username,
    });
    const roles = normalizeRoles(user.roles, user.role);
    await upsertSession(telegramId, {
      userId: user.id,
      role: user.role,
      draftRoles: roles,
      step: roles.length ? 'ready' : 'role_select',
      locale: 'fa',
      pendingPhone: undefined,
    });
  } catch (err) {
    console.error('pending login register failed:', err);
  }

  await ctx.reply(
    [
      '🔐 تأیید ورود به وبسایت Pet Date',
      '',
      'اگر همین الان از مرورگر خودت «ورود با تلگرام» زدی،',
      'دکمهٔ «تأیید ورود» را بزن.',
      '',
      'بعد از تأیید، همان مرورگر (نه تلگرام) به‌صورت خودکار وارد می‌شود.',
      'این درخواست چند دقیقه اعتبار دارد.',
    ].join('\n'),
    { reply_markup: webPendingLoginConfirmKeyboard(pendingId) }
  );
  return true;
}

export async function handleWebPendingLoginConfirm(
  ctx: Context,
  pendingId: string,
  accept: boolean
): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const id = String(pendingId ?? '')
    .trim()
    .toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(id)) {
    await ctx.answerCallbackQuery({ text: 'شناسه نامعتبر', show_alert: true });
    return;
  }

  if (!accept) {
    await ctx.answerCallbackQuery({ text: 'لغو شد' });
    try {
      await ctx.editMessageText('ورود لغو شد. اگر لازم بود از سایت دوباره «ورود با تلگرام» را بزن.');
    } catch {
      await ctx.reply('ورود لغو شد. اگر لازم بود از سایت دوباره «ورود با تلگرام» را بزن.');
    }
    return;
  }

  try {
    await completeTelegramPendingLogin({
      id,
      telegramId: String(from.id),
      username: from.username,
      name: displayName(from),
    });
    await ctx.answerCallbackQuery({ text: 'تأیید شد ✅' });
    try {
      await ctx.editMessageText(
        [
          '✅ ورود تأیید شد.',
          '',
          'به همان مرورگری که ورود را شروع کردی برگرد؛',
          'صفحه به‌صورت خودکار ادامه می‌دهد.',
          '',
          'نیازی به باز کردن لینک وب از داخل تلگرام نیست.',
        ].join('\n')
      );
    } catch {
      await ctx.reply(
        '✅ ورود تأیید شد. به همان مرورگر برگرد — صفحه به‌صورت خودکار ادامه می‌دهد.'
      );
    }
  } catch (err) {
    console.error('pending login confirm failed:', err);
    const msg = err instanceof Error ? err.message : '';
    const fa =
      /410|expired|منقضی|missing/i.test(msg)
        ? 'درخواست منقضی شده — از سایت دوباره «ورود با تلگرام» را بزن.'
        : /409|already/i.test(msg)
          ? 'این درخواست قبلاً تأیید شده. به مرورگر برگرد.'
          : 'تأیید ناموفق بود. از سایت دوباره تلاش کن.';
    await ctx.answerCallbackQuery({ text: fa, show_alert: true });
  }
}

export async function handleStart(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const payload = startPayload(ctx);
  if (payload) {
    if (await tryHandleWebPendingLogin(ctx, payload)) return;
    await tryHandleWebLinkAttach(ctx, payload);
  }

  const telegramId = String(from.id);
  const name = displayName(from);

  try {
    const user = await registerTelegramUser({
      telegramId,
      name,
      username: from.username,
    });

    if (payload === 'wstars' || payload.startsWith('wstars')) {
      const roles = normalizeRoles(user.roles, user.role);
      await upsertSession(telegramId, {
        userId: user.id,
        role: user.role,
        draftRoles: roles,
        step: roles.length ? 'ready' : 'role_select',
        locale: 'fa',
        pendingPhone: undefined,
      });
      const { handleWalletStarsTopUpMenu } = await import('./coins');
      await handleWalletStarsTopUpMenu(ctx);
      return;
    }

    // Deep link: /start u_00042 or /start u00042 → open that user's public profile
    const profileId = payload ? parseUserIdFromCommand(payload) : null;
    if (profileId) {
      const roles = normalizeRoles(user.roles, user.role);
      await upsertSession(telegramId, {
        userId: user.id,
        role: user.role,
        draftRoles: roles,
        step: roles.length ? 'ready' : 'role_select',
        locale: 'fa',
        pendingPhone: undefined,
      });
      await showPublicUserById(ctx, profileId);
      if (!roles.length) {
        await ctx.reply('برای ادامه، نقشت را انتخاب کن:', {
          reply_markup: roleReplyKeyboard(),
        });
      }
      return;
    }

    const shopPayMatch = /^shoppay_(\d+)$/.exec(payload || '');
    if (shopPayMatch) {
      const roles = normalizeRoles(user.roles, user.role);
      await upsertSession(telegramId, {
        userId: user.id,
        role: user.role,
        draftRoles: roles,
        step: roles.length ? 'ready' : 'role_select',
        locale: 'fa',
        pendingPhone: undefined,
      });
      const { sendShopStarsInvoiceForPaymentOrder } = await import('./shop');
      await sendShopStarsInvoiceForPaymentOrder(ctx, Number(shopPayMatch[1]));
      return;
    }

    const shopCardMatch = /^shopcard_(\d+)$/.exec(payload || '');
    if (shopCardMatch) {
      const roles = normalizeRoles(user.roles, user.role);
      const paymentOrderId = Number(shopCardMatch[1]);
      await upsertSession(telegramId, {
        userId: user.id,
        role: user.role,
        draftRoles: roles,
        step: 'payment_receipt',
        locale: 'fa',
        pendingPhone: undefined,
        paymentPendingOrderId: paymentOrderId,
      });
      try {
        const { getPaymentOrder } = await import('../api-client');
        const { paymentCardInfo } = await import('../economy');
        const order = await getPaymentOrder(paymentOrderId);
        const card = paymentCardInfo();
        if (!order || String(order.packageId) !== 'shopcard') {
          await ctx.reply('فاکتور کارت فروشگاه پیدا نشد یا منقضی است.');
          return;
        }
        if (order.status === 'approved' || order.status === 'paid') {
          await ctx.reply('این پرداخت فروشگاه قبلاً تأیید شده است.');
          return;
        }
        if (order.status === 'rejected') {
          await ctx.reply('این پرداخت رد شده است. دوباره از شاپ اقدام کن.');
          return;
        }
        await ctx.reply(
          [
            '🛒 پرداخت کارت‌به‌کارت شاپ',
            '',
            `شماره پیگیری: #${paymentOrderId}`,
            `مبلغ: ${(order.amountToman ?? 0).toLocaleString('fa-IR')} تومان`,
            '',
            `کارت: ${card.number}`,
            `به‌نام: ${card.holder}`,
            '',
            order.status === 'awaiting_receipt'
              ? 'عکس رسید واریز را همین‌جا بفرست.'
              : 'رسید قبلاً ارسال شده و در صف بررسی ادمین است.',
          ].join('\n')
        );
      } catch (e) {
        await ctx.reply(e instanceof Error ? e.message : 'خطا در بازیابی پرداخت فروشگاه');
      }
      return;
    }

    if (payload.startsWith('wlink_')) {
      const roles = normalizeRoles(user.roles, user.role);
      await upsertSession(telegramId, {
        userId: user.id,
        role: user.role,
        draftRoles: roles,
        step: roles.length ? 'ready' : 'role_select',
        locale: 'fa',
        pendingPhone: undefined,
      });
      return;
    }

    const webLoginNext = parseWebLoginStartPayload(payload);
    if (webLoginNext) {
      const roles = normalizeRoles(user.roles, user.role);
      await upsertSession(telegramId, {
        userId: user.id,
        role: user.role,
        draftRoles: roles,
        step: roles.length ? 'ready' : 'role_select',
        locale: 'fa',
        pendingPhone: undefined,
      });

      const kb = webAutoLoginKeyboard(telegramId, webLoginNext);
      await ctx.reply(
        [
          '🔐 ورود امن به وبسایت Pet Date',
          '',
          'روی دکمه بزن تا با همان حساب تلگرام وارد وب شوی',
          '(پت‌ها، چت‌ها و کیف پول مشترک می‌مانند).',
          '',
          'لینک حدود ۱۵ دقیقه اعتبار دارد.',
        ].join('\n'),
        kb ? { reply_markup: kb } : undefined
      );
      if (!kb) {
        await ctx.reply(
          'الان لینک وب در دسترس نیست. چند لحظه بعد دوباره از سایت «ورود با اکانت تلگرام» را بزن.'
        );
      }
      return;
    }

    if (user.awardedRewards?.length) {
      const msg = formatCoinAwardMessage(user.awardedRewards);
      if (msg) await ctx.reply(msg);
    }

    const roles = normalizeRoles(user.roles, user.role);

    // Always show main menu on /start. Soft-notify if a playdate chat is still open.
    if (roles.length) {
      await resumeOwnerChatOnStart(ctx).catch((err) =>
        console.warn('resumeOwnerChatOnStart failed', err)
      );
    }

    await upsertSession(telegramId, {
      userId: user.id,
      role: user.role,
      draftRoles: roles,
      step: roles.length ? 'ready' : 'role_select',
      locale: 'fa',
      pendingPhone: undefined,
    });

    if (!roles.length) {
      const caption = [
        `سلام ${name}! 👋`,
        '',
        `${BRAND.welcomeFa}`,
        `_${BRAND.taglineEn}_`,
        '',
        'پیدا کردن همبازی پت، مشاوره دامپزشک و خدمات پت.',
        '',
        'می‌تونی **چند نقش** انتخاب کنی.',
        'نقش‌ها رو از منو تیک بزن، بعد «✅ ثبت نقش‌ها» رو بزن:',
      ].join('\n');
      const sent = await sendWelcomeLogo(ctx, caption, {
        reply_markup: roleReplyKeyboard([]),
      });
      if (!sent) {
        await ctx.reply(caption, { parse_mode: 'Markdown', reply_markup: roleReplyKeyboard([]) });
      }
      return;
    }

    await sendWelcomeBack(ctx, user, name);
  } catch (error) {
    console.error('start failed:', error);
    await ctx.reply('فعلاً سرور همبازی در دسترس نیست. چند لحظه بعد دوباره /start بزن.');
  }
}

export async function sendWelcomeBack(ctx: Context, user: User, name: string): Promise<void> {
  const active = primaryRole(user.roles, user.role);
  const isOwner = active === 'pet_owner';
  const isVet = active === 'vet';
  const profileDone = Boolean(
    user.name &&
      user.age &&
      user.gender &&
      user.country &&
      user.city &&
      (user.country !== 'ایران' || user.province)
  );
  const intro = !profileDone
    ? 'پروفایلت هنوز کامل نیست — الان می‌تونی تکمیل کنی یا «⏭ فعلاً رد کن» بزنی.'
    : isOwner
      ? 'از منوی زیر می‌تونی همبازی پیدا کنی، پت‌هات رو مدیریت کنی و از خدمات استفاده کنی.'
      : isVet
        ? 'از منوی زیر لیست بیماران و مشاوره‌هات رو ببین.'
        : 'از منوی زیر استفاده کن.';

  const caption = [
    `سلام ${name}! 👋`,
    '',
    `به ${BRAND.name} خوش برگشتی.`,
    BRAND.taglineEn,
    `نقش‌ها: ${roleLabels(user)}`,
    '',
    `${intro}${webLinkHint()}`,
  ].join('\n');

  if (!profileDone) {
    // اول کیبورد اصلی با «📋 منو» را بفرست تا کیبورد قدیمی تلگرام عوض شود،
    // بعد ویزارد پروفایل شروع می‌شود (ویزارد هم دکمه منو دارد).
    await ctx.reply(caption, { reply_markup: menuKeyboardFor(ctx, user) });
    await startProfileWizard(ctx);
    return;
  }

  const sent = await sendWelcomeLogo(ctx, caption, {
    reply_markup: menuKeyboardFor(ctx, user),
  });
  if (!sent) {
    await ctx.reply(caption, {
      reply_markup: menuKeyboardFor(ctx, user),
    });
  }
  const webKb = user.telegramId ? webLinksKeyboard(String(user.telegramId)) : undefined;
  if (webKb) {
    await ctx.reply('برای کیف پول و همگام‌سازی در وب:', { reply_markup: webKb });
  }
}

/** تاگل یک نقش در حالت انتخاب چندتایی */
export async function handleRoleToggle(ctx: Context, role: UserRole): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  const selected = new Set(session?.draftRoles ?? []);
  if (selected.has(role)) selected.delete(role);
  else selected.add(role);
  const next = [...selected] as UserRole[];

  await upsertSession(telegramId, {
    step: 'role_select',
    draftRoles: next,
  });

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: selected.has(role) ? 'اضافه شد' : 'برداشته شد',
    });
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: roleKeyboard(next) });
    } catch {
      /* ignore */
    }
    return;
  }

  const picked = next.length
    ? next.map((r) => USER_ROLE_LABELS[r]).join(' · ')
    : 'هنوز نقشی انتخاب نشده';
  await ctx.reply(
    `نقش‌های انتخاب‌شده:\n${picked}\n\nهر چند تا بخوای انتخاب کن، بعد «${ROLE_CONFIRM_LABEL}» رو بزن.`,
    { reply_markup: roleReplyKeyboard(next) }
  );
}

export async function handleRoleConfirm(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  const roles = normalizeRoles(session?.draftRoles);
  if (!roles.length) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: 'حداقل یک نقش انتخاب کن', show_alert: true });
    }
    await ctx.reply('حداقل یک نقش انتخاب کن، بعد ثبت کن.', {
      reply_markup: roleReplyKeyboard([]),
    });
    return;
  }

  await handleRolesSelect(ctx, roles);
}

export async function handleRolesSelect(ctx: Context, roles: UserRole[]): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  const isAddingRoles = Boolean(session?.addingRoles);
  const previousPrimary = session?.role;

  const normalized = normalizeRoles(roles);
  if (!normalized.length) {
    await ctx.reply('حداقل یک نقش انتخاب کن.', { reply_markup: roleReplyKeyboard([]) });
    return;
  }

  const user = await setUserRoles(telegramId, normalized);
  // اگر نقش فعال قبلی هنوز هست، همان را نگه دار؛ وگرنه primary پیش‌فرض
  let active =
    previousPrimary && normalized.includes(previousPrimary)
      ? previousPrimary
      : primaryRole(user.roles, user.role)!;
  if (active !== user.role) {
    try {
      const switched = await setUserPrimaryRole(telegramId, active);
      active = primaryRole(switched.roles, switched.role)!;
      Object.assign(user, switched);
    } catch {
      active = primaryRole(user.roles, user.role)!;
    }
  }

  const labels = normalizeRoles(user.roles, user.role)
    .map((r) => USER_ROLE_LABELS[r])
    .join(' · ');
  const hint = roleWelcomeHint(active);

  await upsertSession(telegramId, {
    userId: user.id,
    role: active,
    draftRoles: undefined,
    addingRoles: undefined,
    step: 'ready',
  });

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: isAddingRoles ? 'نقش‌ها به‌روز شد' : 'نقش‌ها ثبت شد' });
  }

  // افزودن نقش از منوی «نقش‌های من» — بدون ویزارد آنبوردینگ
  if (isAddingRoles) {
    const addText = [
      'نقش‌هات به‌روز شد ✅',
      '',
      `<b>${escapeHtml(labels)}</b>`,
      '',
      `نقش فعال: <b>${escapeHtml(USER_ROLE_LABELS[active])}</b>`,
    ].join('\n');
    await ctx.reply(addText, {
      parse_mode: 'HTML',
      reply_markup: menuKeyboardFor(ctx, { role: active, roles: user.roles }),
    });
    return;
  }

  await setUserOnboarding(telegramId, 'profile_incomplete');

  const text = [
    `عالی! نقش‌هات ثبت شد 🎉`,
    '',
    `<b>${escapeHtml(labels)}</b>`,
    '',
    escapeHtml(hint) + escapeHtml(webLinkHint()),
    '',
    'حالا پروفایلت رو کامل کنیم — اگر الان وقت نداری «⏭ فعلاً رد کن» رو بزن.',
  ].join('\n');

  try {
    if (ctx.callbackQuery) {
      try {
        if (ctx.callbackQuery.message && 'photo' in ctx.callbackQuery.message) {
          await ctx.editMessageCaption({ caption: text, parse_mode: 'HTML' });
        } else {
          await ctx.editMessageText(text, { parse_mode: 'HTML' });
        }
      } catch {
        await ctx.reply(text, { parse_mode: 'HTML' });
      }
    } else {
      await ctx.reply(text, { parse_mode: 'HTML' });
    }
  } catch (err) {
    console.warn('role confirm reply failed:', (err as Error).message);
    await ctx.reply(`عالی! نقش‌هات ثبت شد: ${labels}`);
  }

  // ویزارد تکمیل پروفایل بلافاصله بعد از انتخاب نقش
  await startProfileWizard(ctx);

  // دامپزشک: احراز موبایل اجباری است — بعد از ویزارد یادآوری می‌کنیم
  if (normalized.includes('vet')) {
    await ctx.reply(
      [
        '📱 <b>توجه دامپزشکان</b>',
        '',
        'برای فعال‌شدن امکانات دامپزشکی (بیماران، مدرک، آنلاین بودن) باید موبایلت رو با پیامک تأیید کنی.',
        'از «👤 پروفایل» دکمه «📱 احراز موبایل» رو بزن.',
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** سازگاری با انتخاب تکی قدیمی — الان تاگل می‌کند */
export async function handleRoleSelect(ctx: Context, role: UserRole): Promise<void> {
  await handleRoleToggle(ctx, role);
}

/** صفحهٔ نقش‌های من — سوییچ نقش فعال (ورود به پنل نقش) */
export async function handleMyRoles(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  const roles = normalizeRoles(user.roles, user.role);
  if (!roles.length) {
    await upsertSession(String(from.id), {
      step: 'role_select',
      draftRoles: [],
      addingRoles: false,
    });
    await ctx.reply('هنوز نقشی نداری. نقش‌هات رو انتخاب کن:', {
      reply_markup: roleReplyKeyboard([]),
    });
    return;
  }

  const active = primaryRole(roles, user.role);
  const lines =
    roles.length === 1
      ? [
          '🎭 <b>نقش‌های من</b>',
          '',
          `نقش فعال: <b>${escapeHtml(USER_ROLE_LABELS[roles[0]!])}</b>`,
          '',
          'فقط یک نقش داری. برای افزودن نقش جدید «➕ افزودن نقش» رو بزن.',
        ]
      : [
          '🎭 <b>نقش‌های من</b>',
          '',
          `نقش فعال: <b>${escapeHtml(USER_ROLE_LABELS[active!])}</b>`,
          '',
          'برای رفتن به پنل هر نقش، روی نقش موردنظر بزن:',
        ];

  await ctx.reply(lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: myRolesSwitchKeyboard(roles, active),
  });
}

/** سوییچ نقش فعال بین نقش‌های موجود — منوی همان پنل را نشان می‌دهد */
export async function handleMyRolesSwitch(ctx: Context, role: UserRole): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }

  const roles = normalizeRoles(user.roles, user.role);
  if (!roles.includes(role)) {
    await ctx.answerCallbackQuery({ text: 'این نقش مال تو نیست', show_alert: true });
    return;
  }

  const current = primaryRole(roles, user.role);
  if (current === role) {
    await ctx.answerCallbackQuery({ text: 'همین الان فعاله' });
    await ctx.reply(`منوی ${USER_ROLE_LABELS[role]} 👇`, {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }

  const updated = await setUserPrimaryRole(telegramId, role);
  const active = primaryRole(updated.roles, updated.role)!;

  await upsertSession(telegramId, {
    userId: updated.id,
    role: active,
    step: 'ready',
    addingRoles: undefined,
  });

  await ctx.answerCallbackQuery({ text: `نقش فعال: ${USER_ROLE_LABELS[active]}` });

  const confirm = `نقش فعال: <b>${escapeHtml(USER_ROLE_LABELS[active])}</b>`;
  try {
    await ctx.editMessageText(
      [
        '🎭 <b>نقش‌های من</b>',
        '',
        confirm,
        '',
        'منوی پنل بر اساس نقش فعال به‌روز شد 👇',
      ].join('\n'),
      {
        parse_mode: 'HTML',
        reply_markup: myRolesSwitchKeyboard(normalizeRoles(updated.roles, updated.role), active),
      }
    );
  } catch {
    /* ignore edit failures */
  }

  await ctx.reply(confirm, {
    parse_mode: 'HTML',
    reply_markup: menuKeyboardFor(ctx, updated),
  });
}

/** شروع جریان افزودن نقش (همان multi-role select) */
export async function handleMyRolesAdd(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const user = await getCtxUser(ctx);
  const roles = normalizeRoles(user?.roles, user?.role);

  await upsertSession(telegramId, {
    step: 'role_select',
    draftRoles: roles,
    addingRoles: true,
    userId: user?.id,
  });

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
  }

  await ctx.reply(
    [
      'نقش‌های جدید رو تیک بزن (نقش‌های فعلی هم هستن).',
      `بعد «${ROLE_CONFIRM_LABEL}» رو بزن:`,
    ].join('\n'),
    { reply_markup: roleReplyKeyboard(roles) }
  );
}

export async function handleHelp(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  const active = primaryRole(user?.roles, user?.role);
  const isOwner = active === 'pet_owner';
  const isVet = active === 'vet';
  const isSeeker = active === 'pet_seeker';
  const isNoPet = active === 'no_pet';

  const lines = isOwner
    ? [
        `🐾 **${BRAND.name}** — راهنمای صاحب پت`,
        `_${BRAND.taglineEn}_`,
        '',
        '🔍 **پیدا کردن همبازی** — درخواست به هم‌گروه‌ها',
        '📍 **پت‌های نزدیک** — بر اساس شهر/استان',
        '🔎 **جستجوی پت** — هم‌استان، هم‌نژاد، همه، جدید، محبوب',
        '🐾 **پت‌های من** — مدیریت و ثبت پت',
        '👤 **پروفایل** — اطلاعات + احراز',
        '⚡ **مشاوره سریع پزشک** — درخواست فوری',
        '💵 **کسب درآمد** — فروش سکه',
        '🛠 **خدمات** — مربی، grooming، حمل',
        '🪙 **سکه** · 🛒 **پت‌شاپ** · 🎁 **دعوت** · ❓ **راهنما**',
        '',
        '📋 **منو** — بازگشت به منوی اصلی',
        '/start — بازگشت به منو',
        '/menu — نمایش منو',
        '/cancel — لغو عملیات جاری',
      ]
    : isVet
      ? [
          `🐾 **${BRAND.name}** — راهنمای دامپزشک`,
          `_${BRAND.taglineEn}_`,
          '',
          '🟢 **آنلاین — آماده پذیرش** / 🔴 **آفلاین**',
          '🩺 **بیماران اخیر** — ۵ بیمار آخر',
          '💰 **تعرفه ویزیت** — تنظیم به سکه',
          '👤 **پروفایل** — اطلاعات + احراز',
          '🪙 **سکه** · 🛒 **پت‌شاپ** · 🎁 **دعوت** · ❓ **راهنما**',
          '',
          '/start — شروع یا بازگشت به منو',
          '/menu — نمایش منو',
          '/help — راهنما',
          '/cancel — لغو عملیات جاری',
        ]
      : isSeeker
        ? [
            `🐾 **${BRAND.name}** — راهنمای دنبال پت`,
            `_${BRAND.taglineEn}_`,
            '',
            '🐾 **پت‌ها و همبازی** — مرور و جستجوی پت',
            '💚 **آماده پذیرش پت هستم** — اعلام آمادگی',
            '👤 **پروفایل** — اطلاعات + احراز',
            '🪙 **سکه** · 🛒 **پت‌شاپ** · 🎁 **دعوت** · ❓ **راهنما**',
            '',
            '/menu — نمایش منو',
            '/help — راهنما',
            '/cancel — لغو عملیات جاری',
          ]
        : isNoPet
          ? [
              `🐾 **${BRAND.name}** — راهنمای بدون پت`,
              `_${BRAND.taglineEn}_`,
              '',
              '🛒 **به دنبال مشاوره برای خرید** — مشاوره دامپزشک برای انتخاب پت',
              '👤 **پروفایل** — اطلاعات + احراز',
              '🪙 **سکه** · 🛒 **پت‌شاپ** · 🎁 **دعوت** · ❓ **راهنما**',
              '',
              '/menu — نمایش منو',
              '/help — راهنما',
              '/cancel — لغو عملیات جاری',
            ]
          : [
              `🐾 **${BRAND.name}** — ${BRAND.taglineFa}`,
              `_${BRAND.taglineEn}_`,
              '',
              '🪙 **سکه** · 🛒 **پت‌شاپ** · 🎁 **دعوت** · ❓ **راهنما**',
              '',
              '/start — شروع یا بازگشت',
              '/menu — نمایش منو',
              '/help — راهنما',
            ];

  await ctx.reply(lines.join('\n'), {
    parse_mode: 'Markdown',
    reply_markup: menuKeyboardFor(ctx, user),
  });
}

export async function handleCancel(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const user = await getCtxUser(ctx);
  await upsertSession(String(from.id), {
    step: 'ready',
    draftPet: undefined,
    draftProfile: undefined,
    draftRoles: undefined,
    addingRoles: undefined,
    profileSectionEdit: false,
    petSectionEdit: false,
    pendingPhone: undefined,
    selectedPetId: undefined,
    selectedToPetId: undefined,
    breedPage: undefined,
    searchMode: undefined,
    searchBreed: undefined,
    searchSpecies: undefined,
    searchPage: undefined,
    searchBreedPage: undefined,
    searchLat: undefined,
    searchLng: undefined,
    earnPendingCoins: undefined,
    paymentPendingOrderId: undefined,
    adminRejectUserId: undefined,
    ownerChatPlaydateId: undefined,
    ownerChatPeerTelegramId: undefined,
    ownerChatPeerUserId: undefined,
    ownerChatMyPetId: undefined,
    ownerChatPeerPetId: undefined,
    ownerChatSecure: undefined,
    vetChatConsultId: undefined,
    vetChatPeerTelegramId: undefined,
    vetChatRole: undefined,
  });
  await ctx.reply('عملیات لغو شد.', {
    reply_markup: menuKeyboardFor(ctx, user),
  });
}

export async function handleMenu(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  await ctx.reply(`منوی ${BRAND.name} 👇\n(دکمه «📋 منو» در ردیف اول)`, {
    reply_markup: menuKeyboardFor(ctx, user),
  });
}
