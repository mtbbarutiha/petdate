import { Bot } from 'grammy';
import { applyBotBranding } from './branding';
import { assertBotToken, config } from './config';
import { requiredChannels } from './force-join';
import { registerHandlers } from './handlers';
import { reportBotError } from './report-error';
import { connectRedis, disconnectRedis } from './session';
import { grammyClientOptions } from './telegram-http';
import { effectiveWebUrl, isTelegramInlineUrl } from './urls';

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
  void reportBotError({
    message: `uncaughtException: ${err.message}`,
    stack: err.stack,
    meta: { type: 'uncaughtException' },
  });
});
process.on('unhandledRejection', (reason) => {
  const message =
    reason instanceof Error ? reason.message : `unhandledRejection: ${String(reason)}`;
  const stack = reason instanceof Error ? reason.stack : undefined;
  console.error('unhandledRejection:', reason);
  void reportBotError({
    message,
    stack,
    meta: { type: 'unhandledRejection' },
  });
});

async function warnForceJoinAdminRights(bot: Bot): Promise<void> {
  const me = await bot.api.getMe();
  for (const ch of requiredChannels()) {
    const chatId = `@${ch.username}`;
    try {
      const member = await bot.api.getChatMember(chatId, me.id);
      if (member.status !== 'administrator' && member.status !== 'creator') {
        console.warn(
          `   Force-join: bot is "${member.status}" in ${chatId} — must be admin to verify membership`
        );
      } else {
        console.log(`   Force-join: OK admin in ${chatId}`);
      }
    } catch (err) {
      console.warn(
        `   Force-join: cannot access ${chatId} — add @${me.username} as channel admin. (${(err as Error).message})`
      );
    }
  }
}

async function main(): Promise<void> {
  const token = assertBotToken();
  await connectRedis();

  const bot = new Bot(token, { client: grammyClientOptions() });
  registerHandlers(bot);
  await applyBotBranding(bot.api);
  await warnForceJoinAdminRights(bot);

  bot.catch(async (err) => {
    console.error('Bot error:', err.error);
    const message = err.error instanceof Error ? err.error.message : String(err.error);
    const stack = err.error instanceof Error ? err.error.stack : undefined;
    void reportBotError({
      message: `Bot error: ${message}`,
      stack,
      path: err.ctx?.update?.update_id != null ? `update:${err.ctx.update.update_id}` : null,
      meta: {
        type: 'bot.catch',
        updateType: err.ctx?.update ? Object.keys(err.ctx.update).filter((k) => k !== 'update_id')[0] : null,
      },
    });
    try {
      if (
        message.includes('fetch failed') ||
        message.includes('ECONNREFUSED') ||
        message.includes('API ') ||
        message.includes('AbortError') ||
        message.includes('timeout')
      ) {
        await err.ctx.reply(
          'فعلاً سرور همبازی در دسترس نیست. چند لحظه بعد دوباره امتحان کن.'
        );
      } else {
        // Always acknowledge so menu buttons never look dead
        await err.ctx.reply(
          'یک مشکل موقتی پیش اومد. دوباره «🔍 پیدا کردن همبازی» یا /menu رو بزن.'
        );
      }
    } catch {
      /* ignore reply failures */
    }
  });

  if (config.webhookUrl) {
    const secret = config.webhookSecret ?? `petdate-${Date.now()}`;
    await bot.api.setWebhook(config.webhookUrl, {
      secret_token: secret,
      allowed_updates: [
        'message',
        'callback_query',
        'pre_checkout_query',
        'business_connection',
        'edited_message',
        'my_chat_member',
        'chat_member',
      ],
    });
    console.log(`🤖 petdate bot webhook → ${config.webhookUrl}`);
    console.log('   (برای dev از polling استفاده کن — BOT_WEBHOOK_URL را خالی بگذار)');
  } else {
    await bot.api.deleteWebhook({ drop_pending_updates: true }).catch(() => undefined);
    console.log('🤖 petdate bot (polling) — Ctrl+C برای توقف');
    const webUrl = effectiveWebUrl();
    if (!isTelegramInlineUrl(webUrl)) {
      console.warn(`   Web links disabled in chat (set PUBLIC_WEB_URL for HTTPS tunnel): ${webUrl}`);
    }
    await bot.start({
      drop_pending_updates: true,
      allowed_updates: [
        'message',
        'callback_query',
        'pre_checkout_query',
        'business_connection',
        'edited_message',
        'my_chat_member',
        'chat_member',
      ],
      onStart: () => console.log(`   API: ${config.apiUrl} | Web: ${config.webUrl}`),
    });
  }
}

async function shutdown(): Promise<void> {
  await disconnectRedis();
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

main().catch((err) => {
  console.error(err);
  void reportBotError({
    message: err instanceof Error ? `bot main failed: ${err.message}` : `bot main failed: ${String(err)}`,
    stack: err instanceof Error ? err.stack : null,
    meta: { type: 'main' },
  }).finally(() => process.exit(1));
});
