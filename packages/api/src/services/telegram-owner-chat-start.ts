import type { User } from '@petdate/shared';
import { infra } from '../config/infra';
import { activateBotOwnerChatSessions } from './bot-owner-chat-session';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function telegramCall(method: string, body: Record<string, unknown>): Promise<boolean> {
  const token = infra.telegram.botToken;
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) {
      console.warn(`telegram ${method} failed:`, data.description ?? res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`telegram ${method} error:`, (err as Error).message);
    return false;
  }
}

function usableTelegramId(id?: string | null): id is string {
  if (!id) return false;
  if (id.startsWith('fake_') || id.startsWith('fake_owner_')) return false;
  return true;
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
  };
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
  if (!usableTelegramId(accepter.telegramId) || !usableTelegramId(requester.telegramId)) {
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

  const keyboard = ownerChatReplyKeyboard();
  const aOk = await telegramCall('sendMessage', {
    chat_id: accepter.telegramId,
    text: accepterIntro,
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
  const rOk = await telegramCall('sendMessage', {
    chat_id: requester.telegramId,
    text: requesterIntro,
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
  return aOk || rOk;
}
