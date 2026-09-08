import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import type { User, VetConsultation } from '@petdate/shared';
import {
  MAX_VET_VISIT_FEE_COINS,
  MIN_VET_VISIT_FEE_COINS,
  normalizeVisitFeeCoins,
  toEnglishDigits,
  userHasRole,
  vetVisitFeeCoins,
} from '@petdate/shared';
import {
  createVetConsultation,
  getUserById,
  listVetConsultations,
  setVetOnline,
  setVetVisitFee,
  updateVetConsultationStatus,
} from '../api-client';
import { formatNum } from '../economy';
import { getSession, upsertSession } from '../session';
import { getCtxUser, menuKeyboardFor } from './helpers';
import { startVetChat } from './vet-chat';
import { WIZARD_NAV } from '../keyboards';

const RECENT_LIMIT = 5;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function patientLabel(c: VetConsultation): string {
  const name = c.patientName?.trim() || `بیمار #${c.patientUserId}`;
  const pet = c.petName?.trim();
  return pet ? `${name} · ${pet}` : name;
}

/** سوییچ آنلاین/آفلاین برای پذیرش بیمار */
export async function handleVetOnlineToggle(
  ctx: Context,
  online: boolean
): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  if (!userHasRole(user, 'vet')) {
    await ctx.reply('این بخش مخصوص دامپزشکان است.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }

  let updated: User;
  try {
    updated = await setVetOnline(String(from.id), online);
  } catch (err) {
    console.error('setVetOnline failed:', err);
    const msg = err instanceof Error ? err.message : String(err);
    if (online && (msg.includes('vet_disabled') || msg.includes('غیرفعال'))) {
      await ctx.reply(
        '⏸ حساب دامپزشکی‌ات توسط مدیر غیرفعال شده و فعلاً نمی‌تونی آنلاین بشی.\nبا پشتیبانی تماس بگیر.',
        { reply_markup: menuKeyboardFor(ctx, user) }
      );
      return;
    }
    await ctx.reply('تغییر وضعیت آنلاین ممکن نشد. کمی بعد دوباره امتحان کن.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }

  if (online) {
    await ctx.reply(
      [
        '🟢 <b>آنلاین شدی</b>',
        '',
        'الان در لیست دامپزشک‌های آماده پذیرش هستی.',
        'وقتی بیماری از «ارتباط سریع با پزشک» درخواست بده، بهت پیام می‌رسه.',
      ].join('\n'),
      {
        parse_mode: 'HTML',
        reply_markup: menuKeyboardFor(ctx, updated),
      }
    );
    return;
  }

  await ctx.reply(
    [
      '🔴 <b>آفلاین شدی</b>',
      '',
      'دیگر درخواست جدید اتصال سریع بهت نمی‌رسه.',
      'برای پذیرش دوباره، دکمه آنلاین را بزن.',
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: menuKeyboardFor(ctx, updated),
    }
  );
}

/** ۵ بیمار آخر — درخواست چت مجدد */
export async function handleVetRecentPatients(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  if (!userHasRole(user, 'vet')) {
    await ctx.reply('این بخش مخصوص دامپزشکان است.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }

  try {
    const consultations = await listVetConsultations(user.id);
    const byPatient = new Map<number, VetConsultation>();
    for (const c of consultations) {
      if (!byPatient.has(c.patientUserId)) byPatient.set(c.patientUserId, c);
    }
    const recent = [...byPatient.values()].slice(0, RECENT_LIMIT);

    if (!recent.length) {
      await ctx.reply(
        [
          '🩺 <b>آخرین بیمارها</b>',
          '',
          'هنوز بیماری ثبت نشده.',
          'بعد از چند مشاوره، ۵ بیمار آخر اینجا می‌آیند تا بتوانی دوباره درخواست چت بدهی.',
        ].join('\n'),
        {
          parse_mode: 'HTML',
          reply_markup: menuKeyboardFor(ctx, user),
        }
      );
      return;
    }

    const kb = new InlineKeyboard();
    for (const c of recent) {
      const label = patientLabel(c);
      kb.text(`💬 درخواست چت · ${label}`.slice(0, 64), `vet:rechat:${c.patientUserId}`).row();
    }

    await ctx.reply(
      [
        '🩺 <b>آخرین بیمارها</b>',
        '',
        `۵ بیمار اخیر (یا کمتر): <b>${recent.length}</b>`,
        'روی هر کدام بزن تا درخواست چت برایش ارسال شود.',
      ].join('\n'),
      {
        parse_mode: 'HTML',
        reply_markup: kb,
      }
    );
  } catch (err) {
    console.error('vet recent patients failed:', err);
    await ctx.reply('فعلاً لیست بیمارها در دسترس نیست. کمی بعد دوباره امتحان کن.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
  }
}

/** سازگاری با نام قدیمی */
export const handleVetPatients = handleVetRecentPatients;

const VISIT_FEE_PRESETS = [1, 5, 10, 20, 50, 100] as const;

function visitFeeKeyboard(current: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 0; i < VISIT_FEE_PRESETS.length; i += 1) {
    const fee = VISIT_FEE_PRESETS[i]!;
    const label = fee === current ? `✓ ${fee} سکه` : `${fee} سکه`;
    kb.text(label, `vet:fee:${fee}`);
    if (i % 3 === 2) kb.row();
  }
  if (VISIT_FEE_PRESETS.length % 3 !== 0) kb.row();
  kb.text('✏️ مبلغ دلخواه', 'vet:fee:custom').primary();
  return kb;
}

/** نمایش/تنظیم مبلغ ویزیت دامپزشک */
export async function handleVetVisitFeeMenu(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }
  if (!userHasRole(user, 'vet')) {
    await ctx.reply('این بخش مخصوص دامپزشکان است.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }

  const fee = vetVisitFeeCoins(user);
  await upsertSession(String(from.id), { step: 'ready' });
  await ctx.reply(
    [
      '💰 <b>مبلغ ویزیت</b>',
      '',
      `مبلغ فعلی: <b>${formatNum(fee)}</b> سکه`,
      '',
      'این مبلغ از بیمار هنگام درخواست مشاوره سریع کسر می‌شود.',
      `محدوده مجاز: ${formatNum(MIN_VET_VISIT_FEE_COINS)} تا ${formatNum(MAX_VET_VISIT_FEE_COINS)} سکه.`,
      '',
      'یک مبلغ آماده انتخاب کن یا «مبلغ دلخواه» را بزن.',
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: visitFeeKeyboard(fee),
    }
  );
}

export async function handleVetVisitFeePick(ctx: Context, feeCoins: number): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const user = await getCtxUser(ctx);
  if (!user || !userHasRole(user, 'vet')) {
    await ctx.answerCallbackQuery({ text: 'فقط دامپزشک', show_alert: true });
    return;
  }

  const fee = normalizeVisitFeeCoins(feeCoins);
  try {
    const updated = await setVetVisitFee(String(from.id), fee);
    await upsertSession(String(from.id), { step: 'ready' });
    await ctx.answerCallbackQuery({ text: `ثبت شد: ${fee} سکه` });
    await ctx.editMessageText(
      [
        '✅ <b>مبلغ ویزیت به‌روز شد</b>',
        '',
        `مبلغ جدید: <b>${formatNum(vetVisitFeeCoins(updated))}</b> سکه`,
        '',
        'از منو «💰 مبلغ ویزیت» هر وقت خواستی دوباره تغییر بده.',
      ].join('\n'),
      { parse_mode: 'HTML' }
    ).catch(async () => {
      await ctx.reply(
        `✅ مبلغ ویزیت روی <b>${formatNum(vetVisitFeeCoins(updated))}</b> سکه تنظیم شد.`,
        { parse_mode: 'HTML', reply_markup: menuKeyboardFor(ctx, updated) }
      );
    });
  } catch (err) {
    console.error('setVetVisitFee failed:', err);
    await ctx.answerCallbackQuery({ text: 'ثبت نشد', show_alert: true });
  }
}

export async function handleVetVisitFeeCustomPrompt(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const user = await getCtxUser(ctx);
  if (!user || !userHasRole(user, 'vet')) {
    await ctx.answerCallbackQuery({ text: 'فقط دامپزشک', show_alert: true });
    return;
  }

  await upsertSession(String(from.id), { step: 'vet_visit_fee' });
  await ctx.answerCallbackQuery();
  await ctx.reply(
    [
      '✏️ <b>مبلغ دلخواه ویزیت</b>',
      '',
      `یک عدد بین ${formatNum(MIN_VET_VISIT_FEE_COINS)} تا ${formatNum(MAX_VET_VISIT_FEE_COINS)} بفرست.`,
      'برای انصراف «❌ انصراف» را بزن.',
    ].join('\n'),
    { parse_mode: 'HTML' }
  );
}

export async function handleVetVisitFeeText(ctx: Context, text: string): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;

  const session = await getSession(String(from.id));
  if (!session || session.step !== 'vet_visit_fee') return false;

  const user = await getCtxUser(ctx);
  if (!user || !userHasRole(user, 'vet')) {
    await upsertSession(String(from.id), { step: 'ready' });
    return true;
  }

  if (text === WIZARD_NAV.cancel || text === WIZARD_NAV.back) {
    await upsertSession(String(from.id), { step: 'ready' });
    await ctx.reply('انصراف از تغییر مبلغ ویزیت.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return true;
  }

  const raw = toEnglishDigits(text).replace(/[^\d]/g, '');
  const fee = Number(raw);
  if (!Number.isFinite(fee) || fee < MIN_VET_VISIT_FEE_COINS || fee > MAX_VET_VISIT_FEE_COINS) {
    await ctx.reply(
      `عدد معتبر بفرست (${formatNum(MIN_VET_VISIT_FEE_COINS)} تا ${formatNum(MAX_VET_VISIT_FEE_COINS)}).`
    );
    return true;
  }

  try {
    const updated = await setVetVisitFee(String(from.id), fee);
    await upsertSession(String(from.id), { step: 'ready' });
    await ctx.reply(
      [
        '✅ <b>مبلغ ویزیت ثبت شد</b>',
        '',
        `مبلغ جدید: <b>${formatNum(vetVisitFeeCoins(updated))}</b> سکه`,
      ].join('\n'),
      { parse_mode: 'HTML', reply_markup: menuKeyboardFor(ctx, updated) }
    );
  } catch (err) {
    console.error('setVetVisitFee text failed:', err);
    await ctx.reply('ثبت مبلغ ممکن نشد. کمی بعد دوباره امتحان کن.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
  }
  return true;
}

/** دامپزشک از لیست آخرین بیمارها درخواست چت می‌دهد */
export async function handleVetRequestRechat(
  ctx: Context,
  patientUserId: number
): Promise<void> {
  const vet = await getCtxUser(ctx);
  if (!vet || !userHasRole(vet, 'vet')) {
    await ctx.answerCallbackQuery({ text: 'فقط دامپزشک', show_alert: true });
    return;
  }

  const patient = await getUserById(patientUserId);
  if (!patient?.telegramId) {
    await ctx.answerCallbackQuery({ text: 'بیمار پیدا نشد', show_alert: true });
    return;
  }

  let consult: VetConsultation;
  try {
    consult = await createVetConsultation({
      vetUserId: vet.id,
      patientUserId: patient.id,
      notes: 'درخواست چت از آخرین بیمارها',
    });
  } catch (err) {
    console.error('vet rechat create failed:', err);
    await ctx.answerCallbackQuery({ text: 'خطا در ایجاد درخواست', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: 'درخواست ارسال شد' });

  try {
    await ctx.api.sendMessage(
      patient.telegramId,
      [
        '📬 <b>درخواست چت از دامپزشک</b>',
        '',
        `دامپزشک <b>${escapeHtml(vet.name)}</b> می‌خواهد باهات صحبت کند.`,
        'اگر آماده‌ای قبول کن.',
      ].join('\n'),
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text('✅ قبول چت', `vet:invite:accept:${consult.id}`)
          .text('❌ رد', `vet:invite:reject:${consult.id}`),
      }
    );
  } catch (err) {
    console.warn('notify patient rechat failed:', err);
    await ctx.reply('ارسال به بیمار ناموفق بود (شاید ربات را بلاک کرده).');
    return;
  }

  await ctx.reply(
    `✅ درخواست چت برای <b>${escapeHtml(patient.name)}</b> ارسال شد.`,
    {
      parse_mode: 'HTML',
      reply_markup: menuKeyboardFor(ctx, vet),
    }
  );
}

/** بیمار دعوت چت دامپزشک را قبول/رد می‌کند */
export async function handlePatientChatInvite(
  ctx: Context,
  consultId: number,
  action: 'accept' | 'reject'
): Promise<void> {
  const patient = await getCtxUser(ctx);
  if (!patient) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }

  let updated: VetConsultation;
  try {
    updated = await updateVetConsultationStatus(
      consultId,
      action === 'accept' ? 'active' : 'cancelled'
    );
  } catch (err) {
    console.error('patient invite status failed:', err);
    await ctx.answerCallbackQuery({ text: 'خطا در به‌روزرسانی', show_alert: true });
    return;
  }

  if (updated.patientUserId !== patient.id) {
    await ctx.answerCallbackQuery({ text: 'این دعوت مال تو نیست', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({
    text: action === 'accept' ? 'قبول شد ✅' : 'رد شد',
  });

  const vet = await getUserById(updated.vetUserId);

  if (action === 'accept' && vet) {
    try {
      const prev =
        ctx.callbackQuery?.message && 'text' in ctx.callbackQuery.message
          ? String(ctx.callbackQuery.message.text)
          : '📬 درخواست چت';
      await ctx.editMessageText(`${prev}\n\n✅ قبول شد — چت در حال شروع…`);
    } catch {
      /* ignore */
    }
    await startVetChat(ctx, updated.id, vet, patient);
    return;
  }

  try {
    const prev =
      ctx.callbackQuery?.message && 'text' in ctx.callbackQuery.message
        ? String(ctx.callbackQuery.message.text)
        : '📬 درخواست چت';
    await ctx.editMessageText(
      `${prev}\n\n${action === 'accept' ? '✅ قبول شد.' : '❌ رد شد.'}`
    );
  } catch {
    await ctx.reply(action === 'accept' ? '✅ قبول شد.' : '❌ رد شد.');
  }

  if (vet?.telegramId) {
    try {
      await ctx.api.sendMessage(
        vet.telegramId,
        action === 'accept'
          ? `بیمار ${patient.name} دعوت چت را قبول کرد.`
          : `بیمار ${patient.name} دعوت چت را نپذیرفت.`
      );
    } catch {
      /* ignore */
    }
  }
}
