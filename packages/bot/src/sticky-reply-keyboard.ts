/**
 * کیبورد فیک تلگرام: اگر ReplyKeyboard روی پیامِ ماندگار در تاریخچه باشد،
 * روی بعضی کلاینت‌ها (اندروید) هنگام اسکرول وسط صفحه شناور می‌ماند.
 * این میدلور کیبورد را از پیام محتوا جدا می‌کند و با send+delete پایین می‌چسباند.
 */
import type { Context, MiddlewareFn } from 'grammy';
import type { Keyboard } from 'grammy';
import { pushReplyKeyboard } from './handlers/helpers';

function extractReplyKeyboard(other: unknown): Keyboard | null {
  if (!other || typeof other !== 'object') return null;
  const rm = (other as { reply_markup?: unknown }).reply_markup;
  if (!rm || typeof rm !== 'object') return null;
  const obj = rm as Record<string, unknown>;
  if ('inline_keyboard' in obj) return null;
  if ('remove_keyboard' in obj) return null;
  if ('force_reply' in obj) return null;
  if ('keyboard' in obj) return rm as Keyboard;
  return null;
}

function stripKeyboard<T>(other: T): T {
  if (!other || typeof other !== 'object') return other;
  const copy = { ...(other as Record<string, unknown>) };
  delete copy.reply_markup;
  return copy as T;
}

function wrapReplyMethod<A extends unknown[]>(
  ctx: Context,
  orig: (...args: A) => Promise<unknown>
): (...args: A) => Promise<unknown> {
  return async (...args: A) => {
    const last = args[args.length - 1];
    const kb = extractReplyKeyboard(last);
    if (!kb) return orig(...args);
    const strippedArgs = [...args.slice(0, -1), stripKeyboard(last)] as A;
    const msg = await orig(...strippedArgs);
    await pushReplyKeyboard(ctx, kb);
    return msg;
  };
}

export function stickyReplyKeyboardMiddleware(): MiddlewareFn<Context> {
  return async (ctx, next) => {
    ctx.reply = wrapReplyMethod(ctx, ctx.reply.bind(ctx)) as typeof ctx.reply;

    const photo = ctx.replyWithPhoto?.bind(ctx);
    if (photo) ctx.replyWithPhoto = wrapReplyMethod(ctx, photo) as typeof ctx.replyWithPhoto;

    const video = ctx.replyWithVideo?.bind(ctx);
    if (video) ctx.replyWithVideo = wrapReplyMethod(ctx, video) as typeof ctx.replyWithVideo;

    const animation = ctx.replyWithAnimation?.bind(ctx);
    if (animation) {
      ctx.replyWithAnimation = wrapReplyMethod(ctx, animation) as typeof ctx.replyWithAnimation;
    }

    const document = ctx.replyWithDocument?.bind(ctx);
    if (document) {
      ctx.replyWithDocument = wrapReplyMethod(ctx, document) as typeof ctx.replyWithDocument;
    }

    await next();
  };
}
