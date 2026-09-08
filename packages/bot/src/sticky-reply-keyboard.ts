/**
 * کیبورد فیک تلگرام: اگر ReplyKeyboard فقط روی پیامِ حذف‌شده (sticky push)
 * ست شود، بعضی کلاینت‌ها کیبورد را هم با حذف پیام از دست می‌دهند.
 * این میدلور کیبورد را روی پیام محتوا نگه می‌دارد و سپس sticky push را
 * به‌صورت best-effort برای کاهش float اندروید اجرا می‌کند.
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

function wrapReplyMethod<A extends unknown[]>(
  ctx: Context,
  orig: (...args: A) => Promise<unknown>
): (...args: A) => Promise<unknown> {
  return async (...args: A) => {
    const last = args[args.length - 1];
    const kb = extractReplyKeyboard(last);
    // Always send content with reply_markup intact — source of truth for the menu.
    const msg = await orig(...args);
    if (kb) {
      // Best-effort re-stick at bottom (Android float mitigation). Failure must not
      // remove the keyboard already attached to the content message.
      await pushReplyKeyboard(ctx, kb).catch(() => undefined);
    }
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
