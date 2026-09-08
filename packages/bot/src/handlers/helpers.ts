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
 * Telegram rejects ZWNJ/ZWSP/NBSP as "text must be non-empty" — use Word Joiner
 * first (invisible), then visible fallbacks.
 */
const KEYBOARD_CARRIERS = ['\u2060', '·', '.'] as const;

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
 * اعمال ReplyKeyboard بدون پیام ماندگار در چت.
 *
 * روی بعضی کلاینت‌های تلگرام (به‌خصوص اندروید) اگر پیامِ حامل کیبورد
 * در تاریخچه بماند، هنگام اسکرول کیبورد «فیک» وسط صفحه شناور می‌شود.
 * با ارسال + حذف فوری، کیبورد پایینِ چت می‌ماند و با اسکرول جابه‌جا نمی‌شود.
 */
export async function pushReplyKeyboard(ctx: Context, keyboard: Keyboard): Promise<void> {
  const chatId = ctx.chat?.id ?? ctx.from?.id;
  if (chatId == null) return;
  const ok = await pushReplyKeyboardToChat(ctx.api, chatId, keyboard);
  if (!ok) console.warn('pushReplyKeyboard failed for all carriers', chatId);
}

/** متن محتوا + کیبورد پایین بدون پیام فیک اسکرولی */
export async function replyThenPushKeyboard(
  ctx: Context,
  text: string,
  keyboard: Keyboard,
  extra?: Parameters<Context['reply']>[1]
): Promise<void> {
  const { reply_markup: _ignored, ...rest } = (extra ?? {}) as Record<string, unknown> & {
    reply_markup?: unknown;
  };
  await ctx.reply(text, rest as Parameters<Context['reply']>[1]);
  await pushReplyKeyboard(ctx, keyboard);
}

/** فقط منوی اصلی را پایین بچسبان (جایگزین «منوی اصلی 👇») */
export async function pushMainMenuKeyboard(
  ctx: Context,
  user?: (Pick<User, 'role' | 'roles'> & { vetOnline?: boolean; readyToAdopt?: boolean }) | null
): Promise<void> {
  await pushReplyKeyboard(ctx, menuKeyboardFor(ctx, user));
}
