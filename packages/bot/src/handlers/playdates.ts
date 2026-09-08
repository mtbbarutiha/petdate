import type { Api, Context } from 'grammy';
import type { PetProfile } from '@petdate/shared';
import { isPendingRequestExpired, PLAYDATE_REQUEST_TTL_MS } from '@petdate/shared';
import {
  createPlaydate,
  deletePet,
  getPet,
  getPlaydate,
  getUserById,
  listPets,
  listPlaydates,
  updatePlaydateStatus,
} from '../api-client';
import { formatPet, formatPlaydate } from '../format';
import {
  confirmPetDeleteKeyboard,
  fromPetKeyboard,
  mainMenuKeyboard,
  myPetProfileKeyboard,
  myPetsListKeyboard,
  myPetsSectionKeyboard,
  playdateActionKeyboard,
  playdateResendConfirmKeyboard,
} from '../keyboards';
import { upsertSession } from '../session';
<<<<<<< HEAD
import { getCtxUser, menuKeyboardFor, pushMainMenuKeyboard } from './helpers';
=======
import { resolveTelegramPhotoUrl } from '../urls';
import { getCtxUser, menuKeyboardFor } from './helpers';
>>>>>>> be47c7b (fix(api,bot): send pet photo on playdate Telegram notify)
import { startOwnerChat } from './owner-chat';

export function defaultPetPhoto(pet: { species?: string; id: number }): string {
  const dogs = [
    'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=800&q=80',
  ];
  const cats = [
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
  ];
  const pool = pet.species === 'cat' ? cats : dogs;
  return pool[pet.id % pool.length]!;
}

function petPhotoForTelegram(pet: {
  species?: string;
  id: number;
  imageUrl?: string | null;
}): string {
  return resolveTelegramPhotoUrl(pet.imageUrl) || defaultPetPhoto(pet);
}

/** اطلاع درخواست همبازی به صاحب پت مقصد — با عکس پروفایل پت فرستنده */
export async function notifyIncomingPlaydateRequest(
  api: Api,
  toTelegramId: string,
  opts: {
    requestId: number;
    fromPet: Pick<PetProfile, 'id' | 'name' | 'species' | 'breed' | 'imageUrl' | 'city' | 'ownerCity' | 'ownerProvince' | 'ownerVerified'>;
    toPetName: string;
    speciesLabel?: string;
  }
): Promise<void> {
  const caption = [
    '📬 <b>درخواست همبازی جدید</b>',
    '',
    `از طرف <b>${escapeHtml(opts.fromPet.name)}</b> برای <b>${escapeHtml(opts.toPetName)}</b>`,
    opts.speciesLabel ? `دسته: ${escapeHtml(opts.speciesLabel)}` : null,
    '',
    formatPet(opts.fromPet as PetProfile, true),
  ]
    .filter((l) => l !== null)
    .join('\n')
    .slice(0, 1024);

  const photo = petPhotoForTelegram(opts.fromPet);
  const kb = playdateActionKeyboard(opts.requestId);

  try {
    await api.sendPhoto(toTelegramId, photo, {
      caption,
      parse_mode: 'HTML',
      reply_markup: kb,
    });
    return;
  } catch (err) {
    console.warn('playdate notify photo failed:', (err as Error).message);
  }

  await api.sendMessage(toTelegramId, caption, {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function handleMyPets(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  const pets = await listPets({ ownerId: user.id });
  if (pets.length === 0) {
    await ctx.reply('هنوز پتی ثبت نکردی. از دکمه زیر پت جدید اضافه کن:', {
      reply_markup: myPetsListKeyboard([]),
    });
    await ctx.reply('بخش پت‌های من 👇', { reply_markup: myPetsSectionKeyboard() });
    return;
  }

  await ctx.reply(`🐾 **پت‌های من** (${pets.length})\n\nروی هر پت بزن تا پروفایلش باز بشه:`, {
    parse_mode: 'Markdown',
    reply_markup: myPetsListKeyboard(pets),
  });
  await ctx.reply('بخش پت‌های من 👇', { reply_markup: myPetsSectionKeyboard() });
}

export async function handleMyPetView(ctx: Context, petId: number): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }

  const pet = await getPet(petId);
  if (!pet || pet.ownerId !== user.id) {
    await ctx.answerCallbackQuery({ text: 'پت پیدا نشد', show_alert: true });
    return;
  }

  try {
    await ctx.answerCallbackQuery();
  } catch {
    /* called from text/edit flows without callback */
  }
  const text = `🐾 <b>پروفایل پت</b>\n\n${formatPet(pet, true)}`;
  const kb = myPetProfileKeyboard(pet.id);
  const photo = petPhotoForTelegram(pet);

  try {
    await ctx.replyWithPhoto(photo, {
      caption: text,
      parse_mode: 'HTML',
      reply_markup: kb,
    });
    return;
  } catch (err) {
    console.warn('pet profile photo failed:', (err as Error).message);
  }

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

export async function handleMyPetDeleteAsk(ctx: Context, petId: number): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }

  const pet = await getPet(petId);
  if (!pet || pet.ownerId !== user.id) {
    await ctx.answerCallbackQuery({ text: 'پت پیدا نشد', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();
  const text = `⚠️ مطمئنی می‌خوای **${pet.name}** رو حذف کنی؟\nاین کار قابل برگشت نیست.`;
  const kb = confirmPetDeleteKeyboard(pet.id);

  try {
    if (ctx.callbackQuery?.message && 'text' in ctx.callbackQuery.message) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
      return;
    }
  } catch {
    /* fall through */
  }
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
}

export async function handleMyPetDeleteConfirm(ctx: Context, petId: number): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }

  const pet = await getPet(petId);
  if (!pet || pet.ownerId !== user.id) {
    await ctx.answerCallbackQuery({ text: 'پت پیدا نشد', show_alert: true });
    return;
  }

  try {
    await deletePet(petId, user.id);
  } catch (err) {
    console.error('deletePet failed:', err);
    await ctx.answerCallbackQuery({ text: 'حذف ناموفق بود', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: 'حذف شد' });
  const pets = await listPets({ ownerId: user.id });
  const text =
    pets.length === 0
      ? `✅ **${pet.name}** حذف شد.\n\nهنوز پتی نداری. از دکمه زیر ثبت کن:`
      : `✅ **${pet.name}** حذف شد.\n\n🐾 **پت‌های من** (${pets.length})`;

  try {
    if (ctx.callbackQuery?.message && 'text' in ctx.callbackQuery.message) {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: myPetsListKeyboard(pets),
      });
      await ctx.reply('بخش پت‌های من 👇', { reply_markup: myPetsSectionKeyboard() });
      return;
    }
  } catch {
    /* fall through */
  }
  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: myPetsListKeyboard(pets),
  });
  await ctx.reply('بخش پت‌های من 👇', { reply_markup: myPetsSectionKeyboard() });
}

export async function handleRequests(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  const requests = await listPlaydates({ userId: user.id });
  if (requests.length === 0) {
    await ctx.reply('📬 درخواستی نداری.\nاز «🔍 پیدا کردن همبازی» شروع کن!', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }

  for (const req of requests.slice(0, 5)) {
    const isIncoming = req.toUserId === user.id && req.status === 'pending';
    const text = formatPlaydate(req);
    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: isIncoming ? playdateActionKeyboard(req.id) : undefined,
    });
  }

  if (requests.length > 5) {
    await ctx.reply(`... و ${requests.length - 5} درخواست دیگر`);
  }
}

export async function handlePlaydateAsk(ctx: Context, toPetId: number): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id) return;

  const myPets = await listPets({ ownerId: user.id });
  if (myPets.length === 0) {
    await ctx.answerCallbackQuery({ text: 'اول یک پت ثبت کن', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();

  const session = await import('../session').then((m) => m.getSession(String(ctx.from!.id)));
  const preferredId = session?.exploreForPetId;
  if (preferredId && myPets.some((p) => p.id === preferredId)) {
    await sendPlaydateNow(ctx, preferredId, toPetId, user.id);
    return;
  }

  if (myPets.length === 1) {
    await sendPlaydateNow(ctx, myPets[0]!.id, toPetId, user.id);
    return;
  }

  await ctx.editMessageText('کدوم پتت رو می‌فرستی؟', {
    reply_markup: fromPetKeyboard(myPets, toPetId),
  });
}

export async function handlePlaydateFrom(ctx: Context, fromPetId: number, toPetId: number): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id) return;

  await ctx.answerCallbackQuery();
  await sendPlaydateNow(ctx, fromPetId, toPetId, user.id);
}

/** ارسال مستقیم درخواست همبازی — بدون نوشتن پیام برای صاحب پت */
async function sendPlaydateNow(
  ctx: Context,
  fromPetId: number,
  toPetId: number,
  fromUserId: number,
  opts?: { skipResendConfirm?: boolean }
): Promise<void> {
  // After a prior expired request, ask before sending again (unless already confirmed).
  if (!opts?.skipResendConfirm) {
    const prior = await listPlaydates({ userId: fromUserId, status: 'expired' }).catch(() => []);
    const hadExpired = prior.some((r) => r.fromPetId === fromPetId && r.toPetId === toPetId);
    if (hadExpired) {
      const toPet = await getPet(toPetId);
      const name = toPet?.name ?? 'اون شخص';
      const ask = `میخوای مجدد درخواست بدی به اون شخص؟\n\n🐾 ${name}`;
      if (ctx.callbackQuery) {
        try {
          await ctx.editMessageText(ask, {
            reply_markup: playdateResendConfirmKeyboard(fromPetId, toPetId),
          });
          return;
        } catch {
          /* fall through to reply */
        }
      }
      await ctx.reply(ask, {
        reply_markup: playdateResendConfirmKeyboard(fromPetId, toPetId),
      });
      return;
    }
  }

  const req = await createPlaydate({
    fromPetId,
    toPetId,
    fromUserId,
    // Local bot UI already confirmed when needed.
    confirmResend: true,
  });
  await upsertSession(String(ctx.from!.id), {
    step: 'ready',
    selectedPetId: undefined,
    selectedToPetId: undefined,
  });

  const fromPet = await getPet(fromPetId);
  const toPet = await getPet(toPetId);

  // اطلاع به صاحب پت مقصد — اگر API از قبل تلگرام زده، دوباره نفرست
  if (req.toUserId && fromPet && !req.telegramNotified) {
    const owner = await getUserById(req.toUserId);
    if (owner?.telegramId) {
      try {
        await notifyIncomingPlaydateRequest(ctx.api, owner.telegramId, {
          requestId: req.id,
          fromPet,
          toPetName: toPet?.name ?? 'پت',
        });
      } catch {
        /* کاربر بلاک کرده یا در دسترس نیست */
      }
    }
  }

  const done = '✅ درخواست همبازی ارسال شد!';
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(done);
    } catch {
      await ctx.reply(done);
    }
  } else {
    await ctx.reply(done);
  }

  const u = await getCtxUser(ctx);
  await ctx.reply('منتظر پاسخ بمون یا همبازی‌های دیگه رو ببین.', {
    reply_markup: menuKeyboardFor(ctx, u),
  });
}

/** تأیید ارسال مجدد بعد از انقضا */
export async function handlePlaydateResend(
  ctx: Context,
  fromPetId: number,
  toPetId: number
): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  await sendPlaydateNow(ctx, fromPetId, toPetId, user.id, { skipResendConfirm: true });
}

/** @deprecated kept for old inline buttons — sends without message */
export async function handlePlaydateSend(
  ctx: Context,
  fromPetId: number,
  toPetId: number,
  _message?: string
): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id) return;
  await ctx.answerCallbackQuery();
  await sendPlaydateNow(ctx, fromPetId, toPetId, user.id);
}

export async function handlePlaydateAction(
  ctx: Context,
  requestId: number,
  action: 'accept' | 'reject'
): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }

  const { getPlaydate } = await import('../api-client');
  const existing = await getPlaydate(requestId);
  if (!existing) {
    await ctx.answerCallbackQuery({ text: 'درخواست پیدا نشد', show_alert: true });
    return;
  }
  if (existing.toUserId !== user.id) {
    await ctx.answerCallbackQuery({ text: 'این درخواست مال تو نیست', show_alert: true });
    return;
  }

  const stale =
    existing.status === 'expired' ||
    (existing.status === 'pending' &&
      isPendingRequestExpired(existing.createdAt, PLAYDATE_REQUEST_TTL_MS));

  if (stale) {
    await ctx.answerCallbackQuery({ text: 'این درخواست منقضی شده', show_alert: true });
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
    } catch {
      /* ignore */
    }
    try {
      await ctx.reply(
        [
          '⏱ این درخواست همبازی منقضی شده (بیش از ۲ دقیقه).',
          '',
          formatPlaydate({ ...existing, status: 'expired' }),
          '',
          'اگر می‌خوای دوباره درخواست بدی، از پیدا کردن همبازی اقدام کن.',
        ].join('\n'),
        { parse_mode: 'Markdown' }
      );
    } catch {
      /* ignore */
    }
    // Soft-expire on API if still pending
    if (existing.status === 'pending') {
      try {
        await updatePlaydateStatus(requestId, 'expired', user.id);
      } catch {
        /* ignore */
      }
    }
    return;
  }

  if (existing.status !== 'pending') {
    await ctx.answerCallbackQuery({ text: 'قبلاً پاسخ داده شده', show_alert: true });
    return;
  }

  const status = action === 'accept' ? 'accepted' : 'rejected';
  await ctx.answerCallbackQuery({ text: action === 'accept' ? 'پذیرفته شد ✅' : 'رد شد' });
  const updated = await updatePlaydateStatus(requestId, status, user.id);
  if (!updated) {
    await ctx.reply('به‌روزرسانی درخواست ناموفق بود.');
    return;
  }

  try {
    await ctx.editMessageText(
      `${formatPlaydate(updated)}\n\n${action === 'accept' ? '✅ توافق شد!' : '❌ رد شد.'}`,
      { parse_mode: 'Markdown' }
    );
  } catch {
    /* message may already be edited */
  }

  const requester = await getUserById(updated.fromUserId);

  if (action === 'reject') {
    if (requester?.telegramId) {
      try {
        await ctx.api.sendMessage(
          requester.telegramId,
          ['❌ درخواست همبازی رد شد.', '', formatPlaydate(updated)].join('\n'),
          { parse_mode: 'Markdown' }
        );
      } catch {
        /* ignore */
      }
    }
    return;
  }

  if (!requester) {
    await ctx.reply('صاحب پت مبدأ پیدا نشد؛ چت باز نشد.');
    return;
  }

  await startOwnerChat(ctx, updated.id, user, requester, {
    fromPetName: updated.fromPet?.name,
    toPetName: updated.toPet?.name,
    fromPetId: updated.fromPetId,
    toPetId: updated.toPetId,
  });
}

export async function handlePlaydateCancel(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await upsertSession(String(ctx.from!.id), { step: 'ready', selectedPetId: undefined, selectedToPetId: undefined });
  await ctx.editMessageText('انصراف دادی.');
  const u = await getCtxUser(ctx);
  await pushMainMenuKeyboard(ctx, u);
}
