import { toPersianDigits } from '@petdate/shared';
import { infra } from '../config/infra';
import { telegramFetch, telegramBotApiUrl } from './telegram-http';
import { usableTelegramId } from './telegram-id';

/** اطلاع به معرف پس از واریز جایزه دعوت */
export async function notifyReferralBonusTelegram(opts: {
  toTelegramId: string;
  amount: number;
  invitedName?: string;
}): Promise<boolean> {
  if (!infra.telegram.botToken || !usableTelegramId(opts.toTelegramId)) return false;
  const amountFa = toPersianDigits(opts.amount);
  const who = opts.invitedName?.trim() ? ` (${opts.invitedName.trim()})` : '';
  const text = [
    '🎁 جایزه دعوت دوستان',
    '',
    `یک دوست جدید با لینک دعوتت ثبت‌نام کرد${who}.`,
    `+${amountFa} سکه به موجودی‌ات اضافه شد.`,
  ].join('\n');
  try {
    const res = await telegramFetch(telegramBotApiUrl(infra.telegram.botToken, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: opts.toTelegramId, text }),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) {
      console.warn('referral notify failed:', data.description ?? res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('referral notify error:', (err as Error).message);
    return false;
  }
}
