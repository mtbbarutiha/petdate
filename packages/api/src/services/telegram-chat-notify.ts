import { infra } from '../config/infra';
import type { PlaydateChatMediaKind } from '@petdate/shared';
import { dbService } from '../db';
import { telegramFetch, telegramBotApiUrl, telegramFileApiUrl } from './telegram-http';
import { usableTelegramId } from './telegram-id';

type TelegramSendResult = { ok: boolean; messageId?: number };

async function telegramCall(
  method: string,
  body: Record<string, unknown>
): Promise<TelegramSendResult> {
  const token = infra.telegram.botToken;
  if (!token) return { ok: false };
  try {
    const res = await telegramFetch(telegramBotApiUrl(token, method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };
    if (!data.ok) {
      console.warn(`telegram ${method} failed:`, data.description ?? res.status);
      return { ok: false };
    }
    return { ok: true, messageId: data.result?.message_id };
  } catch (err) {
    console.warn(`telegram ${method} error:`, (err as Error).message);
    return { ok: false };
  }
}

/**
 * Playmate chat is web-only: do NOT mirror lines to Telegram as
 * "💬 پیام همبازی از …". Delivery stays on web chat / WebSocket.
 * Kept as a no-op so call sites remain stable if re-enabled later.
 */
export async function notifyPlaydateChatTelegram(_opts: {
  toTelegramId: string;
  senderName: string;
  text: string;
  playdateId: number;
  protectContent?: boolean;
  mediaKind?: PlaydateChatMediaKind | null;
  storageKey?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
}): Promise<boolean> {
  return false;
}

export async function notifyPlaydateChatSecureTelegram(opts: {
  toTelegramId: string;
  secure: boolean;
}): Promise<boolean> {
  if (!infra.telegram.botToken || !usableTelegramId(opts.toTelegramId)) return false;
  const text = opts.secure
    ? '🔒 طرف مقابل چت امن را در وب فعال کرد.\nپیام‌های این گفتگو قابل ذخیره یا فوروارد نیستند.'
    : '🔓 طرف مقابل چت امن را در وب خاموش کرد.';
  return (await telegramCall('sendMessage', { chat_id: opts.toTelegramId, text })).ok;
}

export async function notifyPlaydateChatEndedTelegram(opts: {
  toTelegramId: string;
}): Promise<boolean> {
  if (!infra.telegram.botToken || !usableTelegramId(opts.toTelegramId)) return false;
  return (
    await telegramCall('sendMessage', {
      chat_id: opts.toTelegramId,
      text:
        '🔌 چت همبازی از وب قطع شد.\n🗑 لطفاً کل این گفتگو را از تلگرام پاک کنید تا اثری نماند.',
    })
  ).ok;
}

/**
 * Delete bot-delivered playdate messages from Telegram (best-effort).
 * Bots can only delete messages they themselves sent — not the peer's own typed lines.
 */
export async function wipePlaydateChatTelegram(opts: {
  playdateId: number;
  notifyTelegramIds?: string[];
}): Promise<{ deleted: number }> {
  const refs = dbService.listPlaydateChatTgRefs(opts.playdateId);
  const byChat = new Map<string, number[]>();
  for (const ref of refs) {
    if (!usableTelegramId(ref.telegramChatId)) continue;
    const list = byChat.get(ref.telegramChatId) ?? [];
    list.push(ref.messageId);
    byChat.set(ref.telegramChatId, list);
  }

  let deleted = 0;
  for (const [chatId, messageIds] of byChat) {
    for (let i = 0; i < messageIds.length; i += 100) {
      const chunk = [...new Set(messageIds.slice(i, i + 100))];
      const bulk = await telegramCall('deleteMessages', {
        chat_id: chatId,
        message_ids: chunk,
      });
      if (bulk.ok) {
        deleted += chunk.length;
        continue;
      }
      for (const messageId of chunk) {
        const one = await telegramCall('deleteMessage', {
          chat_id: chatId,
          message_id: messageId,
        });
        if (one.ok) deleted += 1;
      }
    }
  }

  dbService.clearPlaydateChatTgRefs(opts.playdateId);

  for (const telegramId of opts.notifyTelegramIds ?? []) {
    if (!usableTelegramId(telegramId)) continue;
    await telegramCall('sendMessage', {
      chat_id: telegramId,
      text:
        '🗑 طرف مقابل گفتگوی همبازی را از وب پاک کرد.\nپیام‌های ربات از این چت حذف شدند. اگر چیزی از پیام‌های خودت ماند، دستی پاکش کن.',
    });
  }

  return { deleted };
}

/** Resolve a Telegram file_id to a downloadable file path on Telegram servers. */
export async function resolveTelegramFile(fileId: string): Promise<{
  filePath: string;
  downloadUrl: string;
} | null> {
  const token = infra.telegram.botToken;
  if (!token || !fileId) return null;
  try {
    const res = await telegramFetch(
      telegramBotApiUrl(token, 'getFile') + `?file_id=${encodeURIComponent(fileId)}`
    );
    const data = (await res.json()) as {
      ok?: boolean;
      result?: { file_path?: string };
      description?: string;
    };
    if (!data.ok || !data.result?.file_path) {
      console.warn('telegram getFile failed:', data.description ?? res.status);
      return null;
    }
    const filePath = data.result.file_path;
    return {
      filePath,
      downloadUrl: telegramFileApiUrl(token, filePath),
    };
  } catch (err) {
    console.warn('telegram getFile error:', (err as Error).message);
    return null;
  }
}
