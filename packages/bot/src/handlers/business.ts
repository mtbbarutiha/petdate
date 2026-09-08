import type { Bot, Context } from 'grammy';
import { upsertTelegramBusinessConnection } from '../api-client';

/**
 * وقتی کاربر ربات را به‌عنوان Telegram Business Chatbot وصل/قطع می‌کند،
 * connection_id و حق can_view_gifts_and_stars را ذخیره می‌کنیم تا
 * API بتواند getBusinessAccountStarBalance را صدا بزند.
 */
export async function handleBusinessConnection(ctx: Context): Promise<void> {
  const conn = ctx.businessConnection;
  if (!conn) return;

  const telegramId = String(conn.user.id);
  const canViewStars = Boolean(conn.rights?.can_view_gifts_and_stars);
  const isEnabled = Boolean(conn.is_enabled);

  try {
    await upsertTelegramBusinessConnection({
      telegramId,
      connectionId: conn.id,
      isEnabled,
      canViewStars,
    });
  } catch (err) {
    console.warn(
      'business_connection save failed:',
      (err as Error).message,
      { telegramId, connectionId: conn.id }
    );
    return;
  }

  if (!isEnabled) {
    try {
      await ctx.api.sendMessage(
        conn.user_chat_id,
        'اتصال Business با پت‌دیت قطع شد. دیگر موجودی Stars تلگرام در کیف پول وب خوانده نمی‌شود.'
      );
    } catch {
      /* ignore */
    }
    return;
  }

  const lines = [
    '✅ ربات پت‌دیت به حساب Telegram Business وصل شد.',
    '',
    canViewStars
      ? 'حق مشاهدهٔ Stars فعال است — در کیف پول وب «همگام‌سازی» بزن تا عدد Stars تلگرام نمایش داده شود.'
      : '⚠️ حق «View gifts and Stars» خاموش است. از تنظیمات Business → Chatbots → Petdatebot این دسترسی را روشن کن.',
  ];

  try {
    await ctx.api.sendMessage(conn.user_chat_id, lines.join('\n'));
  } catch {
    /* ignore */
  }
}

export function registerBusinessHandlers(bot: Bot): void {
  bot.on('business_connection', (ctx) => handleBusinessConnection(ctx));
}
