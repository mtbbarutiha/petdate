import type { ConsultServiceKind, User, VetConsultation } from '@petdate/shared';
import { SEEKER_OWNER_SHARE } from '@petdate/shared';
import { infra } from '../config/infra';
import { telegramFetch, telegramBotApiUrl } from './telegram-http';
import { normalizeTelegramId } from './telegram-id';

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
    const res = await telegramFetch(telegramBotApiUrl(token, method), {
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

/** Owner-facing copy for مشورت با صاحبین (no_pet seeker) — never «ویزیت». */
export function seekerAdviceOwnerNotifyText(opts: {
  patientName?: string | null;
  ownerShareCoins?: number;
}): string {
  const coins =
    opts.ownerShareCoins != null && Number.isFinite(opts.ownerShareCoins)
      ? Math.max(1, Math.floor(opts.ownerShareCoins))
      : SEEKER_OWNER_SHARE;
  const who = opts.patientName?.trim();
  return [
    '💬 <b>درخواست راهنمایی از صاحب پت</b>',
    '',
    `یک نفر می‌خواد باهات صحبت کنه و در مورد خرید و نگهداری پت راهنمایی می‌خواد؛ بابت این راهنمایی <b>${coins}</b> سکه دریافت می‌کنی.`,
    who ? '' : null,
    who ? `از طرف: <b>${escapeHtml(who)}</b>` : null,
    '',
    'اگر آماده‌ای قبول کن؛ منتظر پاسخته.',
    'قبول از ربات یا از وب → چت برای هر دو طرف فعال می‌شود.',
  ]
    .filter((line) => line != null)
    .join('\n');
}

/**
 * Notify online provider on Telegram when a quick-consult request is created
 * (same payload + accept/reject callbacks as bot handleQuickVetConnect).
 * Vet copy keeps «ویزیت»; seeker_advice uses personal guidance copy (no visit wording).
 */
export async function notifyVetQuickConsultTelegram(opts: {
  consult: VetConsultation;
  vetTelegramId: string;
  patient: User;
  visitFeeCoins?: number;
  /** When seeker_advice: coins the pet owner earns (not total charge). */
  providerShareCoins?: number;
  serviceKind?: ConsultServiceKind | string | null;
}): Promise<boolean> {
  const vetTg = normalizeTelegramId(opts.vetTelegramId);
  if (!infra.telegram.botToken || !vetTg) return false;

  const { patient, consult } = opts;
  const serviceKind = opts.serviceKind ?? consult.serviceKind ?? 'vet';

  let text: string;
  if (serviceKind === 'seeker_advice') {
    text = seekerAdviceOwnerNotifyText({
      patientName: patient.name,
      ownerShareCoins: opts.providerShareCoins ?? SEEKER_OWNER_SHARE,
    });
  } else {
    const fee =
      opts.visitFeeCoins != null && Number.isFinite(opts.visitFeeCoins)
        ? Math.max(1, Math.floor(opts.visitFeeCoins))
        : null;
    text = [
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
  }

  return telegramCall('sendMessage', {
    chat_id: vetTg,
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
