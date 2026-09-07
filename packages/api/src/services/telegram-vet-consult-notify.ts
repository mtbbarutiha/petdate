import type { User, VetConsultation } from '@petdate/shared';
import { infra } from '../config/infra';

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const TELEGRAM_CALL_TIMEOUT_MS = 4000;

async function telegramCall(method: string, body: Record<string, unknown>): Promise<boolean> {
  const token = infra.telegram.botToken;
  if (!token) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TELEGRAM_CALL_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
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
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Notify online vet on Telegram when a quick-consult request is created
 * (same payload + accept/reject callbacks as bot handleQuickVetConnect).
 */
export async function notifyVetQuickConsultTelegram(opts: {
  consult: VetConsultation;
  vetTelegramId: string;
  patient: User;
  visitFeeCoins?: number;
}): Promise<boolean> {
  if (!infra.telegram.botToken || !opts.vetTelegramId) return false;

  const { patient, consult } = opts;
  const fee =
    opts.visitFeeCoins != null && Number.isFinite(opts.visitFeeCoins)
      ? Math.max(1, Math.floor(opts.visitFeeCoins))
      : null;
  const text = [
    '📬 <b>درخواست مشاوره سریع</b>',
    '',
    `بیمار: <b>${escapeHtml(patient.name)}</b>`,
    patient.city ? `شهر: ${escapeHtml(patient.city)}` : null,
    patient.phone ? `تماس: <code>${escapeHtml(patient.phone)}</code>` : null,
    fee != null ? `مبلغ ویزیت شما: <b>${fee}</b> سکه` : null,
    '',
    'اگر آماده‌ای قبول کن؛ بیمار منتظر پاسخته.',
    'قبول از ربات یا از وب → چت وب برای هر دو طرف فعال می‌شود.',
    'از منو «🩺 آخرین بیمارها» هم می‌تونی بیماران قبلی را ببینی.',
  ]
    .filter(Boolean)
    .join('\n');

  return telegramCall('sendMessage', {
    chat_id: opts.vetTelegramId,
    text,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ قبول', callback_data: `vet:consult:accept:${consult.id}` },
          { text: '❌ رد', callback_data: `vet:consult:reject:${consult.id}` },
        ],
      ],
    },
  });
}
