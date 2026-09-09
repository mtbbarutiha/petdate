import type { Context } from 'grammy';
import {
  getSupportMessagesAsTelegram,
  postSupportMessageAsTelegram,
} from '../api-client';
import {
  MAIN_MENU_ALIASES,
  MAIN_MENU_BTN,
  MENU_LABELS,
  WIZARD_NAV,
} from '../keyboards';
import { getSession, upsertSession } from '../session';
import { getCtxUser, menuKeyboardFor } from './helpers';

const SUPPORT_EXIT_HINT =
  'برای خروج از پشتیبانی «📋 منو» یا هر دکمه منو را بزن — یا /cancel.';

/** شروع چت پشتیبانی هوشمند (همان API وب /api/support) */
export async function handleSupportChat(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const telegramId = String(from.id);
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن تا حسابت ساخته بشه.', {
      reply_markup: menuKeyboardFor(ctx, null),
    });
    return;
  }

  await upsertSession(telegramId, { step: 'support_chat' });

  let welcome =
    '👋 من پشتیبانی هوشمند پت‌دیت هستم.\nدرباره ورود، پت، همبازی، مربی، دامپزشک، شاپ یا سکه بپرس.';
  try {
    const hist = await getSupportMessagesAsTelegram(telegramId);
    if (hist.welcome) welcome = hist.welcome;
    else if (hist.messages.length > 0) {
      welcome =
        '🛟 ادامهٔ گفتگو با پشتیبانی هوشمند.\nسؤالت را بنویس؛ برای خروج از منو استفاده کن.';
    }
  } catch (err) {
    console.warn('support welcome fetch failed:', (err as Error).message);
  }

  await ctx.reply(`${welcome}\n\n_${SUPPORT_EXIT_HINT}_`, {
    parse_mode: 'Markdown',
    reply_markup: menuKeyboardFor(ctx, user),
  });
}

/**
 * پیام‌های چندنوبتی در حالت support_chat.
 * دکمه‌های منو / انصراف → خروج و false تا سوئیچ منو کار کند.
 */
export async function handleSupportChatText(ctx: Context, text: string): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session || session.step !== 'support_chat') return false;

  if (
    MENU_LABELS.has(text) ||
    MAIN_MENU_ALIASES.has(text) ||
    text === MAIN_MENU_BTN ||
    text === WIZARD_NAV.cancel
  ) {
    await upsertSession(telegramId, { step: 'ready' });
    return false;
  }

  const user = await getCtxUser(ctx);
  const body = text.trim();
  if (!body) {
    await ctx.reply('متن خالی ارسال نکن؛ سؤالت را بنویس.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return true;
  }

  await ctx.replyWithChatAction('typing').catch(() => undefined);
  try {
    const res = await postSupportMessageAsTelegram(telegramId, body);
    const reply = res.assistantMessage?.text?.trim() || 'پاسخی دریافت نشد. دوباره امتحان کن.';
    await ctx.reply(reply, { reply_markup: menuKeyboardFor(ctx, user) });
  } catch (err) {
    console.warn('support chat reply failed:', (err as Error).message);
    await ctx.reply('پاسخ پشتیبانی الان ممکن نشد. کمی بعد دوباره بفرست.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
  }
  return true;
}
