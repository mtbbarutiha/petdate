import { InlineKeyboard, type Context } from 'grammy';
import {
  createSupportTicketAsTelegram,
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

/** لیلا کیانی — همان ایجنت پشتیبانی /api/support (kind: support) */
export const SUPPORT_AGENT_NAME = 'لیلا کیانی';

export const SUPPORT_MENU = {
  ticket: '🎫 ثبت تیکت',
  agent: '🤖 صحبت با بات پشتیبانی',
} as const;

export function supportChooserKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(SUPPORT_MENU.ticket, 'support:ticket')
    .row()
    .text(SUPPORT_MENU.agent, 'support:agent');
}

/** منوی پشتیبانی: ثبت تیکت یا چت با بات */
export async function handleSupportMenu(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن تا حسابت ساخته بشه.', {
      reply_markup: menuKeyboardFor(ctx, null),
    });
    return;
  }
  await upsertSession(String(from.id), {
    step: 'ready',
    supportTicketTitle: undefined,
  });
  await ctx.reply(
    [
      '🛟 <b>پشتیبانی پت‌دیت</b>',
      '',
      'یکی را انتخاب کن:',
      `• <b>ثبت تیکت</b> — درخواستت برای تیم انسانی ثبت می‌شود`,
      `• <b>صحبت با بات پشتیبانی</b> — گفتگو با ${SUPPORT_AGENT_NAME}`,
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: supportChooserKeyboard(),
    }
  );
  await ctx.reply('منوی اصلی هنوز اینجاست:', {
    reply_markup: menuKeyboardFor(ctx, user),
  }).catch(() => undefined);
}

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

  await upsertSession(telegramId, { step: 'support_chat', supportTicketTitle: undefined });

  let welcome =
    `👋 من ${SUPPORT_AGENT_NAME} هستم، پشتیبانی هوشمند پت‌دیت.\nدرباره ورود، پت، همبازی، مربی، دامپزشک، شاپ یا سکه بپرس.`;
  try {
    const hist = await getSupportMessagesAsTelegram(telegramId);
    if (hist.welcome) welcome = hist.welcome;
    else if (hist.messages.length > 0) {
      welcome =
        `🛟 ادامهٔ گفتگو با ${SUPPORT_AGENT_NAME}.\nسؤالت را بنویس؛ برای خروج از منو استفاده کن.`;
    }
  } catch (err) {
    console.warn('support welcome fetch failed:', (err as Error).message);
  }

  await ctx.reply(`${welcome}\n\n_${SUPPORT_EXIT_HINT}_`, {
    parse_mode: 'Markdown',
    reply_markup: menuKeyboardFor(ctx, user),
  });
}

export async function handleSupportTicketStart(ctx: Context): Promise<void> {
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
  await upsertSession(telegramId, { step: 'support_ticket_title', supportTicketTitle: undefined });
  await ctx.reply(
    [
      '🎫 <b>ثبت تیکت</b>',
      '',
      'موضوع تیکت را در یک خط بنویس (مثلاً «مشکل پرداخت»).',
      '',
      `_${SUPPORT_EXIT_HINT}_`,
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: menuKeyboardFor(ctx, user),
    }
  );
}

/**
 * پیام‌های چندنوبتی در حالت support_chat / تیکت.
 * دکمه‌های منو / انصراف → خروج و false تا سوئیچ منو کار کند.
 */
export async function handleSupportChatText(ctx: Context, text: string): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session) return false;

  if (
    MENU_LABELS.has(text) ||
    MAIN_MENU_ALIASES.has(text) ||
    text === MAIN_MENU_BTN ||
    text === WIZARD_NAV.cancel ||
    text === SUPPORT_MENU.ticket ||
    text === SUPPORT_MENU.agent
  ) {
    if (
      session.step === 'support_chat' ||
      session.step === 'support_ticket_title' ||
      session.step === 'support_ticket_body'
    ) {
      await upsertSession(telegramId, { step: 'ready', supportTicketTitle: undefined });
    }
    return false;
  }

  if (session.step === 'support_ticket_title') {
    const title = text.trim();
    const user = await getCtxUser(ctx);
    if (!title) {
      await ctx.reply('موضوع خالی نباشد — یک خط بنویس.', {
        reply_markup: menuKeyboardFor(ctx, user),
      });
      return true;
    }
    if (title.length > 200) {
      await ctx.reply('موضوع خیلی طولانی است — کوتاه‌تر بنویس.', {
        reply_markup: menuKeyboardFor(ctx, user),
      });
      return true;
    }
    await upsertSession(telegramId, { step: 'support_ticket_body', supportTicketTitle: title });
    await ctx.reply(
      [
        'شرح مشکل یا درخواستت را بنویس.',
        'اگر توضیح بیشتری نداری، همان موضوع را دوباره بفرست یا بنویس «—».',
      ].join('\n'),
      { reply_markup: menuKeyboardFor(ctx, user) }
    );
    return true;
  }

  if (session.step === 'support_ticket_body') {
    const user = await getCtxUser(ctx);
    const title = String(session.supportTicketTitle || '').trim();
    if (!title) {
      await upsertSession(telegramId, { step: 'support_ticket_title', supportTicketTitle: undefined });
      await ctx.reply('موضوع پیدا نشد — دوباره موضوع را بنویس.', {
        reply_markup: menuKeyboardFor(ctx, user),
      });
      return true;
    }
    let description = text.trim();
    if (description === '—' || description === '-') description = title;
    try {
      const res = await createSupportTicketAsTelegram(telegramId, { title, description });
      const code = res.ticket?.publicId || String(res.ticket?.id || '');
      await upsertSession(telegramId, { step: 'ready', supportTicketTitle: undefined });
      await ctx.reply(
        [
          '✅ تیکت ثبت شد.',
          code ? `کد پیگیری: <code>${code}</code>` : '',
          '',
          'تیم پشتیبانی پیگیری می‌کند. برای چت فوری با بات، دوباره «پشتیبانی» را بزن.',
        ]
          .filter(Boolean)
          .join('\n'),
        {
          parse_mode: 'HTML',
          reply_markup: menuKeyboardFor(ctx, user),
        }
      );
    } catch (err) {
      console.warn('support ticket create failed:', (err as Error).message);
      await ctx.reply('ثبت تیکت الان ممکن نشد. کمی بعد دوباره امتحان کن.', {
        reply_markup: menuKeyboardFor(ctx, user),
      });
    }
    return true;
  }

  if (session.step !== 'support_chat') return false;

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

/** Voice / audio in support_chat → API Whisper STT → same reply path. */
export async function handleSupportChatVoice(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session || session.step !== 'support_chat') return false;

  const voice = ctx.message?.voice;
  const audio = ctx.message?.audio;
  if (!voice && !audio) return false;

  const user = await getCtxUser(ctx);
  await ctx.replyWithChatAction('typing').catch(() => undefined);
  try {
    const res = await postSupportMessageAsTelegram(telegramId, '', {
      mediaKind: voice ? 'voice' : 'audio',
      telegramFileId: voice?.file_id || audio!.file_id,
      mimeType: voice?.mime_type || audio?.mime_type,
    });
    const reply = res.assistantMessage?.text?.trim() || 'پاسخی دریافت نشد. دوباره امتحان کن.';
    await ctx.reply(reply, { reply_markup: menuKeyboardFor(ctx, user) });
  } catch (err) {
    console.warn('support voice reply failed:', (err as Error).message);
    await ctx.reply(
      'ویس‌ات رسید، ولی الان تحلیل صوت ممکن نشد. لطفاً سؤالت را تایپ کن.',
      { reply_markup: menuKeyboardFor(ctx, user) }
    );
  }
  return true;
}
