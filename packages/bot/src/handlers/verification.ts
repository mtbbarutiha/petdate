import { getCtxUser, menuKeyboardFor } from './helpers';
import type { Context } from 'grammy';
import { VERIFIED_BADGE, VERIFICATION_STATUS_LABELS, faceVerifyIntroText } from '@petdate/shared';
import {
  approveVerification,
  listPendingVerifications,
  rejectVerification,
  submitVerification,
} from '../api-client';
import { isAdminAuthorized } from './admin-auth';
import { FACE_VERIFY_REWARD, formatNum } from '../economy';
import {
  adminRejectSkipKeyboard,
  adminVerificationKeyboard,
  verificationSubmitKeyboard,
} from '../keyboards';
import { getSession, upsertSession } from '../session';
import { resolveTelegramPhotoUrl } from '../urls';
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function requireAdmin(ctx: Context): Promise<boolean> {
  if (await isAdminAuthorized(ctx)) return true;
  await ctx.reply('این بخش فقط برای ادمین است.');
  return false;
}

export async function handleVerifyStatus(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }
  const status = user.verificationStatus ?? 'none';
  if (status === 'verified') {
    await ctx.reply(
      [
        `${VERIFIED_BADGE}`,
        '',
        'احراز چهره‌ات تأیید شده.',
        'بج احراز روی پروفایلت نمایش داده می‌شه.',
      ].join('\n'),
      { reply_markup: menuKeyboardFor(ctx, user) }
    );
    return;
  }
  if (status === 'pending') {
    await ctx.reply(
      '⏳ درخواست احراز چهره‌ات در صف بررسی ادمینه.\nبه‌محض تأیید یا رد، همین‌جا خبرت می‌کنیم.',
      { reply_markup: menuKeyboardFor(ctx, user) }
    );
    return;
  }
  await handleVerifyStart(ctx);
}

/** شروع احراز چهره — برای همه نقش‌ها (سبک دوردوریا) */
export async function handleVerifyStart(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  const status = user.verificationStatus ?? 'none';
  if (status === 'verified' || status === 'pending') {
    await handleVerifyStatus(ctx);
    return;
  }

  const telegramId = String(from.id);
  await upsertSession(telegramId, { step: 'verify_photo', adminRejectUserId: undefined });

  const lines = [faceVerifyIntroText(FACE_VERIFY_REWARD), ''];
  if (status === 'rejected') {
    lines.push('⚠️ درخواست قبلی‌ات رد شده؛ می‌تونی دوباره ارسال کنی.');
    if (user.verificationNote) {
      lines.push(`دلیل: ${escapeHtml(user.verificationNote)}`);
    }
    lines.push('');
  }
  lines.push('یک سلفی / ویدیوی کوتاه بفرست، یا از دکمهٔ زیر عکس فعلی پروفایل رو بفرست 👇');

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => undefined);
  }

  await ctx.reply(lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: verificationSubmitKeyboard(Boolean(user.avatarUrl)),
  });
}

export async function handleVerifyCancel(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const user = await getCtxUser(ctx);
  await upsertSession(String(from.id), {
    step: 'ready',
    adminRejectUserId: undefined,
  });
  await ctx.reply('احراز چهره لغو شد.', {
    reply_markup: menuKeyboardFor(ctx, user),
  });
}

export async function handleVerifyUseAvatar(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const user = await getCtxUser(ctx);
  if (!user?.avatarUrl) {
    await ctx.reply('عکس پروفایل نداری. یک سلفی جدید بفرست.');
    return;
  }
  await finishSubmit(ctx, String(from.id), user.avatarUrl);
}

export async function handleVerifyPhoto(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  const photos = ctx.message?.photo;
  if (!from || !photos?.length) return false;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session || session.step !== 'verify_photo') return false;

  const best = photos[photos.length - 1]!;
  await finishSubmit(ctx, telegramId, best.file_id);
  return true;
}

/** ویدیو / ویدیو نوت برای احراز چهره (مثل دوردوریا) */
export async function handleVerifyVideo(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session || session.step !== 'verify_photo') return false;

  const videoNote = ctx.message?.video_note;
  const video = ctx.message?.video;
  const fileId = videoNote?.file_id || video?.file_id;
  if (!fileId) return false;

  await finishSubmit(ctx, telegramId, fileId);
  return true;
}

async function finishSubmit(ctx: Context, telegramId: string, photoFileId: string): Promise<void> {
  const user = await getCtxUser(ctx);
  try {
    await submitVerification(telegramId, photoFileId);
  } catch (err) {
    const msg = String(err);
    if (msg.includes('409') || msg.includes('already_verified')) {
      await ctx.reply(`${VERIFIED_BADGE}\nقبلاً احراز شده‌ای.`);
      return;
    }
    await ctx.reply('ارسال درخواست احراز ناموفق بود. دوباره تلاش کن.');
    console.error('submitVerification failed:', err);
    return;
  }

  await upsertSession(telegramId, { step: 'ready', adminRejectUserId: undefined });
  await ctx.reply(
    [
      '✅ درخواست احراز چهره ثبت شد.',
      '',
      'فایل رفت تو صف بررسی ادمین.',
      `بعد از تأیید، بج احراز + ${formatNum(FACE_VERIFY_REWARD)} سکه جایزه می‌گیری.`,
      'نتیجه همین‌جا برات پیام میاد.',
    ].join('\n'),
    { reply_markup: menuKeyboardFor(ctx, user) }
  );
}

function formatAdminCard(user: Awaited<ReturnType<typeof listPendingVerifications>>[number]): string {
  const loc = [user.province, user.city].filter(Boolean).join('، ') || '—';
  const roles = (user.roles?.length ? user.roles : user.role ? [user.role] : []).join(', ') || '—';
  return [
    '🛡 <b>درخواست احراز چهره</b>',
    '',
    `<b>نام:</b> ${escapeHtml(user.name)}`,
    user.username ? `<b>یوزرنیم:</b> @${escapeHtml(user.username)}` : null,
    `<b>آیدی:</b> <code>${user.id}</code>`,
    user.telegramId ? `<b>تلگرام:</b> <code>${escapeHtml(user.telegramId)}</code>` : null,
    `<b>نقش:</b> ${escapeHtml(roles)}`,
    `<b>شهر:</b> ${escapeHtml(loc)}`,
    `<b>وضعیت:</b> ${VERIFICATION_STATUS_LABELS[user.verificationStatus ?? 'pending']}`,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

async function sendAdminVerificationItem(
  ctx: Context,
  user: Awaited<ReturnType<typeof listPendingVerifications>>[number]
): Promise<void> {
  const caption = formatAdminCard(user);
  const kb = adminVerificationKeyboard(user.id);
  const raw = user.verificationPhotoFileId || user.avatarUrl;
  if (raw) {
    const media = resolveTelegramPhotoUrl(raw) || raw;
    const isPathOrUrl = /^https?:\/\//i.test(String(raw)) || String(raw).startsWith('/');

    if (!isPathOrUrl) {
      // Telegram file_id — try photo, then video, then video_note (circle)
      try {
        await ctx.replyWithPhoto(media, {
          caption,
          parse_mode: 'HTML',
          reply_markup: kb,
        });
        return;
      } catch {
        /* maybe video file_id */
      }
      try {
        await ctx.replyWithVideo(media, {
          caption,
          parse_mode: 'HTML',
          reply_markup: kb,
        });
        return;
      } catch {
        /* maybe video_note */
      }
      try {
        // video_note has no caption — send note then card + actions
        await ctx.replyWithVideoNote(media);
        await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: kb });
        return;
      } catch {
        /* fall through */
      }
    } else if (media && /^https?:\/\//i.test(media)) {
      // Web-stored selfie/video URL Telegram can fetch
      try {
        await ctx.replyWithPhoto(media, {
          caption,
          parse_mode: 'HTML',
          reply_markup: kb,
        });
        return;
      } catch {
        /* maybe video URL */
      }
      try {
        await ctx.replyWithVideo(media, {
          caption,
          parse_mode: 'HTML',
          reply_markup: kb,
        });
        return;
      } catch {
        /* fall through */
      }
    }
  }
  await ctx.reply(`${caption}\n\n⚠️ فایل در دسترس نیست.`, {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
}

export async function handleAdminVerifyQueue(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;

  let pending: Awaited<ReturnType<typeof listPendingVerifications>>;
  try {
    pending = await listPendingVerifications();
  } catch (err) {
    console.error('listPendingVerifications failed:', err);
    await ctx.reply('خطا در دریافت صف احراز.');
    return;
  }

  if (pending.length === 0) {
    await ctx.reply('📭 صف احراز چهره خالی است.');
    return;
  }

  await ctx.reply(`📋 ${pending.length} درخواست در صف احراز:`);
  const first = pending[0]!;
  await sendAdminVerificationItem(ctx, first);
  if (pending.length > 1) {
    await ctx.reply(`+ ${pending.length - 1} مورد دیگر — «⏭ بعدی» را بزن.`);
  }
}

export async function handleAdminVerifyNext(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  await handleAdminVerifyQueue(ctx);
}

export async function handleAdminApprove(ctx: Context, userId: number): Promise<void> {
  if (!(await requireAdmin(ctx))) return;

  let result: Awaited<ReturnType<typeof approveVerification>>;
  try {
    result = await approveVerification(userId, FACE_VERIFY_REWARD);
  } catch (err) {
    console.error('approveVerification failed:', err);
    await ctx.answerCallbackQuery({ text: 'خطا یا دیگر در صف نیست', show_alert: true }).catch(() => undefined);
    return;
  }

  const user = result.user;
  await ctx.answerCallbackQuery({ text: 'تأیید شد ✅' }).catch(() => undefined);
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch {
    /* ignore */
  }
  await ctx.reply(
    `✅ کاربر ${escapeHtml(user.name)} (#${user.id}) احراز شد.\n🎁 ${formatNum(FACE_VERIFY_REWARD)} سکه جایزه واریز شد.`,
    { parse_mode: 'HTML' }
  );

  if (user.telegramId) {
    try {
      await ctx.api.sendMessage(
        user.telegramId,
        [
          `${VERIFIED_BADGE}`,
          '',
          'تبریک! احراز چهره‌ات تأیید شد 🎉',
          'بج «احراز شده» الان روی پروفایلت نمایش داده می‌شه.',
          `🎁 ${formatNum(FACE_VERIFY_REWARD)} سکه به موجودی‌ات اضافه شد.`,
        ].join('\n')
      );
    } catch (err) {
      console.warn('notify approved user failed:', err);
    }
  }
}

export async function handleAdminRejectAsk(ctx: Context, userId: number): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const from = ctx.from;
  if (!from) return;

  await upsertSession(String(from.id), {
    step: 'admin_reject_reason',
    adminRejectUserId: userId,
  });
  await ctx.answerCallbackQuery().catch(() => undefined);
  await ctx.reply(
    `علت رد احراز کاربر #${userId} رو بنویس (یا بدون دلیل رد کن):`,
    { reply_markup: adminRejectSkipKeyboard() }
  );
}

export async function handleAdminRejectSkip(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const from = ctx.from;
  if (!from) return;
  const session = await getSession(String(from.id));
  const userId = session?.adminRejectUserId;
  if (!userId) {
    await ctx.reply('درخواستی برای رد انتخاب نشده.');
    return;
  }
  await finalizeReject(ctx, userId, undefined);
}

export async function handleAdminRejectReasonText(ctx: Context, text: string): Promise<boolean> {
  const from = ctx.from;
  if (!from || !(await isAdminAuthorized(ctx))) return false;
  const session = await getSession(String(from.id));
  if (!session || session.step !== 'admin_reject_reason' || !session.adminRejectUserId) {
    return false;
  }
  const note = text.trim().slice(0, 200);
  await finalizeReject(ctx, session.adminRejectUserId, note || undefined);
  return true;
}

async function finalizeReject(ctx: Context, userId: number, note?: string): Promise<void> {
  const from = ctx.from;
  let result: Awaited<ReturnType<typeof rejectVerification>>;
  try {
    result = await rejectVerification(userId, note);
  } catch (err) {
    console.error('rejectVerification failed:', err);
    await ctx.reply('خطا یا دیگر در صف نیست.');
    return;
  }

  if (from) {
    await upsertSession(String(from.id), {
      step: 'ready',
      adminRejectUserId: undefined,
    });
  }

  const user = result.user;
  await ctx.reply(
    `❌ کاربر ${escapeHtml(user.name)} (#${user.id}) رد شد.${note ? `\nدلیل: ${escapeHtml(note)}` : ''}`,
    { parse_mode: 'HTML' }
  );

  if (user.telegramId) {
    try {
      const lines = [
        '❌ درخواست احراز چهره‌ات رد شد.',
        '',
        note ? `دلیل: ${note}` : 'می‌تونی دوباره از پروفایل «🛡 احراز چهره» رو بزنی.',
        note ? 'از پروفایل دوباره «🛡 احراز چهره» رو بزن و سلفی واضح‌تری بفرست.' : '',
      ].filter(Boolean);
      await ctx.api.sendMessage(user.telegramId, lines.join('\n'));
    } catch (err) {
      console.warn('notify rejected user failed:', err);
    }
  }
}
