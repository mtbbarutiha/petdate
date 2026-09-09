import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import type { User } from '@petdate/shared';
import {
  inviteTelegramLink,
  inviteTelegramShareUrl,
  isPendingRequestExpired,
  VET_CONSULT_REQUEST_TTL_MS,
  vetVisitFeeCoins,
} from '@petdate/shared';
import {
  getUserById,
  getVetConsultation,
  listOnlineVets,
  listPets,
  quickVetConnect,
  updateVetConsultationStatus,
} from '../api-client';
import { QUICK_VET_COST, REFERRAL_BONUS_COINS, formatNum } from '../economy';
import { myPetsActionKeyboard } from '../keyboards';
import { effectiveWebUrl, isTelegramInlineUrl } from '../urls';
import { getCtxUser, menuKeyboardFor, pushMainMenuKeyboard } from './helpers';
import { startVetChat } from './vet-chat';
import { handleAddPetCommand } from './wizard';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** هزینه اتصال سریع = max(حداقل سیستم، مبلغ ویزیت پزشک‌های آنلاین) */
function quickConnectCostForVets(vets: User[]): number {
  if (!vets.length) return QUICK_VET_COST;
  return Math.max(QUICK_VET_COST, ...vets.map((v) => vetVisitFeeCoins(v)));
}

/**
 * بیمار بدون پت نمی‌تواند درخواست ارتباط با پزشک بدهد.
 * در صورت نبود پت، راهنمایی و هدایت به ثبت پت.
 */
async function ensurePatientHasPetForVet(
  ctx: Context,
  user: User
): Promise<boolean> {
  let pets;
  try {
    pets = await listPets({ ownerId: user.id });
  } catch (err) {
    console.error('listPets for vet connect failed:', err);
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: 'خطا در دریافت پت‌ها', show_alert: true });
    } else {
      await ctx.reply('خطا در دریافت لیست پت‌ها. کمی بعد دوباره امتحان کن.', {
        reply_markup: menuKeyboardFor(ctx, user),
      });
    }
    return false;
  }

  if (pets.length > 0) return true;

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: 'اول باید پت ثبت کنی',
      show_alert: true,
    });
  }

  await ctx.reply(
    [
      '🐾 هنوز پتی ثبت نکردی.',
      '',
      'برای درخواست ارتباط با پزشک، اول باید حداقل یک پت ثبت کنی.',
      'از دکمه زیر وارد ثبت پت شو:',
    ].join('\n'),
    { reply_markup: myPetsActionKeyboard() }
  );
  await pushMainMenuKeyboard(ctx, user);
  await handleAddPetCommand(ctx);
  return false;
}

export async function handleCoins(ctx: Context): Promise<void> {
  const { handleCoins: coinsHandler } = await import('./coins');
  return coinsHandler(ctx);
}

export async function handleMedical(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  await ctx.reply(
    [
      '🩺 **پزشکی پت**',
      '',
      'خدمات پزشکی:',
      '• پرونده سلامت پت',
      '• یادآور واکسیناسیون',
      '• نزدیک‌ترین کلینیک‌ها',
      '• مشاوره آنلاین',
      '',
      'یکی رو انتخاب کن:',
    ].join('\n'),
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('📋 پرونده سلامت', 'medical:record')
        .primary()
        .row()
        .text('💉 یادآور واکسن', 'medical:vaccine')
        .primary()
        .row()
        .text('🏥 کلینیک‌های نزدیک', 'medical:clinics')
        .primary()
        .row()
        .text('💬 مشاوره آنلاین', 'medical:consult')
        .success(),
    }
  );
  await pushMainMenuKeyboard(ctx, user);
}

export async function handleChatsEntry(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  const webBase = effectiveWebUrl().replace(/\/$/, '');
  const chatsUrl = `${webBase}/chats`;
  const vetUrl = `${webBase}/vet-consult`;
  const lines = [
    '💬 <b>چت و گفتگوها</b>',
    '',
    'گفتگوهای همبازی و مشاوره دامپزشک در وب هم در دسترس‌اند.',
    'اگر چت فعالی در ربات داری، پیام‌ها همین‌جا رد و بدل می‌شوند.',
  ];
  const kb = new InlineKeyboard();
  if (isTelegramInlineUrl(chatsUrl)) {
    kb.url('💬 گفتگوهای وب', chatsUrl).row();
  }
  if (isTelegramInlineUrl(vetUrl)) {
    kb.url('🩺 مشاوره سریع', vetUrl).row();
  }
  await ctx.reply(lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
  await pushMainMenuKeyboard(ctx, user);
}

/**
 * متن دعوت دوستان — HTML (نه Markdown legacy).
 * لینک `ref_<id>` زیرخط دارد؛ Markdown تلگرام `_` را italic می‌گیرد و sendMessage 400 می‌دهد.
 */
export function buildInviteFriendsHtml(userId: number): {
  text: string;
  parse_mode: 'HTML';
  shareUrl: string;
  link: string;
} {
  const link = inviteTelegramLink(userId);
  const rewardFa = escapeHtml(formatNum(REFERRAL_BONUS_COINS));
  const text = [
    '🎁 <b>دعوت دوستان</b>',
    '',
    'دوستات رو به petdate دعوت کن و سکه بگیر!',
    '',
    'لینک دعوت تو:',
    `<code>${escapeHtml(link)}</code>`,
    '',
    `به ازای هر دوست که ثبت‌نام کنه، <b>${rewardFa} سکه</b> هدیه می‌گیری.`,
  ].join('\n');
  return {
    text,
    parse_mode: 'HTML',
    shareUrl: inviteTelegramShareUrl(userId),
    link,
  };
}

export async function handleInviteFriends(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  const invite = buildInviteFriendsHtml(user.id);
  const kb = new InlineKeyboard().url('📤 اشتراک‌گذاری لینک', invite.shareUrl);

  try {
    await ctx.reply(invite.text, {
      parse_mode: invite.parse_mode,
      reply_markup: kb,
    });
  } catch (err) {
    // Fallback بدون parse_mode — لینک ref_ نباید دوباره پیام را بشکند
    console.error('handleInviteFriends HTML send failed:', err);
    await ctx.reply(
      [
        '🎁 دعوت دوستان',
        '',
        'دوستات رو به petdate دعوت کن و سکه بگیر!',
        '',
        'لینک دعوت تو:',
        invite.link,
        '',
        `به ازای هر دوست که ثبت‌نام کنه، ${formatNum(REFERRAL_BONUS_COINS)} سکه هدیه می‌گیری.`,
      ].join('\n'),
      { reply_markup: kb }
    );
  }
  await pushMainMenuKeyboard(ctx, user);
}

export async function handleQuickVet(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }
  if (!(await ensurePatientHasPetForVet(ctx, user))) return;

  let vets: User[] = [];
  try {
    vets = (await listOnlineVets()).filter((v) => v.id !== user.id);
  } catch (err) {
    console.error('listOnlineVets failed:', err);
    await ctx.reply('خطا در دریافت لیست پزشک‌های آنلاین. کمی بعد دوباره امتحان کن.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }

  const balance = user.coins ?? 0;
  if (!vets.length) {
    // Start free AI consult instead of hard-stopping.
    const result = await quickVetConnect(user.id, {});
    if (result.ok && result.aiFallback) {
      await ctx.reply(
        [
          '🤖 <b>دستیار هوشمند پت‌دیت</b>',
          '',
          'دامپزشک انسانی آنلاین نبود — چت هوشمند رایگان شروع شد.',
          '',
          result.message,
          result.advice ? '\n' + result.advice.slice(0, 3500) : '',
          '',
          'می‌توانی در چت وب یا ربات ادامه بدهی.',
        ]
          .filter(Boolean)
          .join('\n'),
        { parse_mode: 'HTML', reply_markup: menuKeyboardFor(ctx, user) }
      );
      return;
    }
    await ctx.reply(
      [
        '⚡ <b>مشاوره سریع با پزشک</b>',
        '',
        result.ok === false ? result.error : 'الان دامپزشک آنلاین نیست و دستیار هوشمند هم در دسترس نبود.',
        '',
        `موجودی تو: <b>${formatNum(balance)}</b> سکه`,
      ].join('\n'),
      { parse_mode: 'HTML', reply_markup: menuKeyboardFor(ctx, user) }
    );
    return;
  }

  const cost = quickConnectCostForVets(vets);
  const listLines = vets.map((vet, index) => {
    const fee = vetVisitFeeCoins(vet);
    const city = vet.city?.trim() ? ` · ${escapeHtml(vet.city.trim())}` : '';
    return `${index + 1}. <b>${escapeHtml(vet.name)}</b>${city} — <b>${formatNum(fee)}</b> سکه`;
  });

  await ctx.reply(
    [
      '⚡ <b>مشاوره سریع با پزشک</b>',
      '',
      `پزشک‌های آنلاین آماده پذیرش (<b>${formatNum(vets.length)}</b>):`,
      ...listLines,
      '',
      `هزینه اتصال: <b>${formatNum(cost)}</b> سکه`,
      `موجودی تو: <b>${formatNum(balance)}</b> سکه`,
      '',
      balance < cost
        ? 'موجودی کافی نیست — اول از منو «🪙 سکه» بگیر.'
        : 'با زدن دکمه زیر، سکه کسر می‌شود و درخواست برای همین پزشک‌های آنلاین ارسال می‌شود.',
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup:
        balance < cost
          ? undefined
          : new InlineKeyboard()
              .text('🩺 تأیید پرداخت و اتصال', 'vet:connect')
              .success(),
    }
  );
  await pushMainMenuKeyboard(ctx, user);
}

/** اتصال فوری: کسر سکه و ارسال درخواست به همه دامپزشک‌های واجد شرایط */
/** اتصال مجدد به دامپزشک قبلی — فعلاً همان مسیر اتصال سریع */
export async function handleQuickVetReconnect(ctx: Context, _vetUserId: number): Promise<void> {
  await handleQuickVetConnect(ctx);
}

export async function handleQuickVetConnect(
  ctx: Context,
  opts?: { confirmResend?: boolean }
): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }

  if (!(await ensurePatientHasPetForVet(ctx, user))) return;

  let onlineVets: User[] = [];
  try {
    onlineVets = (await listOnlineVets()).filter((v) => v.id !== user.id);
  } catch (err) {
    console.error('listOnlineVets before connect failed:', err);
  }
  const estimatedCost = quickConnectCostForVets(onlineVets);
  const balance = user.coins ?? 0;
  if (onlineVets.length && balance < estimatedCost) {
    await ctx.answerCallbackQuery({
      text: `سکه کافی نیست (موجودی: ${balance})`,
      show_alert: true,
    });
    await ctx.reply(
      `برای اتصال سریع حداقل ${formatNum(estimatedCost)} سکه لازم داری.\nموجودی: ${formatNum(balance)} — از منو «🪙 سکه» بگیر.`,
      { reply_markup: menuKeyboardFor(ctx, user) }
    );
    return;
  }

  let result;
  try {
    result = await quickVetConnect(user.id, {
      confirmResend: Boolean(opts?.confirmResend),
    });
  } catch (err) {
    console.error('quickVetConnect failed:', err);
    await ctx.answerCallbackQuery({ text: 'خطا در اتصال', show_alert: true });
    await ctx.reply('ارسال درخواست ناموفق بود. کمی بعد دوباره امتحان کن.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }

  if (!result.ok) {
    if (result.requiresResendConfirm) {
      await ctx.answerCallbackQuery({ text: 'تأیید ارسال مجدد', show_alert: true });
      await ctx.reply('میخوای مجدد درخواست بدی به اون شخص؟', {
        reply_markup: new InlineKeyboard()
          .text('✅ بله، دوباره بفرست', 'vet:connect:resend')
          .success()
          .row()
          .text('❌ نه', 'vet:connect:cancel')
          .danger(),
      });
      return;
    }

    const alert =
      result.reason === 'insufficient_coins'
        ? `سکه کافی نیست (موجودی: ${result.balance ?? balance})`
        : result.reason === 'no_online_vets'
          ? 'پزشک آنلاینی نیست'
          : result.reason === 'already_pending'
            ? 'درخواست قبلی هنوز باز است'
            : result.reason === 'no_pet'
              ? 'اول باید پت ثبت کنی'
              : 'خطا در ارسال';

    await ctx.answerCallbackQuery({ text: alert.slice(0, 180), show_alert: true });
    await ctx.reply(
      [
        result.error,
        result.reason === 'insufficient_coins'
          ? `موجودی: ${formatNum(result.balance ?? balance)} — از منو «🪙 سکه» بگیر.`
          : null,
        result.refunded ? 'سکه‌ات برگشت داده شد.' : null,
      ]
        .filter(Boolean)
        .join('\n'),
      { reply_markup: menuKeyboardFor(ctx, user) }
    );
    return;
  }

  await ctx.answerCallbackQuery({
    text: result.aiFallback ? 'دستیار هوشمند شروع شد' : 'درخواست ارسال شد',
  });
  if (result.aiFallback) {
    await ctx.reply(
      [
        '🤖 <b>دستیار هوشمند پت‌دیت</b>',
        '',
        result.message,
        result.advice ? '\n' + result.advice.slice(0, 3500) : '',
        '',
        'می‌توانی سؤال بعدی را در چت بفرستی.',
      ]
        .filter(Boolean)
        .join('\n'),
      { parse_mode: 'HTML', reply_markup: menuKeyboardFor(ctx, user) }
    );
    return;
  }
  await ctx.reply(
    [
      '✅ درخواستت برای پزشک‌های آنلاین ارسال شد.',
      '',
      '⏳ در انتظار پذیرش دامپزشک',
      '',
      `پزشک‌های هدف: ${formatNum(result.sent)}`,
      `سکه کسر شده: ${formatNum(result.cost)}`,
      `موجودی باقی‌مانده: ${formatNum(result.coins)}`,
      '',
      'تا وقتی یکی از دامپزشک‌ها قبول نکند، چت باز نمی‌شود.',
      'بعد از قبول، همین‌جا در ربات (یا وب) چت فعال می‌شود.',
    ].join('\n'),
    { reply_markup: menuKeyboardFor(ctx, user) }
  );
}

/** قبول / رد درخواست مشاوره توسط دامپزشک */
export async function handleVetConsultDecision(
  ctx: Context,
  consultId: number,
  action: 'accept' | 'reject'
): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const vet = await getCtxUser(ctx);
  if (!vet) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }

  const existing = await getVetConsultation(consultId).catch(() => null);
  if (existing) {
    const stale =
      existing.status === 'expired' ||
      (existing.status === 'requested' &&
        isPendingRequestExpired(existing.createdAt, VET_CONSULT_REQUEST_TTL_MS));
    if (stale) {
      await ctx.answerCallbackQuery({ text: 'این درخواست منقضی شده', show_alert: true });
      if (existing.status === 'requested') {
        try {
          await updateVetConsultationStatus(consultId, 'expired');
        } catch {
          /* ignore */
        }
      }
      try {
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
      } catch {
        /* ignore */
      }
      try {
        await ctx.reply(
          '⏱ این درخواست مشاوره منقضی شده (بیش از ۲ دقیقه).\nاگر بیمار دوباره درخواست بدهد، اطلاع می‌گیری.'
        );
      } catch {
        /* ignore */
      }
      return;
    }
  }

  let updated;
  try {
    updated = await updateVetConsultationStatus(
      consultId,
      action === 'accept' ? 'active' : 'cancelled'
    );
  } catch (err) {
    console.error('consult status update failed:', err);
    await ctx.answerCallbackQuery({ text: 'خطا در به‌روزرسانی', show_alert: true });
    return;
  }

  if (updated.vetUserId !== vet.id) {
    await ctx.answerCallbackQuery({ text: 'این درخواست مال تو نیست', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({
    text: action === 'accept' ? 'قبول شد ✅' : 'رد شد',
  });

  if (action === 'accept') {
    const patient = await getUserById(updated.patientUserId);
    if (patient) {
      try {
        const prev =
          ctx.callbackQuery?.message && 'text' in ctx.callbackQuery.message
            ? String(ctx.callbackQuery.message.text)
            : '📬 درخواست مشاوره';
        await ctx.editMessageText(`${prev}\n\n✅ قبول شد — چت در حال شروع…`);
      } catch {
        /* ignore */
      }
      await startVetChat(ctx, updated.id, vet, patient);
      return;
    }
  }

  const statusLine =
    action === 'accept'
      ? '✅ درخواست را قبول کردی.'
      : '❌ درخواست رد شد.';

  try {
    const prev =
      ctx.callbackQuery?.message && 'text' in ctx.callbackQuery.message
        ? String(ctx.callbackQuery.message.text)
        : '📬 درخواست مشاوره';
    await ctx.editMessageText(`${prev}\n\n${statusLine}`);
  } catch {
    await ctx.reply(statusLine);
  }

  try {
    const patient = await getUserById(updated.patientUserId);
    if (patient?.telegramId) {
      await ctx.api.sendMessage(
        patient.telegramId,
        [
          'دامپزشک این درخواست را نپذیرفت.',
          'می‌تونی دوباره از «ارتباط سریع با پزشک» درخواست بدی.',
        ].join('\n')
      );
    }
  } catch (err) {
    console.warn('notify patient of consult decision failed:', err);
  }
}

export async function handleServices(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  await ctx.reply(
    [
      '🛠 **خدمات petdate**',
      '',
      '• 🎓 مربی‌گری و آموزش',
      '• ✂️ آرایش و grooming',
      '• 🚗 حمل‌ونقل پت',
      '• 📸 عکاسی پت',
      '',
      '_رزرو خدمات به‌زودی فعال می‌شه._',
    ].join('\n'),
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('🎓 مربی', 'svc:trainer')
        .primary()
        .row()
        .text('✂️ آرایش', 'svc:groom')
        .primary()
        .text('🚗 حمل', 'svc:transport')
        .primary(),
    }
  );
  await pushMainMenuKeyboard(ctx, user);
}

export async function handleComingSoon(ctx: Context, feature: string): Promise<void> {
  await ctx.answerCallbackQuery({ text: `${feature} به‌زودی فعال می‌شه 🐾`, show_alert: true });
}
