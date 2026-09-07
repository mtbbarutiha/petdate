import type { Context } from 'grammy';
import { rankPlaymateMatches, PET_SPECIES_LABELS } from '@petdate/shared';
import {
  createPlaydate,
  getPet,
  listPets,
} from '../api-client';
import {
  explorePickMyPetKeyboard,
  myPetsActionKeyboard,
} from '../keyboards';
import { upsertSession } from '../session';
import { getCtxUser, menuKeyboardFor, pushMainMenuKeyboard } from './helpers';

const MAX_AUTO_REQUESTS = 30;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

    const text = [
      '🔍 <b>پیدا کردن همبازی</b>',
      '',
      'کدوم پتت رو انتخاب می‌کنی؟',
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

/** انتخاب پت → مچ اولویت‌دار → ارسال درخواست به همه هم‌گروه‌ها */
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

    // Immediate feedback so the button never looks hung while we match/send
    await editOrReply(ctx, `⏳ در حال پیدا کردن همبازی برای <b>${escapeHtml(source.name)}</b>…`, {
      parse_mode: 'HTML',
    });

    const peers = await listPets({ lookingForPlaymate: true, species: source.species });
    const matches = rankPlaymateMatches(source, peers, { max: MAX_AUTO_REQUESTS });
    const speciesLabel = PET_SPECIES_LABELS[source.species] ?? source.species;

    console.log(
      'find-playmate: matching for pet',
      source.id,
      source.name,
      'user',
      user.id,
      'candidates',
      matches.length
    );

    if (matches.length === 0) {
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

    let sent = 0;
    let skipped = 0;
    let sample: string | undefined;
    let preferredSample: string | undefined;

    for (const match of matches) {
      try {
        // API owns Telegram notify (async). Do not re-notify here.
        await createPlaydate({
          fromPetId: source.id,
          toPetId: match.pet.id,
          fromUserId: user.id,
          confirmResend: true,
        });
        sent += 1;
        const locReasons = match.reasons.filter(
          (r) => r === 'هم‌کشور' || r === 'هم‌استان' || r === 'هم‌شهر'
        );
        const why =
          locReasons.length > 0
            ? locReasons.join(' · ')
            : match.reasons.slice(0, 2).join(' · ');
        const line = `• <b>${escapeHtml(match.pet.name)}</b>${why ? ` — ${escapeHtml(why)}` : ''}`;
        if (!sample) sample = line;
        if (
          !preferredSample &&
          (match.reasons.includes('هم‌استان') || match.reasons.includes('هم‌کشور'))
        ) {
          preferredSample = line;
        }
      } catch {
        skipped += 1;
      }
    }

    const oneSample = preferredSample ?? sample;

    const summary = [
      sent > 0
        ? `✅ برای <b>${escapeHtml(source.name)}</b> درخواست همبازی ارسال شد.`
        : `⚠️ برای <b>${escapeHtml(source.name)}</b> الان درخواستی ارسال نشد.`,
      '',
      `هم‌گروه: ${escapeHtml(speciesLabel)}`,
      `ارسال‌شده: <b>${sent}</b> درخواست`,
      skipped ? `رد شده/تکراری: ${skipped}` : null,
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
