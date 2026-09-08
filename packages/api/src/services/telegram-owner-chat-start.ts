import type { User } from '@petdate/shared';
import { userPublicIdOf } from '@petdate/shared';
import { infra } from '../config/infra';
import { activateBotOwnerChatSessions } from './bot-owner-chat-session';
import { telegramFetch, telegramBotApiUrl } from './telegram-http';
import { normalizeTelegramId } from './telegram-id';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Playmate chat peer label — canonical PD-U#####, never @username / display name. */
function playmatePeerIdLabel(user: User): string {
  return userPublicIdOf(user);
}

async function telegramCall(
  method: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; messageId?: number; description?: string }> {
  const token = infra.telegram.botToken;
  if (!token) return { ok: false, description: 'no bot token' };
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
 * Sticky ReplyKeyboard push was removed: send+delete clears the menu on many clients.
 * Keyboard must stay on the content message (no carrier delete afterward).
 */
async function notifyOwnerChatOpen(
  chatId: string,
  text: string,
  who: string
): Promise<boolean> {
  const keyboard = ownerChatReplyKeyboard();
  const intro = await telegramCall('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
  if (intro.ok) return true;

  const plain = await telegramCall('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  });
  if (!plain.ok) {
    console.warn(`startOwnerChatFromApi: intro failed (${who})`, plain.description);
    return false;
  }
  const fallback = await telegramCall('sendMessage', {
    chat_id: chatId,
    text: '👋 به همبازی سلام کن!',
    reply_markup: keyboard,
  });
  if (!fallback.ok) {
    console.warn(`startOwnerChatFromApi: keyboard failed (${who})`, fallback.description);
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
    `طرف مقابل: ${escapeHtml(playmatePeerIdLabel(requester))}`,
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
    `طرف مقابل: ${escapeHtml(playmatePeerIdLabel(accepter))}`,
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
