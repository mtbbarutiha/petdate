import type { User } from '@petdate/shared';
import { infra } from '../config/infra';
import { activateBotOwnerChatSessions } from './bot-owner-chat-session';
import { normalizeTelegramId } from './telegram-id';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function telegramCall(
  method: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; messageId?: number; description?: string }> {
  const token = infra.telegram.botToken;
  if (!token) return { ok: false, description: 'no bot token' };
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
      return { ok: false, description: data.description };
    }
    return { ok: true, messageId: data.result?.message_id };
  } catch (err) {
    console.warn(`telegram ${method} error:`, (err as Error).message);
    return { ok: false, description: (err as Error).message };
  }
}

/** Same labels as packages/bot owner-chat reply keyboard */
function ownerChatReplyKeyboard() {
  return {
    keyboard: [
      [{ text: '🔒 چت امن' }, { text: '👤 پروفایل طرف مقابل' }],
      [{ text: '🐾 مشاهده پروفایل پت' }, { text: '➕ افزودن مخاطب' }],
      [{ text: '🔌 قطع چت همبازی' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

/**
 * Sticky ReplyKeyboard push — Telegram rejects ZWNJ/ZWSP as empty text.
 * Prefer Word Joiner, then visible fallbacks.
 */
async function pushOwnerChatKeyboard(chatId: string): Promise<boolean> {
  const keyboard = ownerChatReplyKeyboard();
  for (const carrier of ['\u2060', '·', '.', '-'] as const) {
    const sent = await telegramCall('sendMessage', {
      chat_id: chatId,
      text: carrier,
      reply_markup: keyboard,
    });
    if (!sent.ok || sent.messageId == null) continue;
    await telegramCall('deleteMessage', { chat_id: chatId, message_id: sent.messageId });
    return true;
  }
  return false;
}

async function notifyOwnerChatOpen(
  chatId: string,
  text: string,
  who: string
): Promise<boolean> {
  const keyboard = ownerChatReplyKeyboard();
  // Keyboard on content first — sticky send+delete alone can leave no menu.
  const intro = await telegramCall('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
  if (!intro.ok) {
    const plain = await telegramCall('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    });
    if (!plain.ok) {
      console.warn(`startOwnerChatFromApi: intro failed (${who})`, plain.description);
      return false;
    }
  }
  const kbOk = await pushOwnerChatKeyboard(chatId);
  if (!kbOk) {
    const fallback = await telegramCall('sendMessage', {
      chat_id: chatId,
      text: '👋 به همبازی سلام کن!',
      reply_markup: keyboard,
    });
    if (!fallback.ok) {
      console.warn(`startOwnerChatFromApi: keyboard failed (${who})`, fallback.description);
    }
  }
  return true;
}

/**
 * After a playdate is accepted (web or API), put both Telegram users into
 * owner_chat immediately — no «شروع چت» tap required.
 */
export async function startOwnerChatFromApi(opts: {
  playdateId: number;
  accepter: User;
  requester: User;
  fromPetName?: string;
  toPetName?: string;
  fromPetId?: number;
  toPetId?: number;
}): Promise<boolean> {
  const { accepter, requester, playdateId } = opts;
  const accepterTg = normalizeTelegramId(accepter.telegramId);
  const requesterTg = normalizeTelegramId(requester.telegramId);
  if (!accepterTg || !requesterTg) {
    console.warn('startOwnerChatFromApi: missing usable telegram ids', {
      playdateId,
      accepter: accepter.telegramId,
      requester: requester.telegramId,
    });
    return false;
  }

  await activateBotOwnerChatSessions({
    playdateId,
    accepter,
    requester,
    fromPetId: opts.fromPetId,
    toPetId: opts.toPetId,
  });

  const petLine =
    opts.fromPetName && opts.toPetName
      ? `پت‌ها: <b>${escapeHtml(opts.fromPetName)}</b> ↔ <b>${escapeHtml(opts.toPetName)}</b>`
      : null;

  const tipLines = [
    'دکمه‌های چت:',
    '• 🔒 چت امن — پیام‌ها غیرقابل ذخیره/فوروارد',
    '• 👤 پروفایل طرف مقابل / 🐾 پروفایل پت',
    '• ➕ افزودن مخاطب',
    '• 🔌 قطع چت همبازی',
  ].join('\n');

  const accepterIntro = [
    '💬 <b>چت همبازی فعال شد</b>',
    '',
    `طرف مقابل: <b>${escapeHtml(requester.name)}</b>`,
    petLine,
    '',
    '👋 به همبازی جدید سلام کن!',
    'هر پیامی بفرستی مستقیم می‌رسد — نیازی به شروع جداگانه نیست.',
    '',
    tipLines,
  ]
    .filter(Boolean)
    .join('\n');

  const requesterIntro = [
    '✅ <b>درخواست همبازی‌ات پذیرفته شد!</b>',
    '',
    `طرف مقابل: <b>${escapeHtml(accepter.name)}</b>`,
    petLine,
    '',
    '💬 چت همبازی همین الان فعال شد.',
    '👋 به همبازی جدید سلام کن!',
    '',
    tipLines,
  ]
    .filter(Boolean)
    .join('\n');

  const aOk = await notifyOwnerChatOpen(accepterTg, accepterIntro, 'accepter');
  const rOk = await notifyOwnerChatOpen(requesterTg, requesterIntro, 'requester');
  console.log('startOwnerChatFromApi done', { playdateId, accepter: aOk, requester: rOk });
  return aOk || rOk;
}
