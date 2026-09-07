import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import type { User } from '@petdate/shared';
import { userHasRole, vetVisitFeeCoins } from '@petdate/shared';
import { listOnlineVets, quickVetConnect, setReadyToAdopt } from '../api-client';
import { QUICK_VET_COST, formatNum } from '../economy';
import { getCtxUser, menuKeyboardFor, pushMainMenuKeyboard } from './helpers';
import { handleSearchPetsMenu } from './search';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function quickConnectCostForVets(vets: User[]): number {
  if (!vets.length) return QUICK_VET_COST;
  return Math.max(QUICK_VET_COST, ...vets.map((v) => vetVisitFeeCoins(v)));
}

/** نقش دنبال پت — مرور پت‌ها و همبازی‌ها */
export async function handlePetsAndPlaymates(ctx: Context): Promise<void> {
  await handleSearchPetsMenu(ctx);
}

/** سوییچ آماده پذیرش پت */
export async function handleReadyToAdoptToggle(ctx: Context, ready: boolean): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.telegramId) {
    await ctx.reply('اول /start بزن.');
    return;
  }
  if (!userHasRole(user, 'pet_seeker')) {
    await ctx.reply('این دکمه مخصوص نقش «دنبال پت» است.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }

  let updated: User;
  try {
    updated = await setReadyToAdopt(user.telegramId, ready);
  } catch (err) {
    console.error('setReadyToAdopt failed:', err);
    await ctx.reply('ثبت وضعیت ناموفق بود. کمی بعد دوباره امتحان کن.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }

  await ctx.reply(
    ready
      ? [
          '💚 <b>آماده پذیرش پت هستی</b>',
          '',
          'وضعیتت برای پیدا کردن پت مناسب فعال شد.',
          'از «🐾 پت‌ها و همبازی» پت‌ها رو ببین.',
        ].join('\n')
      : [
          '⏸ <b>فعلاً آماده پذیرش نیستی</b>',
          '',
          'هر وقت خواستی دوباره دکمه سبز را بزن.',
        ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: menuKeyboardFor(ctx, updated),
    }
  );
}

/**
 * نقش بدون پت — مشاوره برای خرید پت
 * (بدون الزام ثبت پت؛ همان اتصال سریع با intent خرید)
 */
export async function handleBuyPetConsult(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  let vets: User[] = [];
  try {
    vets = (await listOnlineVets()).filter((v) => v.id !== user.id);
  } catch (err) {
    console.error('listOnlineVets for buy consult failed:', err);
    await ctx.reply('خطا در دریافت لیست پزشک‌های آنلاین. کمی بعد دوباره امتحان کن.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }

  const balance = user.coins ?? 0;
  if (!vets.length) {
    await ctx.reply(
      [
        '🛒 <b>مشاوره برای خرید پت</b>',
        '',
        'الان هیچ دامپزشک آنلاینی آماده مشاوره نیست.',
        'کمی بعد دوباره امتحان کن.',
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
      '🛒 <b>مشاوره برای خرید پت</b>',
      '',
      'از دامپزشک آنلاین بپرس چه پتی برات مناسبه، هزینه نگهداری، نژاد و مراقبت.',
      '',
      `پزشک‌های آنلاین (<b>${formatNum(vets.length)}</b>):`,
      ...listLines,
      '',
      `هزینه اتصال: <b>${formatNum(cost)}</b> سکه`,
      `موجودی تو: <b>${formatNum(balance)}</b> سکه`,
      '',
      balance < cost
        ? 'موجودی کافی نیست — اول از منو «🪙 سکه» بگیر.'
        : 'برای شروع مشاوره دکمه زیر را بزن:',
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup:
        balance < cost
          ? menuKeyboardFor(ctx, user)
          : new InlineKeyboard()
              .text('🛒 شروع مشاوره خرید', 'vet:buyconsult:connect')
              .success()
              .row()
              .text('❌ انصراف', 'vet:connect:cancel')
              .danger(),
    }
  );
  if (balance >= cost) {
    await pushMainMenuKeyboard(ctx, user);
  }
}

export async function handleBuyPetConsultConnect(
  ctx: Context,
  opts?: { confirmResend?: boolean }
): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }

  let onlineVets: User[] = [];
  try {
    onlineVets = (await listOnlineVets()).filter((v) => v.id !== user.id);
  } catch (err) {
    console.error('listOnlineVets before buy consult failed:', err);
  }
  const estimatedCost = quickConnectCostForVets(onlineVets);
  const balance = user.coins ?? 0;
  if (balance < estimatedCost) {
    await ctx.answerCallbackQuery({
      text: `سکه کافی نیست (موجودی: ${balance})`,
      show_alert: true,
    });
    await ctx.reply(
      `برای مشاوره خرید حداقل ${formatNum(estimatedCost)} سکه لازم داری.\nموجودی: ${formatNum(balance)} — از منو «🪙 سکه» بگیر.`,
      { reply_markup: menuKeyboardFor(ctx, user) }
    );
    return;
  }

  let result;
  try {
    result = await quickVetConnect(user.id, {
      confirmResend: Boolean(opts?.confirmResend),
      purchaseAdvice: true,
    });
  } catch (err) {
    console.error('buy consult connect failed:', err);
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
          .text('✅ بله، دوباره بفرست', 'vet:buyconsult:resend')
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
            : 'خطا در ارسال';

    await ctx.answerCallbackQuery({ text: alert.slice(0, 180), show_alert: true });
    await ctx.reply(result.error || alert, {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }

  await ctx.answerCallbackQuery({ text: 'درخواست ارسال شد ✅' });
  await ctx.reply(
    [
      '🛒 <b>درخواست مشاوره خرید ارسال شد</b>',
      '',
      result.message,
      '',
      `سکه باقی‌مانده: <b>${formatNum(result.coins)}</b>`,
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: menuKeyboardFor(ctx, user),
    }
  );
}
