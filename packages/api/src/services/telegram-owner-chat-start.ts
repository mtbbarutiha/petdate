import type { User } from '@petdate/shared';
import { infra } from '../config/infra';
import { normalizeTelegramId } from './telegram-id';

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

function enterChatKeyboard(playdateId: number) {
  return {
    inline_keyboard: [
      [{ text: '💬 شروع چت', callback_data: `playdate:enterchat:${playdateId}` }],
    ],
  };
}

/**
 * After a playdate is accepted on the web, invite both Telegram users to
 * explicitly tap «شروع چت». Do NOT auto-enter owner_chat sessions — that
 * made chat feel connected without each side confirming.
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

  const petLine =
    opts.fromPetName && opts.toPetName
      ? `پت‌ها: <b>${escapeHtml(opts.fromPetName)}</b> ↔ <b>${escapeHtml(opts.toPetName)}</b>`
      : null;

  const accepterIntro = [
    '✅ <b>درخواست همبازی را قبول کردی</b>',
    '',
    `طرف مقابل: <b>${escapeHtml(requester.name)}</b>`,
    petLine,
    '',
    'برای شروع گفتگو دکمهٔ <b>شروع چت</b> را بزن.',
    'تا وقتی وارد چت نشوی، پیام‌ها رد و بدل نمی‌شوند.',
  ]
    .filter(Boolean)
    .join('\n');

  const requesterIntro = [
    '✅ <b>درخواست همبازی‌ات پذیرفته شد!</b>',
    '',
    `طرف مقابل: <b>${escapeHtml(accepter.name)}</b>`,
    petLine,
    '',
    'برای شروع گفتگو دکمهٔ <b>شروع چت</b> را بزن.',
    'تا وقتی طرف مقابل هم وارد چت نشود / تو وارد نشوی، اتصال کامل نیست.',
  ]
    .filter(Boolean)
    .join('\n');

  const keyboard = enterChatKeyboard(playdateId);
  const aOk = await telegramCall('sendMessage', {
    chat_id: accepterTg,
    text: accepterIntro,
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
  const rOk = await telegramCall('sendMessage', {
    chat_id: requesterTg,
    text: requesterIntro,
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
  return aOk || rOk;
}
