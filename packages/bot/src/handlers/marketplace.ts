import type { Context } from 'grammy';
import type { User, VetConsultation } from '@petdate/shared';
import {
  SEEKER_ADVICE_COST,
  SITTER_CONNECT_COST,
  TRAINER_CONSULT_COST,
  userHasRole,
} from '@petdate/shared';
import {
  getUserById,
  listVetConsultations,
  quickVetConnect,
  setAcceptSeekerAdvice,
  setProviderOnline,
  submitProviderCredential,
} from '../api-client';
import { getSession, upsertSession } from '../session';
import { getCtxUser, menuKeyboardFor } from './helpers';
import { startVetChat, enterAiConsultChatAsPatient } from './vet-chat';
import { SITTER_MENU, TRAINER_MENU, textStepKeyboard } from '../keyboards';

function patientLabel(c: VetConsultation): string {
  const name = c.patientName?.trim() || `کاربر #${c.patientUserId}`;
  const pet = c.petName?.trim();
  return pet ? `${name} · ${pet}` : name;
}

export async function handleProviderOnlineToggle(
  ctx: Context,
  kind: 'trainer' | 'sitter',
  online: boolean
): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }
  const role = kind === 'trainer' ? 'trainer' : 'pet_sitter';
  if (!userHasRole(user, role)) {
    await ctx.reply(
      kind === 'trainer' ? 'این بخش مخصوص مربی‌هاست.' : 'این بخش مخصوص پرستار پت است.',
      { reply_markup: menuKeyboardFor(ctx, user) }
    );
    return;
  }

  let updated: User;
  try {
    updated = await setProviderOnline(String(from.id), kind, online);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (online && (msg.includes('credential_required') || msg.includes('مدرک'))) {
      await ctx.reply(
        'اول مدرک را آپلود کن و منتظر تأیید ادمین بمان تا پنل فعال شود.',
        { reply_markup: menuKeyboardFor(ctx, user) }
      );
      return;
    }
    if (online && msg.includes('credential_pending')) {
      await ctx.reply('مدرکت هنوز در صف تأیید ادمین است.', {
        reply_markup: menuKeyboardFor(ctx, user),
      });
      return;
    }
    await ctx.reply('تغییر وضعیت آنلاین ممکن نشد. کمی بعد دوباره امتحان کن.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }

  const label = kind === 'trainer' ? 'مربی' : 'پرستار پت';
  if (online) {
    await ctx.reply(`🟢 آنلاین شدی — آماده پذیرش درخواست ${label}.`, {
      reply_markup: menuKeyboardFor(ctx, updated),
    });
  } else {
    await ctx.reply('🔴 آفلاین شدی.', {
      reply_markup: menuKeyboardFor(ctx, updated),
    });
  }
}

export async function handleProviderRecentClients(
  ctx: Context,
  kind: 'trainer' | 'sitter'
): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }
  const role = kind === 'trainer' ? 'trainer' : 'pet_sitter';
  if (!userHasRole(user, role)) {
    await ctx.reply('این بخش مخصوص نقش فعال تو نیست.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }
  let rows: VetConsultation[] = [];
  try {
    rows = await listVetConsultations({
      vetUserId: user.id,
      kind: kind === 'trainer' ? 'trainer' : 'sitter',
    });
  } catch (err) {
    console.error('list provider consults failed:', err);
  }
  const recent = rows.slice(0, 8);
  if (!recent.length) {
    await ctx.reply('هنوز درخواستی نداری.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }
  const lines = recent.map(
    (c, i) =>
      `${i + 1}. ${patientLabel(c)} — ${c.status === 'requested' ? 'در انتظار' : c.status === 'active' ? 'فعال' : c.status}`
  );
  await ctx.reply(
    [`📋 آخرین درخواست‌ها`, '', ...lines].join('\n'),
    { reply_markup: menuKeyboardFor(ctx, user) }
  );
}

export async function handleProviderCredentialStart(
  ctx: Context,
  kind: 'trainer' | 'sitter'
): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }
  await upsertSession(String(ctx.from!.id), {
    step: kind === 'trainer' ? 'trainer_credential' : 'sitter_credential',
  });
  await ctx.reply(
    kind === 'trainer'
      ? '📄 عکس یا فایل مدرک مربی‌گری را بفرست (ادمین بررسی می‌کند).'
      : '📄 عکس یا فایل مدرک پرستار پت را بفرست (ادمین بررسی می‌کند).',
    { reply_markup: textStepKeyboard({ noBack: true }) }
  );
}

export async function handleProviderCredentialPhoto(
  ctx: Context,
  kind: 'trainer' | 'sitter'
): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const session = await getSession(String(from.id));
  const expect =
    kind === 'trainer' ? 'trainer_credential' : 'sitter_credential';
  if (!session || session.step !== expect) return false;

  const fileId =
    ctx.message?.document?.file_id ||
    ctx.message?.photo?.[ctx.message.photo.length - 1]?.file_id;
  if (!fileId) {
    await ctx.reply('لطفاً عکس یا فایل مدرک را بفرست.');
    return true;
  }

  const user = await getCtxUser(ctx);
  if (!user) return true;
  try {
    await submitProviderCredential(String(from.id), kind, fileId);
    await upsertSession(String(from.id), { step: undefined });
    await ctx.reply(
      '✅ مدرک ارسال شد و در صف تأیید ادمین قرار گرفت. بعد از تأیید می‌توانی آنلاین شوی.',
      { reply_markup: menuKeyboardFor(ctx, user) }
    );
  } catch (err) {
    console.error('submit provider credential failed:', err);
    await ctx.reply('ارسال مدرک ناموفق بود. دوباره امتحان کن.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
  }
  return true;
}

async function runQuickConnect(
  ctx: Context,
  kind: 'trainer' | 'sitter' | 'seeker_advice',
  costHint: number
): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  let result;
  try {
    result = await quickVetConnect(user.id, { kind });
  } catch (err) {
    console.error('marketplace quick connect failed:', err);
    await ctx.reply('خطا در ارسال درخواست. کمی بعد دوباره امتحان کن.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }

  if (!result.ok) {
    if (result.requiresResendConfirm) {
      await ctx.reply(result.error || 'میخوای مجدد درخواست بدی؟', {
        reply_markup: menuKeyboardFor(ctx, user),
      });
      // Simple auto-confirm resend on second try via confirmResend
      const retry = await quickVetConnect(user.id, { kind, confirmResend: true });
      if (retry.ok) {
        await ctx.reply(retry.message, { reply_markup: menuKeyboardFor(ctx, user) });
        return;
      }
    }
    await ctx.reply(result.error || 'ارسال درخواست ممکن نشد.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }

  if (result.aiFallback) {
    const title =
      kind === 'trainer'
        ? '🎓 پاشا یزدانی — مربی آنلاین پت‌دیت'
        : '🤖 دستیار هوشمند پت‌دیت';
    await ctx.reply(
      [title, result.message, result.advice ? '\n' + result.advice.slice(0, 3500) : '']
        .filter(Boolean)
        .join('\n')
    );
    const consult = result.consultations?.[0];
    if (consult) {
      const ai = await getUserById(consult.vetUserId).catch(() => null);
      if (ai) {
        await enterAiConsultChatAsPatient(ctx, consult.id, ai, user, {
          openingAlreadySent: true,
        });
        return;
      }
    }
    await ctx.reply('می‌توانی در چت وب ادامه بدهی.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }
  await ctx.reply(
    result.message ||
      `درخواست ارسال شد. هزینه: ${costHint} سکه.`,
    { reply_markup: menuKeyboardFor(ctx, user) }
  );
}

export async function handleRequestTrainer(ctx: Context): Promise<void> {
  await ctx.reply(
    [
      '🎓 درخواست مربی',
      `هزینه اتصال انسانی: ${TRAINER_CONSULT_COST} سکه (۲۵ مربی + ۲۵ پلتفرم).`,
      'اگر مربی دیگری آنلاین نباشد، پاشا یزدانی (مربی آنلاین) رایگان پاسخ می‌دهد.',
    ].join('\n'),
    { reply_markup: menuKeyboardFor(ctx, await getCtxUser(ctx)) }
  );
  await runQuickConnect(ctx, 'trainer', TRAINER_CONSULT_COST);
}

export async function handleRequestSitter(ctx: Context): Promise<void> {
  await ctx.reply(
    [
      '🏠 درخواست پرستار پت',
      `هزینه اتصال: ${SITTER_CONNECT_COST} سکه (۱۰ پرستار + ۱۰ پلتفرم).`,
      '',
      '⚠️ پت‌دیت فقط شما را به پرستار متصل می‌کند و مسئولیتی فراتر از اتصال ندارد.',
    ].join('\n'),
    { reply_markup: menuKeyboardFor(ctx, await getCtxUser(ctx)) }
  );
  await runQuickConnect(ctx, 'sitter', SITTER_CONNECT_COST);
}

export async function handleRequestSeekerAdvice(ctx: Context): Promise<void> {
  await ctx.reply(
    `💬 مشورت خرید از صاحب پت\nهزینه: ${SEEKER_ADVICE_COST} سکه (۵ صاحب + ۵ پلتفرم). بدون اتصال پزشک.`,
    { reply_markup: menuKeyboardFor(ctx, await getCtxUser(ctx)) }
  );
  await runQuickConnect(ctx, 'seeker_advice', SEEKER_ADVICE_COST);
}

export async function handleToggleSeekerAdvice(ctx: Context, accept: boolean): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }
  if (!userHasRole(user, 'pet_owner')) {
    await ctx.reply('این تنظیم مخصوص صاحب پت است.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }
  try {
    const updated = await setAcceptSeekerAdvice(String(from.id), accept);
    await ctx.reply(
      accept
        ? '✅ از این به بعد اشخاص بدون پت می‌توانند برای مشورت خرید با تو چت کنند و سکه بگیری.'
        : '⏸ پذیرش مشورت خرید خاموش شد.',
      { reply_markup: menuKeyboardFor(ctx, updated) }
    );
  } catch (err) {
    console.error('setAcceptSeekerAdvice failed:', err);
    await ctx.reply('تغییر تنظیم ممکن نشد.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
  }
}

/** Open active marketplace consult chat for provider if pending request exists */
export async function tryOpenProviderPendingChat(
  ctx: Context,
  consultId: number,
  provider: User,
  patient: User
): Promise<void> {
  await startVetChat(ctx, consultId, provider, patient);
}

export const MARKETPLACE_MENU = {
  trainer: TRAINER_MENU,
  sitter: SITTER_MENU,
} as const;
