/**
 * اعلان تلگرام پس از تأیید/رد احراز چهره توسط ادمین.
 * شکست ارسال هرگز نباید خودِ تأیید را fail کند (مثل پرداخت کارت‌به‌کارت).
 */
import { faceVerifyApprovedNotifyText, faceVerifyRejectedNotifyText } from '@petdate/shared';
import { infra } from '../config/infra';
import { telegramBotApiUrl, telegramFetch } from './telegram-http';
import { usableTelegramId } from './telegram-id';

async function sendPlainTelegram(toTelegramId: string, text: string, label: string): Promise<boolean> {
  if (!infra.telegram.botToken || !usableTelegramId(toTelegramId)) return false;
  try {
    const res = await telegramFetch(telegramBotApiUrl(infra.telegram.botToken, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: toTelegramId, text }),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) {
      console.warn(`${label} failed:`, data.description ?? res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`${label} error:`, (err as Error).message);
    return false;
  }
}

export async function notifyFaceVerifyApprovedTelegram(opts: {
  toTelegramId?: string | null;
  coins: number;
}): Promise<boolean> {
  const tg = opts.toTelegramId ? String(opts.toTelegramId).trim() : '';
  return sendPlainTelegram(tg, faceVerifyApprovedNotifyText(opts.coins), 'face verify approve notify');
}

export async function notifyFaceVerifyRejectedTelegram(opts: {
  toTelegramId?: string | null;
  note?: string;
}): Promise<boolean> {
  const tg = opts.toTelegramId ? String(opts.toTelegramId).trim() : '';
  return sendPlainTelegram(tg, faceVerifyRejectedNotifyText(opts.note), 'face verify reject notify');
}
