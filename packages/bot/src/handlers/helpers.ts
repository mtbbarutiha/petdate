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
  user?: (Pick<User, 'role' | 'roles'> & {
    vetOnline?: boolean;
    readyToAdopt?: boolean;
    trainerOnline?: boolean;
    sitterOnline?: boolean;
    acceptSeekerAdvice?: boolean;
  }) | null
) {
  return mainMenuKeyboard(user?.role, user?.roles, ctx.from?.id, {
    vetOnline: user?.vetOnline,
    readyToAdopt: user?.readyToAdopt,
    trainerOnline: user?.trainerOnline,
    sitterOnline: user?.sitterOnline,
    acceptSeekerAdvice: user?.acceptSeekerAdvice,
  });
}

/**
 * Visible carriers only — NEVER send+delete.
 * Deleting a message that set ReplyKeyboard clears the menu on many Telegram clients
 * (even when an earlier content message also had reply_markup).
 */
const KEYBOARD_VISIBLE_CARRIERS = ['⌨️', '⌨️ منوی اصلی', '·'] as const;

type TelegramApiLike = {
  sendMessage: (
    chatId: string | number,
    text: string,
    other?: { reply_markup?: Keyboard }
  ) => Promise<{ message_id: number }>;
  deleteMessage: (chatId: string | number, messageId: number) => Promise<unknown>;
};

/**
 * Apply ReplyKeyboard on chatId with a short visible message that is NOT deleted.
 * Prefer attaching reply_markup on real content instead; use this when there is
 * no content message (edit-only flows, force-restore, peer notify).
 */
export async function pushReplyKeyboardToChat(
  api: TelegramApiLike,
  chatId: string | number,
  keyboard: Keyboard
): Promise<boolean> {
  for (const carrier of KEYBOARD_VISIBLE_CARRIERS) {
    try {
      await api.sendMessage(chatId, carrier, { reply_markup: keyboard });
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
 * Apply ReplyKeyboard with a short visible (non-deleted) message.
 */
export async function pushReplyKeyboard(ctx: Context, keyboard: Keyboard): Promise<boolean> {
  const chatId = ctx.chat?.id ?? ctx.from?.id;
  if (chatId == null) return false;
  const ok = await pushReplyKeyboardToChat(ctx.api, chatId, keyboard);
  if (!ok) console.warn('pushReplyKeyboard failed for all carriers', chatId);
  return ok;
}

/** متن محتوا با کیبورد روی همان پیام — بدون sticky delete */
export async function replyThenPushKeyboard(
  ctx: Context,
  text: string,
  keyboard: Keyboard,
  extra?: Parameters<Context['reply']>[1]
): Promise<void> {
  const rest = (extra ?? {}) as Record<string, unknown>;
  await ctx.reply(text, { ...rest, reply_markup: keyboard } as Parameters<Context['reply']>[1]);
}

/** فقط منوی اصلی را با پیام کوتاه ماندگار نشان بده */
export async function pushMainMenuKeyboard(
  ctx: Context,
  user?: (Pick<User, 'role' | 'roles'> & { vetOnline?: boolean; readyToAdopt?: boolean }) | null
): Promise<void> {
  const keyboard = menuKeyboardFor(ctx, user);
  const chatId = ctx.chat?.id ?? ctx.from?.id;
  if (chatId == null) return;
  try {
    await ctx.api.sendMessage(chatId, '⌨️ منوی اصلی', { reply_markup: keyboard });
  } catch (err) {
    console.warn('pushMainMenuKeyboard failed', chatId, err);
    await pushReplyKeyboard(ctx, keyboard);
  }
}
