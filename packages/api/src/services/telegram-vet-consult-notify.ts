import type { ConsultServiceKind, User, VetConsultation } from '@petdate/shared';
import { SEEKER_OWNER_SHARE, userPublicIdOf } from '@petdate/shared';
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
const BIO_SNIPPET_MAX = 140;

function bioSnippet(bio?: string | null): string | null {
  const t = String(bio ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return null;
  if (t.length <= BIO_SNIPPET_MAX) return t;
  return `${t.slice(0, BIO_SNIPPET_MAX - 1)}…`;
}

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
  patient?: Pick<User, 'id' | 'name' | 'publicId' | 'bio' | 'city'> | null;
  patientName?: string | null;
  ownerShareCoins?: number;
}): string {
  const coins =
    opts.ownerShareCoins != null && Number.isFinite(opts.ownerShareCoins)
      ? Math.max(1, Math.floor(opts.ownerShareCoins))
      : SEEKER_OWNER_SHARE;
  const patient = opts.patient;
  const who = (patient?.name ?? opts.patientName)?.trim() || null;
  const publicId = patient
    ? userPublicIdOf({ id: patient.id, publicId: patient.publicId })
    : null;
  const bio = bioSnippet(patient?.bio);
  const city = patient?.city?.trim() || null;

  return [
    '💬 <b>درخواست راهنمایی از صاحب پت</b>',
    '',
    `یک نفر می‌خواد باهات صحبت کنه و در مورد خرید و نگهداری پت راهنمایی می‌خواد؛ بابت این راهنمایی <b>${coins}</b> سکه دریافت می‌کنی.`,
    '',
    '👤 <b>پروفایل درخواست‌کننده</b>',
    who ? `نام: <b>${escapeHtml(who)}</b>` : 'نام: —',
    publicId ? `شناسه: <code>${escapeHtml(publicId)}</code>` : null,
    city ? `شهر: ${escapeHtml(city)}` : null,
    bio ? `بیو: ${escapeHtml(bio)}` : null,
    '',
    'اگر آماده‌ای قبول کن؛ منتظر پاسخته.',
    'قبول از ربات یا از وب → چت برای هر دو طرف فعال می‌شود.',
  ]
    .filter((line) => line != null)
    .join('\n');
}

function acceptRejectKeyboard(consultId: number, withSeekerProfile: boolean) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [
    [
      { text: '✅ قبول', callback_data: `vet:consult:accept:${consultId}` },
      { text: '❌ رد', callback_data: `vet:consult:reject:${consultId}` },
    ],
  ];
  if (withSeekerProfile) {
    rows.push([
      {
        text: '👤 مشاهده پروفایل درخواست‌کننده',
        callback_data: `vet:consult:patient:${consultId}`,
      },
    ]);
  }
  return { inline_keyboard: rows };
}

/**
 * Notify online provider on Telegram when a quick-consult request is created
 * (same payload + accept/reject callbacks as bot handleQuickVetConnect).
 * Vet copy keeps «ویزیت»; seeker_advice uses personal guidance copy (no visit wording)
 * and embeds the requester profile + open-profile action.
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
      patient,
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

  const reply_markup = acceptRejectKeyboard(
    consult.id,
    serviceKind === 'seeker_advice'
  );

  // Prefer avatar photo for seeker_advice when Telegram file_id is stored.
  if (serviceKind === 'seeker_advice') {
    const avatar = String(patient.avatarUrl || '').trim();
    const looksLikeTelegramFileId =
      Boolean(avatar) &&
      !/^https?:\/\//i.test(avatar) &&
      !avatar.startsWith('/') &&
      avatar.length >= 16;
    if (looksLikeTelegramFileId) {
      const photoOk = await telegramCall('sendPhoto', {
        chat_id: vetTg,
        photo: avatar,
        caption: text.slice(0, 1024),
        parse_mode: 'HTML',
        reply_markup,
      });
      if (photoOk) return true;
    }
  }

  return telegramCall('sendMessage', {
    chat_id: vetTg,
    text,
    parse_mode: 'HTML',
    reply_markup,
  });
}
