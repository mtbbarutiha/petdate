/**
 * کیبورد فیک تلگرام: ReplyKeyboard را روی پیام محتوا نگه می‌دارد (تا دکمه‌ها نپرند)
 * و در صورت امکان با send+delete پایین می‌چسباند تا روی اندروید وسط صفحه شناور نشود.
 *
 * قبلی: کیبورد از محتوا حذف می‌شد و فقط با carrier می‌رفت — اگر carrier/شبکه
 * شکست می‌خورد کاربر بدون هیچ دکمه‌ای می‌ماند.
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
    // Keep keyboard on the content message so buttons never vanish if sticky push fails.
    const msg = await orig(...args);
    if (kb) {
      await pushReplyKeyboard(ctx, kb).catch((err) => {
        console.warn('stickyReplyKeyboard push failed (content still has keyboard)', err);
      });
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
