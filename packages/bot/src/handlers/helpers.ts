import type { Context } from 'grammy';
import { type Keyboard } from 'grammy';
import type { User } from '@petdate/shared';
import { BRAND } from '@petdate/shared';
import { getUserByTelegramId } from '../api-client';
import { mainMenuKeyboard } from '../keyboards';

export function displayName(from: {
  first_name: string;
  last_name?: string;
  username?: string;
}): string {
  const full = [from.first_name, from.last_name].filter(Boolean).join(' ');
  return full || from.username || `کاربر ${BRAND.name}`;
}

export async function getCtxUser(ctx: Context): Promise<User | null> {
  if (!ctx.from) return null;
  return getUserByTelegramId(String(ctx.from.id));
}

/** منوی اصلی با ردیف دسترسی (نقش‌ها / پنل ادمین) بر اساس دسترسی کاربر */
export function menuKeyboardFor(
  ctx: Context,
  user?: (Pick<User, 'role' | 'roles'> & { vetOnline?: boolean; readyToAdopt?: boolean }) | null
) {
  return mainMenuKeyboard(user?.role, user?.roles, ctx.from?.id, {
    vetOnline: user?.vetOnline,
    readyToAdopt: user?.readyToAdopt,
  });
}

/**
 * Carrier texts for sticky ReplyKeyboard push (send + delete).
 * Telegram rejects ZWNJ/ZWSP/NBSP as "text must be non-empty".
 * Prefer Word Joiner, then visible fallbacks. Sticky push is best-effort only —
 * always attach reply_markup on the real content message too (see sticky middleware).
 */
const KEYBOARD_CARRIERS = ['\u2060', '·', '.', '-'] as const;

type TelegramApiLike = {
  sendMessage: (
    chatId: string | number,
    text: string,
    other?: { reply_markup?: Keyboard }
  ) => Promise<{ message_id: number }>;
  deleteMessage: (chatId: string | number, messageId: number) => Promise<unknown>;
};

/**
 * اعمال ReplyKeyboard روی یک chatId بدون پیام ماندگار.
 * برای طرف مقابل (requester) که ctx.chat او نیست هم قابل استفاده است.
 * اگر همه carrierها fail شوند false برمی‌گردد — caller باید کیبورد را روی
 * پیام محتوا گذاشته باشد.
 */
export async function pushReplyKeyboardToChat(
  api: TelegramApiLike,
  chatId: string | number,
  keyboard: Keyboard
): Promise<boolean> {
  for (const carrier of KEYBOARD_CARRIERS) {
    try {
      const msg = await api.sendMessage(chatId, carrier, { reply_markup: keyboard });
      await api.deleteMessage(chatId, msg.message_id).catch(() => undefined);
      return true;
    } catch (err) {
      console.warn(
        'pushReplyKeyboardToChat carrier failed',
        JSON.stringify(carrier),
        (err as Error)?.message ?? err
      );
    }
  }
  return false;
}

/**
 * Best-effort sticky ReplyKeyboard (send carrier + delete).
 * Must not be the only place keyboard is applied — content messages should
 * also carry reply_markup so clients still show the menu if sticky fails or
 * if deleting the carrier drops the keyboard.
 */
export async function pushReplyKeyboard(ctx: Context, keyboard: Keyboard): Promise<boolean> {
  const chatId = ctx.chat?.id ?? ctx.from?.id;
  if (chatId == null) return false;
  const ok = await pushReplyKeyboardToChat(ctx.api, chatId, keyboard);
  if (!ok) console.warn('pushReplyKeyboard failed for all carriers', chatId);
  return ok;
}

/** متن محتوا با کیبورد روی همان پیام + sticky push اختیاری */
export async function replyThenPushKeyboard(
  ctx: Context,
  text: string,
  keyboard: Keyboard,
  extra?: Parameters<Context['reply']>[1]
): Promise<void> {
  const rest = (extra ?? {}) as Record<string, unknown>;
  await ctx.reply(text, { ...rest, reply_markup: keyboard } as Parameters<Context['reply']>[1]);
  // sticky middleware already re-pushes; keep explicit push for non-middleware paths
  await pushReplyKeyboard(ctx, keyboard);
}

/** فقط منوی اصلی را پایین بچسبان (جایگزین «منوی اصلی 👇») */
export async function pushMainMenuKeyboard(
  ctx: Context,
  user?: (Pick<User, 'role' | 'roles'> & { vetOnline?: boolean; readyToAdopt?: boolean }) | null
): Promise<void> {
  const keyboard = menuKeyboardFor(ctx, user);
  const ok = await pushReplyKeyboard(ctx, keyboard);
  if (ok) return;
  const chatId = ctx.chat?.id ?? ctx.from?.id;
  if (chatId == null) return;
  // Sticky carrier failed — keep a short visible message so the menu is never lost.
  try {
    await ctx.api.sendMessage(chatId, '⌨️ منوی اصلی', { reply_markup: keyboard });
  } catch (err) {
    console.warn('pushMainMenuKeyboard visible fallback failed', chatId, err);
  }
}
