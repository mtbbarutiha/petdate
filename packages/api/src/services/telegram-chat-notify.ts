import { infra } from '../config/infra';
import fs from 'fs';
import path from 'path';
import type { PlaydateChatMediaKind } from '@petdate/shared';
import { resolveStoragePath } from './chat-upload-store';
import { dbService } from '../db';

type TelegramSendResult = { ok: boolean; messageId?: number };

async function telegramCall(
  method: string,
  body: Record<string, unknown>
): Promise<TelegramSendResult> {
  const token = infra.telegram.botToken;
  if (!token) return { ok: false };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
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

async function telegramCallForm(method: string, form: FormData): Promise<TelegramSendResult> {
  const token = infra.telegram.botToken;
  if (!token) return { ok: false };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      body: form,
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

function usableTelegramId(id?: string | null): id is string {
  if (!id) return false;
  if (id.startsWith('fake_') || id.startsWith('fake_owner_')) return false;
  return true;
}


/** Reply keyboard for active playmate (owner) chat — mirrors bot ownerChatReplyKeyboard */
export function ownerChatTelegramKeyboard(secure = false): {
  keyboard: { text: string }[][];
  resize_keyboard: true;
  is_persistent: true;
} {
  return {
    keyboard: [
      [
        { text: secure ? '🔓 خاموش‌کردن چت امن' : '🔒 چت امن' },
        { text: '👤 پروفایل طرف مقابل' },
      ],
      [{ text: '🐾 مشاهده پروفایل پت' }, { text: '➕ افزودن مخاطب' }],
      [{ text: '🔌 قطع چت همبازی' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function telegramMethodForKind(kind: PlaydateChatMediaKind | null | undefined): string {
  switch (kind) {
    case 'photo':
    case 'sticker':
      return 'sendPhoto';
    case 'video':
    case 'animation':
    case 'video_note':
      return 'sendVideo';
    case 'voice':
      return 'sendVoice';
    case 'audio':
      return 'sendAudio';
    default:
      return 'sendDocument';
  }
}

function formFieldForKind(kind: PlaydateChatMediaKind | null | undefined): string {
  switch (kind) {
    case 'photo':
    case 'sticker':
      return 'photo';
    case 'video':
    case 'animation':
    case 'video_note':
      return 'video';
    case 'voice':
      return 'voice';
    case 'audio':
      return 'audio';
    default:
      return 'document';
  }
}

function rememberDelivery(
  playdateId: number | undefined,
  telegramChatId: string,
  messageId?: number
): void {
  if (!playdateId || !messageId) return;
  try {
    dbService.recordPlaydateChatTgRef(playdateId, telegramChatId, messageId);
  } catch (err) {
    console.warn('record tg ref failed:', (err as Error).message);
  }
}

/** Deliver a playdate chat line from web/API to the peer's Telegram. */
export async function notifyPlaydateChatTelegram(opts: {
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
  if (!infra.telegram.botToken || !usableTelegramId(opts.toTelegramId)) return false;

  const header = `💬 پیام همبازی از ${opts.senderName}:`;
  const captionText = opts.text.trim();
  const isPlaceholder = /^\[(تصویر|ویدیو|پیام صوتی|فایل صوتی|فایل|استیکر|رسانه)\]$/.test(
    captionText
  );
  const bodyText = isPlaceholder ? '' : captionText.slice(0, 900);

  if (opts.storageKey && opts.mediaKind) {
    const abs = resolveStoragePath(opts.storageKey);
    if (abs && fs.existsSync(abs)) {
      const buf = fs.readFileSync(abs);
      const fileName =
        opts.fileName || path.basename(abs) || `file${path.extname(abs) || ''}`;
      const mime = opts.mimeType || 'application/octet-stream';
      const form = new FormData();
      form.append('chat_id', opts.toTelegramId);
      const blob = new Blob([new Uint8Array(buf)], { type: mime });
      form.append(formFieldForKind(opts.mediaKind), blob, fileName);
      const caption = bodyText ? `${header}\n\n${bodyText}` : header;
      form.append('caption', caption.slice(0, 1024));
      if (opts.protectContent) form.append('protect_content', 'true');
      form.append(
        'reply_markup',
        JSON.stringify(ownerChatTelegramKeyboard(Boolean(opts.protectContent)))
      );
      const sent = await telegramCallForm(telegramMethodForKind(opts.mediaKind), form);
      if (sent.ok) {
        rememberDelivery(opts.playdateId, opts.toTelegramId, sent.messageId);
        return true;
      }
      // fall through to text notice if media send fails
    }
  }

  const body = (bodyText || captionText || '[رسانه]').slice(0, 3500);
  const sent = await telegramCall('sendMessage', {
    chat_id: opts.toTelegramId,
    text: `${header}\n\n${body}`,
    ...(opts.protectContent ? { protect_content: true } : {}),
    reply_markup: ownerChatTelegramKeyboard(Boolean(opts.protectContent)),
  });
  if (sent.ok) rememberDelivery(opts.playdateId, opts.toTelegramId, sent.messageId);
  return sent.ok;
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
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`
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
      downloadUrl: `https://api.telegram.org/file/bot${token}/${filePath}`,
    };
  } catch (err) {
    console.warn('telegram getFile error:', (err as Error).message);
    return null;
  }
}
