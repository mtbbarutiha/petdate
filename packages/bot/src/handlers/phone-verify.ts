import type { Context } from 'grammy';
import { Keyboard } from 'grammy';
import {
  formatIranMobileDisplay,
  isProfileComplete,
  normalizeIranMobile,
  phoneVerifyIntroText,
  toEnglishDigits,
  userHasRole,
  type User,
} from '@petdate/shared';
import { sendPhoneOtp, verifyPhoneOtp } from '../api-client';
import {
  ADMIN_MENU,
  DEFAULT_MENU,
  MAIN_MENU_ALIASES,
  MY_PETS_SECTION,
  NO_PET_MENU,
  PET_OWNER_MENU,
  PET_SEEKER_MENU,
  SEARCH_PETS_MENU,
  SITTER_MENU,
  TRAINER_MENU,
  VET_MENU,
  WIZARD_NAV,
  phoneWizardKeyboard,
  withWizardNav,
} from '../keyboards';
import { getSession, upsertSession } from '../session';
import { getCtxUser, menuKeyboardFor } from './helpers';

/** دکمه‌های منو نباید به‌عنوان شماره موبایل بلعیده شوند (جلوگیری از قفل شدن بات) */
const MENU_LABELS = new Set<string>([
  ...Object.values(PET_OWNER_MENU),
  ...Object.values(DEFAULT_MENU),
  ...Object.values(NO_PET_MENU),
  ...Object.values(PET_SEEKER_MENU),
  ...Object.values(VET_MENU),
  ...Object.values(TRAINER_MENU),
  ...Object.values(SITTER_MENU),
  ...Object.values(ADMIN_MENU),
  ...Object.values(SEARCH_PETS_MENU),
  ...Object.values(MY_PETS_SECTION),
  ...MAIN_MENU_ALIASES,
  '🛡 احراز هویت',
]);

function phoneOtpKeyboard(resendAtMs?: number): Keyboard {
  const left = resendAtMs ? Math.max(0, Math.ceil((resendAtMs - Date.now()) / 1000)) : 0;
  const label =
    left > 0
      ? `⏳ ارسال مجدد (${left.toLocaleString('fa-IR')}ث)`
      : '🔄 ارسال مجدد کد';
  return withWizardNav(new Keyboard().text(label).primary(), {
    noBack: true,
    skip: false,
  });
}

function isResendLabel(text: string): boolean {
  return text === '🔄 ارسال مجدد کد' || /^⏳ ارسال مجدد/.test(text);
}

function phoneAskKeyboard(required: boolean): Keyboard {
  return phoneWizardKeyboard({ required });
}

/** آیا کاربر باید موبایل را تأیید کند؟ (ثبت‌نام و همه نقش‌ها) */
export function needsPhoneVerify(user: User | null | undefined): boolean {
  if (!user) return false;
  return !user.phoneVerified;
}

/** @deprecated use needsPhoneVerify — kept for call sites that still say «vet» */
export function vetNeedsPhoneVerify(user: User | null | undefined): boolean {
  return needsPhoneVerify(user);
}

/**
 * گیت اقدامات حیاتی: بدون موبایل تأییدشده ادامه نده.
 * برای دامپزشکان قبلاً اجباری بود؛ الان برای همه نقش‌ها.
 */
export async function ensureVetPhoneVerified(ctx: Context): Promise<boolean> {
  return ensurePhoneVerified(ctx);
}

export async function ensurePhoneVerified(ctx: Context): Promise<boolean> {
  const user = await getCtxUser(ctx);
  if (!needsPhoneVerify(user)) return true;

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: 'اول موبایلت رو تأیید کن',
      show_alert: true,
    }).catch(() => undefined);
  }

  await ctx.reply(
    [
      '📱 <b>احراز موبایل الزامی</b>',
      '',
      'برای ادامه باید شماره موبایلت رو با پیامک تأیید کنی.',
    ].join('\n'),
    { parse_mode: 'HTML' }
  );
  await handlePhoneVerifyStart(ctx, { required: true });
  return false;
}

export async function handlePhoneVerifyStart(
  ctx: Context,
  opts?: { required?: boolean; continueProfile?: boolean }
): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  const telegramId = String(from.id);

  if (user.phoneVerified && user.phone) {
    await upsertSession(telegramId, {
      step: 'ready',
      pendingPhone: undefined,
      phoneVerifyRequired: undefined,
    });
    await ctx.reply(
      [
        '✅ موبایلت قبلاً تأیید شده.',
        '',
        `شماره: <code>${formatIranMobileDisplay(user.phone)}</code>`,
        '',
        'اگر می‌خوای شماره جدید تأیید کنی، از پروفایل دوباره «📱 احراز موبایل» رو بزن و شماره جدید بفرست.',
      ].join('\n'),
      {
        parse_mode: 'HTML',
        reply_markup: menuKeyboardFor(ctx, user),
      }
    );
  }

  const required = opts?.required ?? needsPhoneVerify(user);
  await upsertSession(telegramId, {
    step: 'phone_verify_ask',
    pendingPhone: undefined,
    adminRejectUserId: undefined,
    phoneVerifyRequired: required || undefined,
    // Stash so OTP success can resume onboarding
    ...(opts?.continueProfile ? { profileGapFill: false } : {}),
  });

  await ctx.reply(phoneVerifyIntroText({ required }), {
    parse_mode: 'HTML',
    reply_markup: phoneAskKeyboard(required),
  });
}

export async function handlePhoneVerifyCancel(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (session?.phoneVerifyRequired) {
    await ctx.reply('احراز موبایل اجباری است — نمی‌تونی لغو کنی. شماره رو بفرست.', {
      reply_markup: phoneAskKeyboard(true),
    });
    return;
  }
  const user = await getCtxUser(ctx);
  await upsertSession(telegramId, {
    step: 'ready',
    pendingPhone: undefined,
    phoneVerifyRequired: undefined,
  });
  await ctx.reply('احراز موبایل لغو شد.', {
    reply_markup: menuKeyboardFor(ctx, user),
  });
}

/** contact share در جریان احراز موبایل */
export async function handlePhoneVerifyContact(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  const contact = ctx.message?.contact;
  if (!from || !contact?.phone_number) return false;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session || session.step !== 'phone_verify_ask') return false;

  // فقط شمارهٔ خود کاربر
  if (contact.user_id != null && contact.user_id !== from.id) {
    await ctx.reply('لطفاً شمارهٔ خودت رو اشتراک بگذار.');
    return true;
  }

  await dispatchSendOtp(ctx, telegramId, contact.phone_number);
  return true;
}

/** متن شماره یا کد OTP */
export async function handlePhoneVerifyText(ctx: Context, text: string): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session) return false;

  if (session.step !== 'phone_verify_ask' && session.step !== 'phone_verify_otp') {
    return false;
  }

  const required = Boolean(session.phoneVerifyRequired);

  if (text === WIZARD_NAV.cancel) {
    await handlePhoneVerifyCancel(ctx);
    return true;
  }

  // اگر کاربر دکمه منو زد: در حالت اجباری قفل بمان؛ وگرنه آزاد کن
  if (MENU_LABELS.has(text)) {
    if (required) {
      await ctx.reply('اول موبایلت رو با پیامک تأیید کن، بعد منو باز می‌شه.', {
        reply_markup: phoneAskKeyboard(true),
      });
      return true;
    }
    const user = await getCtxUser(ctx);
    await upsertSession(telegramId, {
      step: 'ready',
      pendingPhone: undefined,
      phoneVerifyRequired: undefined,
    });
    return false; // اجازه بده handler منو اجرا شود
  }

  if (session.step === 'phone_verify_ask') {
    if (text === WIZARD_NAV.skip || text === WIZARD_NAV.skipLater) {
      if (required || needsPhoneVerify(await getCtxUser(ctx))) {
        await ctx.reply('رد کردن احراز موبایل ممکن نیست. لطفاً شماره رو بفرست.', {
          reply_markup: phoneAskKeyboard(true),
        });
        return true;
      }
      await handlePhoneVerifyCancel(ctx);
      return true;
    }
    // فقط اگر شبیه شماره موبایل بود OTP بفرست؛ وگرنه منو قفل نشود
    const normalized = normalizeIranMobile(text);
    if (!normalized) {
      await ctx.reply('شماره موبایل معتبر بفرست (مثلاً 0912…) یا دکمهٔ اشتراک شماره رو بزن.', {
        reply_markup: phoneAskKeyboard(required),
      });
      return true;
    }
    await dispatchSendOtp(ctx, telegramId, normalized);
    return true;
  }

  // phone_verify_otp
  if (isResendLabel(text)) {
    const phone = session.pendingPhone;
    if (!phone) {
      await upsertSession(telegramId, {
        step: 'phone_verify_ask',
        pendingPhone: undefined,
        phoneOtpResendAt: undefined,
      });
      await ctx.reply('شماره پیدا نشد. دوباره شماره رو بفرست.', {
        reply_markup: phoneAskKeyboard(required),
      });
      return true;
    }
    const resendAt = session.phoneOtpResendAt ?? 0;
    const left = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
    if (left > 0) {
      await ctx.reply(
        `برای ارسال مجدد ${left.toLocaleString('fa-IR')} ثانیه صبر کن.`,
        { reply_markup: phoneOtpKeyboard(resendAt) }
      );
      return true;
    }
    await dispatchSendOtp(ctx, telegramId, phone);
    return true;
  }

  const phone = session.pendingPhone;
  if (!phone) {
    await upsertSession(telegramId, { step: 'phone_verify_ask' });
    await ctx.reply('جلسه منقضی شده. دوباره شماره رو بفرست.', {
      reply_markup: phoneAskKeyboard(required),
    });
    return true;
  }

  const code = toEnglishDigits(text).replace(/[^\d]/g, '');
  if (!/^\d{4,8}$/.test(code)) {
    await ctx.reply('کد تأیید رو به‌صورت عدد بفرست (۵ رقم).', {
      reply_markup: phoneOtpKeyboard(session.phoneOtpResendAt),
    });
    return true;
  }

  try {
    const result = await verifyPhoneOtp(telegramId, phone, code);
    if (!result.ok) {
      const reason = (result as { reason?: string; error?: string; attemptsLeft?: number }).reason;
      const attemptsLeft = (result as { attemptsLeft?: number }).attemptsLeft;
      if (reason === 'mismatch') {
        await ctx.reply(
          `کد نادرست است${attemptsLeft != null ? ` — ${attemptsLeft} تلاش باقی‌مانده` : ''}.`,
          { reply_markup: phoneOtpKeyboard(session.phoneOtpResendAt) }
        );
        return true;
      }
      await upsertSession(telegramId, {
        step: 'phone_verify_ask',
        pendingPhone: undefined,
        phoneOtpResendAt: undefined,
      });
      await ctx.reply(
        reason === 'expired'
          ? 'کد منقضی شد. دوباره شماره رو بفرست تا کد جدید بیاد.'
          : reason === 'too_many'
            ? 'تعداد تلاش بیش از حد. دوباره شماره رو بفرست.'
            : 'تأیید ناموفق. دوباره شماره رو بفرست.',
        { reply_markup: phoneAskKeyboard(required) }
      );
      return true;
    }

    const user = result.user;
    const wasRequired = required;
    await upsertSession(telegramId, {
      step: 'ready',
      pendingPhone: undefined,
      phoneOtpResendAt: undefined,
      phoneVerifyRequired: undefined,
    });
    await ctx.reply(
      [
        '✅ <b>موبایل تأیید شد</b>',
        '',
        `شماره: <code>${formatIranMobileDisplay(user.phone || phone)}</code>`,
        '',
        userHasRole(user, 'vet')
          ? 'الان می‌تونی از امکانات دامپزشکی استفاده کنی.'
          : 'مرسی! حسابت امن‌تر شد.',
      ].join('\n'),
      {
        parse_mode: 'HTML',
        reply_markup: menuKeyboardFor(ctx, user),
      }
    );

    // ثبت‌نام: بعد از احراز موبایل، ویزارد پروفایل را ادامه بده
    if (wasRequired && !isProfileComplete(user)) {
      const { startProfileWizard } = await import('./profile');
      await startProfileWizard(ctx);
    }
  } catch (err) {
    console.error('verifyPhoneOtp failed:', err);
    const latest = await getSession(telegramId);
    await ctx.reply('خطا در تأیید کد. کمی بعد دوباره تلاش کن.', {
      reply_markup: phoneOtpKeyboard(latest?.phoneOtpResendAt),
    });
  }
  return true;
}

async function dispatchSendOtp(
  ctx: Context,
  telegramId: string,
  phoneRaw: string
): Promise<void> {
  const session = await getSession(telegramId);
  const required = Boolean(session?.phoneVerifyRequired);
  const normalized = normalizeIranMobile(phoneRaw);
  if (!normalized) {
    await ctx.reply(
      'شماره نامعتبره. مثل ۰۹۱۲۳۴۵۶۷۸۹ بفرست یا دکمهٔ اشتراک شماره رو بزن.',
      { reply_markup: phoneAskKeyboard(required) }
    );
    return;
  }

  try {
    const result = await sendPhoneOtp(telegramId, normalized);
    if (!result.ok) {
      const reason = result.reason;
      if (reason === 'cooldown') {
        const retry = result.retryAfterSec ?? 60;
        const resendAt = Date.now() + retry * 1000;
        await upsertSession(telegramId, { phoneOtpResendAt: resendAt });
        await ctx.reply(
          `کمی صبر کن (حدود ${retry.toLocaleString('fa-IR')} ثانیه) و دوباره درخواست کد بده.`,
          { reply_markup: phoneOtpKeyboard(resendAt) }
        );
        return;
      }
      await ctx.reply(
        result.error ||
          (reason === 'not_configured'
            ? 'سرویس پیامک فعلاً در دسترس نیست.'
            : 'ارسال پیامک ناموفق بود. کمی بعد دوباره تلاش کن.'),
        { reply_markup: phoneAskKeyboard(required) }
      );
      return;
    }

    const resendAt = Date.now() + 60_000;
    await upsertSession(telegramId, {
      step: 'phone_verify_otp',
      pendingPhone: result.phone,
      phoneOtpResendAt: resendAt,
    });

    await ctx.reply(
      [
        '📩 کد تأیید برات پیامک شد.',
        '',
        `شماره: <code>${formatIranMobileDisplay(result.phone)}</code>`,
        'کد ۵ رقمی رو اینجا بفرست.',
        'اعتبار کد حدود ۵ دقیقه است.',
        'ارسال مجدد تا ۶۰ ثانیه دیگر فعال می‌شود.',
      ].join('\n'),
      {
        parse_mode: 'HTML',
        reply_markup: phoneOtpKeyboard(resendAt),
      }
    );
  } catch (err) {
    console.error('sendPhoneOtp failed:', err);
    await ctx.reply(
      required
        ? 'ارتباط با سرور برقرار نشد یا سرویس پیامک قطع است. کمی بعد دوباره شماره رو بفرست.'
        : 'ارتباط با سرور برقرار نشد یا سرویس پیامک قطع است. کمی بعد دوباره از پروفایل «📱 احراز موبایل» رو بزن.',
      { reply_markup: phoneAskKeyboard(required) }
    );
  }
}
