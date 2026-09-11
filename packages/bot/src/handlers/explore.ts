import type { Context } from 'grammy';
import { PET_SPECIES_LABELS, PLAYDATE_REQUEST_COST, toPersianDigits } from '@petdate/shared';
import {
  findPlaymates,
  getPet,
  listPets,
} from '../api-client';
import {
  explorePickMyPetKeyboard,
  myPetsActionKeyboard,
} from '../keyboards';
import { upsertSession } from '../session';
import { getCtxUser, menuKeyboardFor, pushMainMenuKeyboard } from './helpers';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatCoins(n: number): string {
  return toPersianDigits(String(n));
}

function parseApiErrorBody(err: unknown): {
  message: string;
  reason?: string;
  balance?: number;
  cost?: number;
} {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const jsonStart = raw.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const json = JSON.parse(raw.slice(jsonStart)) as {
        error?: string;
        reason?: string;
        balance?: number;
        cost?: number;
      };
      return {
        message: json.error || raw,
        reason: json.reason,
        balance: json.balance,
        cost: json.cost,
      };
    } catch {
      /* fall through */
    }
  }
  return { message: raw || 'خطای ناشناخته' };
}

async function safeReply(
  ctx: Context,
  text: string,
  extra?: Parameters<Context['reply']>[1]
): Promise<void> {
  try {
    await ctx.reply(text, extra);
  } catch (err) {
    console.warn('explore reply failed:', (err as Error).message);
    try {
      await ctx.reply(text.replace(/<[^>]+>/g, ''));
    } catch (err2) {
      console.warn('explore plain reply failed:', (err2 as Error).message);
    }
  }
}

async function editOrReply(
  ctx: Context,
  text: string,
  extra?: Parameters<Context['reply']>[1]
): Promise<void> {
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, extra as never);
      return;
    } catch {
      /* fall through */
    }
  }
  await safeReply(ctx, text, extra);
}

/** ورود از منو: فقط لیست پت‌های خود کاربر */
export async function handleFindPlaymate(ctx: Context): Promise<void> {
  console.log('find-playmate: menu pressed by', ctx.from?.id);
  await handleExplorePickPet(ctx);
}

export async function handleExplorePickPet(ctx: Context): Promise<void> {
  try {
    const user = await getCtxUser(ctx);
    if (!user?.id) {
      await safeReply(ctx, 'اول /start بزن.');
      return;
    }

    const profileOk = Boolean(
      user.name &&
        user.age &&
        user.gender &&
        user.country &&
        user.city &&
        (user.country !== 'ایران' || user.province)
    );
    if (!profileOk) {
      await safeReply(
        ctx,
        [
          '⚠️ پروفایلت هنوز کامل نیست.',
          'برای پیدا کردن همبازی اول نام، سن، جنسیت و شهر رو تکمیل کن.',
          '',
          'از منو «👤 پروفایل خودم» رو بزن.',
        ].join('\n'),
        { reply_markup: menuKeyboardFor(ctx, user) }
      );
      return;
    }

    const myPets = await listPets({ ownerId: user.id });
    if (myPets.length === 0) {
      await safeReply(ctx, 'اول باید حداقل یک پت ثبت کنی تا برات همبازی پیدا کنیم.', {
        reply_markup: myPetsActionKeyboard(),
      });
      await pushMainMenuKeyboard(ctx, user);
      return;
    }

    await upsertSession(String(ctx.from!.id), {
      step: 'ready',
      exploreForPicked: false,
      exploreForPetId: undefined,
      explorePage: 0,
    });

    const balance = user.coins ?? user.wallet?.coins ?? 0;
    const text = [
      '🔍 <b>پیدا کردن همبازی</b>',
      '',
      'کدوم پتت رو انتخاب می‌کنی؟',
      '',
      `💰 هزینه درخواست: <b>${formatCoins(PLAYDATE_REQUEST_COST)}</b> سکه`,
      `موجودی: <b>${formatCoins(balance)}</b> سکه`,
      '',
      'با انتخاب پت، درخواست همبازی به‌صورت خودکار برای هم‌گروه‌ها ارسال می‌شه',
      '(اولویت: هم‌کشور ← هم‌استان ← هم‌دسته ← هم‌نژاد ← سن ← جنسیت متفاوت).',
    ].join('\n');
    const kb = explorePickMyPetKeyboard(myPets);

    if (ctx.callbackQuery) {
      try {
        await ctx.answerCallbackQuery();
      } catch {
        /* ignore */
      }
    }
    await editOrReply(ctx, text, { parse_mode: 'HTML', reply_markup: kb });
  } catch (err) {
    console.error('handleExplorePickPet failed:', err);
    if (ctx.callbackQuery) {
      try {
        await ctx.answerCallbackQuery({ text: 'خطا — دوباره امتحان کن', show_alert: true });
      } catch {
        /* ignore */
      }
    }
    await safeReply(
      ctx,
      'الان پیدا کردن همبازی در دسترس نیست. چند لحظه بعد دوباره امتحان کن یا /menu بزن.'
    );
  }
}

/** انتخاب پت → مچ اولویت‌دار → ارسال درخواست (۲ سکه یک‌بار) */
export async function handleExploreForPet(ctx: Context, petId: number | 'all'): Promise<void> {
  try {
    const user = await getCtxUser(ctx);
    if (!user?.id) {
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
        } catch {
          /* ignore */
        }
      }
      await safeReply(ctx, 'اول /start بزن.');
      return;
    }

    if (petId === 'all') {
      try {
        await ctx.answerCallbackQuery({ text: 'یک پت مشخص انتخاب کن', show_alert: true });
      } catch {
        /* ignore */
      }
      await handleExplorePickPet(ctx);
      return;
    }

    const myPets = await listPets({ ownerId: user.id });
    const source = myPets.find((p) => p.id === petId);
    if (!source) {
      try {
        await ctx.answerCallbackQuery({ text: 'این پت مال تو نیست', show_alert: true });
      } catch {
        /* ignore */
      }
      return;
    }

    const balance = user.coins ?? user.wallet?.coins ?? 0;
    if (balance < PLAYDATE_REQUEST_COST) {
      const msg = [
        `برای درخواست همبازی حداقل ${formatCoins(PLAYDATE_REQUEST_COST)} سکه لازم داری.`,
        `موجودی: ${formatCoins(balance)} — از منو «🪙 سکه» بگیر.`,
      ].join('\n');
      try {
        await ctx.answerCallbackQuery({ text: 'سکه کافی نیست', show_alert: true });
      } catch {
        /* ignore */
      }
      await editOrReply(ctx, msg, {
        reply_markup: explorePickMyPetKeyboard(myPets),
      });
      return;
    }

    try {
      await ctx.answerCallbackQuery({ text: 'در حال پیدا کردن همبازی…' });
    } catch {
      /* ignore */
    }

    await upsertSession(String(ctx.from!.id), {
      exploreForPicked: true,
      exploreForPetId: petId,
      explorePage: 0,
    });

    await editOrReply(
      ctx,
      [
        `⏳ در حال پیدا کردن همبازی برای <b>${escapeHtml(source.name)}</b>…`,
        '',
        `💰 هزینه: ${formatCoins(PLAYDATE_REQUEST_COST)} سکه`,
      ].join('\n'),
      { parse_mode: 'HTML' }
    );

    let result;
    try {
      result = await findPlaymates({
        fromPetId: source.id,
        fromUserId: user.id,
      });
    } catch (err) {
      const parsed = parseApiErrorBody(err);
      if (parsed.reason === 'insufficient_coins') {
        const bal = parsed.balance ?? balance;
        const cost = parsed.cost ?? PLAYDATE_REQUEST_COST;
        await editOrReply(
          ctx,
          [
            parsed.message,
            '',
            `موجودی: ${formatCoins(bal)} — حداقل ${formatCoins(cost)} سکه لازم است.`,
            'از منو «🪙 سکه» بگیر.',
          ].join('\n'),
          { reply_markup: explorePickMyPetKeyboard(myPets) }
        );
        return;
      }
      throw err;
    }

    const speciesLabel =
      result.speciesLabel || PET_SPECIES_LABELS[source.species] || source.species;
    const oneSample = result.sampleLine
      ? result.sampleLine.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      : undefined;

    console.log(
      'find-playmate: matching for pet',
      source.id,
      source.name,
      'user',
      user.id,
      'sent',
      result.sent,
      'cost',
      result.cost
    );

    if (result.sent === 0) {
      const empty = [
        `برای <b>${escapeHtml(source.name)}</b> فعلاً همبازی هم‌گروه (${escapeHtml(speciesLabel)}) پیدا نشد.`,
        '',
        'بعداً دوباره امتحان کن.',
      ].join('\n');
      await editOrReply(ctx, empty, {
        parse_mode: 'HTML',
        reply_markup: explorePickMyPetKeyboard(myPets),
      });
      return;
    }

    const summary = [
      `✅ برای <b>${escapeHtml(source.name)}</b> درخواست همبازی ارسال شد.`,
      '',
      `هم‌گروه: ${escapeHtml(speciesLabel)}`,
      `ارسال‌شده: <b>${formatCoins(result.sent)}</b> درخواست`,
      result.skipped ? `رد شده/تکراری: ${formatCoins(result.skipped)}` : null,
      `💰 کسر شده: <b>${formatCoins(result.cost)}</b> سکه`,
      `موجودی باقی‌مانده: <b>${formatCoins(result.coins)}</b>`,
      '',
      'اولویت مچ: هم‌کشور · هم‌استان · هم‌دسته · هم‌نژاد · سن · جنسیت متفاوت',
      '',
      oneSample ? 'نمونه:' : null,
      oneSample ?? null,
    ]
      .filter(Boolean)
      .join('\n');

    await editOrReply(ctx, summary, { parse_mode: 'HTML' });
    await pushMainMenuKeyboard(ctx, user);
  } catch (err) {
    console.error('handleExploreForPet failed:', err);
    if (ctx.callbackQuery) {
      try {
        await ctx.answerCallbackQuery({ text: 'خطا — دوباره امتحان کن', show_alert: true });
      } catch {
        /* ignore */
      }
    }
    await safeReply(
      ctx,
      'ارسال درخواست همبازی ناموفق بود. چند لحظه بعد دوباره «🔍 پیدا کردن همبازی» رو بزن.'
    );
  }
}

/** سازگاری با callbackهای قدیمی صفحه‌بندی — برمی‌گرداند به انتخاب پت */
export async function handleExplore(ctx: Context, _page = 0): Promise<void> {
  await handleExplorePickPet(ctx);
}

export async function handleExplorePet(ctx: Context, _petId: number): Promise<void> {
  try {
    await ctx.answerCallbackQuery({ text: 'از لیست پت خودت یکی انتخاب کن' });
  } catch {
    /* ignore */
  }
  await handleExplorePickPet(ctx);
}

export async function handleExploreBack(ctx: Context): Promise<void> {
  await handleExplorePickPet(ctx);
}

export { getPet };
