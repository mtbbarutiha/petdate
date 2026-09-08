/**
 * ReplyKeyboard safety middleware.
 *
 * History: an older version stripped reply_markup from content and applied it via
 * send+delete ("sticky"). Deleting that carrier clears the ReplyKeyboard on many
 * Telegram clients — so the main menu vanished after every reply.
 *
 * Current policy: leave reply_markup on content messages untouched. Do NOT
 * send+delete a keyboard carrier afterward (that undoes the content keyboard).
 * This middleware stays registered as a no-op passthrough so older deploy notes
 * and imports keep working.
 */
import type { Context, MiddlewareFn } from 'grammy';

export function stickyReplyKeyboardMiddleware(): MiddlewareFn<Context> {
  return async (_ctx, next) => {
    await next();
  };
}
