import fs from 'fs';
import path from 'path';
import { infra } from '../config/infra';
import type { PlaydateChatMediaKind } from '@petdate/shared';
import { dbService } from '../db';
import { telegramFetch, telegramBotApiUrl, telegramFileApiUrl } from './telegram-http';
import { usableTelegramId } from './telegram-id';
import { resolveStoragePath } from './chat-upload-store';

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

async function telegramSendMultipart(
  method: string,
  fields: Record<string, string>,
  fileField: string,
  file: { buffer: Buffer; filename: string; contentType: string }
): Promise<TelegramSendResult> {
  const token = infra.telegram.botToken;
  if (!token) return { ok: false };
  try {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      if (v != null && v !== '') form.append(k, v);
    }
    form.append(
      fileField,
      new Blob([new Uint8Array(file.buffer)], { type: file.contentType || 'application/octet-stream' }),
      file.filename || 'file'
    );
    const res = await telegramFetch(telegramBotApiUrl(token, method), {
      method: 'POST',
      body: form,
    });
    const data = (await res.json()) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };
    if (!data.ok) {
      console.warn(`telegram ${method} upload failed:`, data.description ?? res.status);
      return { ok: false };
    }
    return { ok: true, messageId: data.result?.message_id };
  } catch (err) {
    console.warn(`telegram ${method} upload error:`, (err as Error).message);
    return { ok: false };
  }
}

function rememberDelivery(playdateId: number, chatId: string, messageId?: number) {
  if (!messageId) return;
  try {
    dbService.recordPlaydateChatTgRef(playdateId, chatId, messageId);
  } catch (err) {
    console.warn('record playdate tg ref failed:', (err as Error).message);
  }
}

/**
 * Sticky ReplyKeyboard on the *content* message (never send+delete carrier).
 * Labels match packages/bot ownerChatReplyKeyboard.
 */
function ownerChatStickyKeyboard(secure = false) {
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

function mediaPlaceholder(kind?: PlaydateChatMediaKind | null): string {
  switch (kind) {
    case 'photo':
      return '[تصویر]';
    case 'video':
    case 'animation':
    case 'video_note':
      return '[ویدیو]';
    case 'voice':
      return '[پیام صوتی]';
    case 'audio':
      return '[فایل صوتی]';
    case 'sticker':
      return '[استیکر]';
    case 'document':
      return '[فایل]';
    default:
      return '[رسانه]';
  }
}

/**
 * Mirror a web (or API) playdate chat line to the peer's Telegram.
 * Plain text (no sender prefix). Sticky ReplyKeyboard stays on the content
 * message — never send+delete carriers.
 *
 * Bot API cannot place bot-sent messages on the right as "outgoing" bubbles,
 * so we intentionally do not echo the sender's own web lines into their bot
 * chat (that would always look like an incoming left-side message).
 * Bot-originated lines call the messages API with skipTelegram=true to avoid double-send.
 */
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
  void opts.senderName; // kept for call-site compatibility; not shown in plain peer relay

  const chatId = String(opts.toTelegramId).trim();
  const secure = Boolean(opts.protectContent);
  const protect = secure ? { protect_content: true } : {};
  const keyboard = ownerChatStickyKeyboard(secure);
  const caption = (opts.text || '').trim();
  const storageAbs = opts.storageKey ? resolveStoragePath(opts.storageKey) : null;
  const hasFile = Boolean(storageAbs && fs.existsSync(storageAbs));

  let result: TelegramSendResult = { ok: false };

  if (hasFile && storageAbs) {
    const buffer = fs.readFileSync(storageAbs);
    const filename =
      (opts.fileName && path.basename(opts.fileName)) ||
      path.basename(storageAbs) ||
      'file';
    const contentType = opts.mimeType || 'application/octet-stream';
    const kind = opts.mediaKind || 'document';
    const fields: Record<string, string> = {
      chat_id: chatId,
      ...(caption ? { caption: caption.slice(0, 1024) } : {}),
      ...(secure ? { protect_content: 'true' } : {}),
      reply_markup: JSON.stringify(keyboard),
    };

    if (kind === 'photo') {
      result = await telegramSendMultipart('sendPhoto', fields, 'photo', {
        buffer,
        filename,
        contentType: contentType.startsWith('image/') ? contentType : 'image/jpeg',
      });
    } else if (kind === 'sticker') {
      // Stickers are often webp — sendDocument is more reliable than sendPhoto
      result = await telegramSendMultipart('sendDocument', fields, 'document', {
        buffer,
        filename: filename.endsWith('.webp') ? filename : `${filename}.webp`,
        contentType: contentType.startsWith('image/') ? contentType : 'image/webp',
      });
    } else if (kind === 'video' || kind === 'animation' || kind === 'video_note') {
      const method = kind === 'animation' ? 'sendAnimation' : 'sendVideo';
      const field = kind === 'animation' ? 'animation' : 'video';
      result = await telegramSendMultipart(method, fields, field, {
        buffer,
        filename,
        contentType: contentType || 'video/mp4',
      });
    } else if (kind === 'voice' || kind === 'audio') {
      // sendVoice needs OGG/Opus (API normalizes voice uploads). Non-OGG → sendAudio.
      const isOggOpus =
        /audio\/(ogg|opus)/i.test(contentType) || /\.(ogg|opus)$/i.test(filename);
      const useVoice = kind === 'voice' && isOggOpus;
      const method = useVoice ? 'sendVoice' : 'sendAudio';
      const field = useVoice ? 'voice' : 'audio';
      result = await telegramSendMultipart(method, fields, field, {
        buffer,
        filename,
        contentType: contentType || (useVoice ? 'audio/ogg' : 'audio/webm'),
      });
    } else {
      result = await telegramSendMultipart('sendDocument', fields, 'document', {
        buffer,
        filename,
        contentType,
      });
    }

    // Fallbacks: document upload, then text so peer still learns something arrived
    if (!result.ok && kind !== 'document' && kind !== 'sticker') {
      result = await telegramSendMultipart('sendDocument', fields, 'document', {
        buffer,
        filename,
        contentType,
      });
    }
    if (!result.ok) {
      const notice = (caption || mediaPlaceholder(kind)).slice(0, 4096);
      result = await telegramCall('sendMessage', {
        chat_id: chatId,
        text: notice,
        ...protect,
        reply_markup: keyboard,
      });
    }
  } else if (caption) {
    result = await telegramCall('sendMessage', {
      chat_id: chatId,
      text: caption.slice(0, 4096),
      ...protect,
      reply_markup: keyboard,
    });
  } else if (opts.mediaKind) {
    // DB has media metadata but file missing on disk — still notify
    result = await telegramCall('sendMessage', {
      chat_id: chatId,
      text: mediaPlaceholder(opts.mediaKind),
      ...protect,
      reply_markup: keyboard,
    });
  } else {
    return false;
  }

  if (result.ok) {
    rememberDelivery(opts.playdateId, chatId, result.messageId);
  }
  return result.ok;
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

/** Inline wipe CTA after secure chat ends — separate from sticky ReplyKeyboard. */
export const SECURE_WIPE_CB = {
  playdate: (playdateId: number) => `securewipe:pd:${Math.trunc(playdateId)}`,
  vet: (consultId: number) => `securewipe:vc:${Math.trunc(consultId)}`,
} as const;

export function secureChatEndedWipeText(kind: 'playdate' | 'vet'): string {
  const label = kind === 'playdate' ? 'همبازی' : 'مشاوره';
  return [
    `🔒 چت امن ${label} پایان یافت.`,
    '',
    'برای پاک‌کردن کل گفتگو (پیام‌های ربات + کپی وب) دکمه زیر را بزن.',
    'اگر چیزی از پیام‌های خودت در تلگرام ماند، همان را هم دستی پاک کن.',
  ].join('\n');
}

export function secureChatWipeInlineKeyboard(
  kind: 'playdate' | 'vet',
  threadId: number
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const callback_data =
    kind === 'playdate' ? SECURE_WIPE_CB.playdate(threadId) : SECURE_WIPE_CB.vet(threadId);
  return {
    inline_keyboard: [[{ text: '🗑 حذف کل چت', callback_data }]],
  };
}

export async function notifyPlaydateChatEndedTelegram(opts: {
  toTelegramId: string;
  /** When true, send wipe CTA with inline button (secure chat privacy). */
  wasSecure?: boolean;
  playdateId?: number;
}): Promise<boolean> {
  if (!infra.telegram.botToken || !usableTelegramId(opts.toTelegramId)) return false;
  if (opts.wasSecure && opts.playdateId != null && Number.isFinite(opts.playdateId)) {
    return (
      await telegramCall('sendMessage', {
        chat_id: opts.toTelegramId,
        text: secureChatEndedWipeText('playdate'),
        reply_markup: secureChatWipeInlineKeyboard('playdate', opts.playdateId),
      })
    ).ok;
  }
  return (
    await telegramCall('sendMessage', {
      chat_id: opts.toTelegramId,
      text:
        '🔌 چت همبازی قطع شد.\nمنوی اصلی دوباره فعال است — /start یا «📋 منو» را بزن.\n🗑 در صورت نیاز گفتگو را از تلگرام پاک کن.',
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

/**
 * Sticky ReplyKeyboard for vet consult chat (role + serviceKind aware).
 * Labels match packages/bot vetChatReplyKeyboard — never send+delete carriers.
 */
function vetChatStickyKeyboard(
  peerRole: 'vet' | 'patient',
  serviceKind: 'vet' | 'trainer' | 'sitter' | 'seeker_advice' | string = 'vet'
) {
  if (peerRole === 'patient') {
    return {
      keyboard: [[{ text: '🔌 بستن چت' }]],
      resize_keyboard: true,
      is_persistent: true,
    };
  }
  if (serviceKind === 'vet') {
    return {
      keyboard: [
        [{ text: '🔌 بستن چت' }],
        [{ text: '🐾 پروفایل پت' }, { text: '📋 پرونده' }],
        [{ text: '📝 ثبت پرونده' }, { text: '💊 نسخه' }],
      ],
      resize_keyboard: true,
      is_persistent: true,
    };
  }
  // Trainer / sitter providers: profile views only (no medical tools).
  return {
    keyboard: [
      [{ text: '🔌 بستن چت' }],
      [{ text: '🐾 پروفایل پت' }, { text: '👤 پروفایل صاحب پت' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

/**
 * Mirror a web/API vet consult chat line to the peer's Telegram.
 * Plain text (no sender prefix). Sticky ReplyKeyboard on the content message.
 * No self-echo to the sender's own bot (Bot API cannot do right-side bubbles).
 * Bot-originated lines call the messages API with skipTelegram=true.
 */
export async function notifyVetChatTelegram(opts: {
  toTelegramId: string;
  peerRole: 'vet' | 'patient';
  text: string;
  protectContent?: boolean;
  serviceKind?: 'vet' | 'trainer' | 'sitter' | 'seeker_advice' | string | null;
  mediaKind?: PlaydateChatMediaKind | null;
  storageKey?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
}): Promise<boolean> {
  if (!infra.telegram.botToken || !usableTelegramId(opts.toTelegramId)) return false;

  const chatId = String(opts.toTelegramId).trim();
  const secure = Boolean(opts.protectContent);
  const protect = secure ? { protect_content: true } : {};
  const keyboard = vetChatStickyKeyboard(opts.peerRole, opts.serviceKind ?? 'vet');
  const caption = (opts.text || '').trim();
  const storageAbs = opts.storageKey ? resolveStoragePath(opts.storageKey) : null;
  const hasFile = Boolean(storageAbs && fs.existsSync(storageAbs));

  let result: TelegramSendResult = { ok: false };

  if (hasFile && storageAbs) {
    const buffer = fs.readFileSync(storageAbs);
    const filename =
      (opts.fileName && path.basename(opts.fileName)) ||
      path.basename(storageAbs) ||
      'file';
    const contentType = opts.mimeType || 'application/octet-stream';
    const kind = opts.mediaKind || 'document';
    const fields: Record<string, string> = {
      chat_id: chatId,
      ...(caption ? { caption: caption.slice(0, 1024) } : {}),
      ...(secure ? { protect_content: 'true' } : {}),
      reply_markup: JSON.stringify(keyboard),
    };

    if (kind === 'photo') {
      result = await telegramSendMultipart('sendPhoto', fields, 'photo', {
        buffer,
        filename,
        contentType: contentType.startsWith('image/') ? contentType : 'image/jpeg',
      });
    } else if (kind === 'sticker') {
      result = await telegramSendMultipart('sendDocument', fields, 'document', {
        buffer,
        filename: filename.endsWith('.webp') ? filename : `${filename}.webp`,
        contentType: contentType.startsWith('image/') ? contentType : 'image/webp',
      });
    } else if (kind === 'video' || kind === 'animation' || kind === 'video_note') {
      const method = kind === 'animation' ? 'sendAnimation' : 'sendVideo';
      const field = kind === 'animation' ? 'animation' : 'video';
      result = await telegramSendMultipart(method, fields, field, {
        buffer,
        filename,
        contentType: contentType || 'video/mp4',
      });
    } else if (kind === 'voice' || kind === 'audio') {
      // sendVoice needs OGG/Opus (API normalizes voice uploads). Non-OGG → sendAudio.
      const isOggOpus =
        /audio\/(ogg|opus)/i.test(contentType) || /\.(ogg|opus)$/i.test(filename);
      const useVoice = kind === 'voice' && isOggOpus;
      const method = useVoice ? 'sendVoice' : 'sendAudio';
      const field = useVoice ? 'voice' : 'audio';
      result = await telegramSendMultipart(method, fields, field, {
        buffer,
        filename,
        contentType: contentType || (useVoice ? 'audio/ogg' : 'audio/webm'),
      });
    } else {
      result = await telegramSendMultipart('sendDocument', fields, 'document', {
        buffer,
        filename,
        contentType,
      });
    }

    if (!result.ok && kind !== 'document' && kind !== 'sticker') {
      result = await telegramSendMultipart('sendDocument', fields, 'document', {
        buffer,
        filename,
        contentType,
      });
    }
    if (!result.ok) {
      const notice = (caption || mediaPlaceholder(kind)).slice(0, 4096);
      result = await telegramCall('sendMessage', {
        chat_id: chatId,
        text: notice,
        ...protect,
        reply_markup: keyboard,
      });
    }
  } else if (caption) {
    result = await telegramCall('sendMessage', {
      chat_id: chatId,
      text: caption.slice(0, 4096),
      ...protect,
      reply_markup: keyboard,
    });
  } else if (opts.mediaKind) {
    result = await telegramCall('sendMessage', {
      chat_id: chatId,
      text: mediaPlaceholder(opts.mediaKind),
      ...protect,
      reply_markup: keyboard,
    });
  } else {
    return false;
  }

  return result.ok;
}

export async function notifyVetChatSecureTelegram(opts: {
  toTelegramId: string;
  secure: boolean;
}): Promise<boolean> {
  if (!infra.telegram.botToken || !usableTelegramId(opts.toTelegramId)) return false;
  const text = opts.secure
    ? '🔒 طرف مقابل چت امن را در وب فعال کرد.\nپیام‌های این گفتگو قابل ذخیره یا فوروارد نیستند.'
    : '🔓 طرف مقابل چت امن را در وب خاموش کرد.';
  return (await telegramCall('sendMessage', { chat_id: opts.toTelegramId, text })).ok;
}

export async function notifyVetChatEndedTelegram(opts: {
  toTelegramId: string;
  wasSecure?: boolean;
  consultId?: number;
}): Promise<boolean> {
  if (!infra.telegram.botToken || !usableTelegramId(opts.toTelegramId)) return false;
  if (opts.wasSecure && opts.consultId != null && Number.isFinite(opts.consultId)) {
    return (
      await telegramCall('sendMessage', {
        chat_id: opts.toTelegramId,
        text: secureChatEndedWipeText('vet'),
        reply_markup: secureChatWipeInlineKeyboard('vet', opts.consultId),
      })
    ).ok;
  }
  return (
    await telegramCall('sendMessage', {
      chat_id: opts.toTelegramId,
      text:
        '🔌 چت مشاوره قطع شد.\nمنوی اصلی دوباره فعال است — /start یا «📋 منو» را بزن.\n🗑 در صورت نیاز گفتگو را از تلگرام پاک کن.',
    })
  ).ok;
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
