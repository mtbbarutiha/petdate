import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import {
  botHelpTopicButtons,
  formatBotHelpOverview,
  formatBotHelpTopic,
  helpAudienceForUser,
} from '@petdate/shared';
import { getCtxUser } from './helpers';

export const HELP_TOPIC_CB = /^help:t:([a-z0-9]+)$/;
export const HELP_HOME_CB = 'help:home';

function helpInlineKeyboard(audience: ReturnType<typeof helpAudienceForUser>): InlineKeyboard {
  const kb = new InlineKeyboard();
  const buttons = botHelpTopicButtons(audience);
  buttons.forEach((btn, i) => {
    kb.text(btn.label, `help:t:${btn.id}`);
    if (i % 2 === 1) kb.row();
  });
  if (buttons.length % 2 === 1) kb.row();
  kb.text('📋 نمای کلی راهنما', HELP_HOME_CB);
  return kb;
}

async function sendOrEditHelp(
  ctx: Context,
  text: string,
  audience: ReturnType<typeof helpAudienceForUser>
): Promise<void> {
  const extra = {
    parse_mode: 'HTML' as const,
    reply_markup: helpInlineKeyboard(audience),
  };
  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, extra);
      return;
    } catch {
      /* identical text or uneditable — fall through to reply */
    }
  }
  await ctx.reply(text, extra);
}

/** Role-aware /help — overview + topic buttons (what → how → tips). */
export async function handleHelp(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  const audience = helpAudienceForUser(user);
  const text = formatBotHelpOverview(audience);
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => undefined);
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: helpInlineKeyboard(audience),
      });
      return;
    } catch {
      /* reply below */
    }
  }
  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: helpInlineKeyboard(audience),
  });
}

export async function handleHelpTopic(ctx: Context, topicId: string): Promise<void> {
  const user = await getCtxUser(ctx);
  const audience = helpAudienceForUser(user);
  const text = formatBotHelpTopic(topicId);
  await ctx.answerCallbackQuery().catch(() => undefined);
  if (!text) {
    await sendOrEditHelp(ctx, formatBotHelpOverview(audience), audience);
    return;
  }
  const kb = new InlineKeyboard()
    .text('📋 نمای کلی راهنما', HELP_HOME_CB)
    .row()
    .text('❓ بخش دیگر', HELP_HOME_CB);
  try {
    if (ctx.callbackQuery?.message) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      return;
    }
  } catch {
    /* reply */
  }
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}
