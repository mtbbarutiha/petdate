/**
 * After a vet consult is accepted (web or bot patch→active), notify Telegram
 * peers and open bot chat sessions. Must NOT run while status is still requested.
 */
import type { User } from '@petdate/shared';
import { infra } from '../config/infra';
import { activateBotVetChatSessions } from './bot-vet-chat-session';
import { claimWebChatCtaOnce } from './web-chat-cta-once';
import { telegramFetch, telegramBotApiUrl } from './telegram-http';
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
    const res = await telegramFetch(telegramBotApiUrl(token, method), {
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

const VET_CHAT_END = '🔌 بستن چت';
const VET_CHAT_PET = '🐾 پروفایل پت';
const VET_CHAT_MED = '📋 پرونده';
const VET_CHAT_NOTE = '📝 ثبت پرونده';
const VET_CHAT_RX = '💊 نسخه';

function vetKeyboard() {
  return {
    keyboard: [
      [{ text: VET_CHAT_END }],
      [{ text: VET_CHAT_PET }, { text: VET_CHAT_MED }],
      [{ text: VET_CHAT_NOTE }, { text: VET_CHAT_RX }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function patientKeyboard() {
  return {
    keyboard: [[{ text: VET_CHAT_END }]],
    resize_keyboard: true,
    is_persistent: true,
  };
}

/** web-cta-once-v2 — send web hint at most once per consult+telegramId (never from relays). */
async function sendWebCtaOnce(opts: {
  consultId: number;
  telegramId: string;
  webChatUrl: string;
  canInline: boolean;
  webButton?: { inline_keyboard: Array<Array<{ text: string; url: string }>> };
}): Promise<void> {
  const allowed = await claimWebChatCtaOnce('vet', opts.consultId, opts.telegramId);
  if (!allowed) return;
  const text = opts.canInline
    ? '🌐 می‌توانید در وب هم چت کنید — اگر همین‌جا ادامه دهید، پیام‌ها در ربات رد و بدل می‌شوند.'
    : [
        '🌐 می‌توانید در وب هم چت کنید:',
        opts.webChatUrl,
        'اگر همین‌جا ادامه دهید، پیام‌ها در ربات رد و بدل می‌شوند.',
      ].join('\n');
  await telegramCall('sendMessage', {
    chat_id: opts.telegramId,
    text,
    ...(opts.webButton ? { reply_markup: opts.webButton } : {}),
  });
}

/**
 * Open bot vet_chat for both sides + send intros with a one-time web link.
 * Safe to call from web accept and from PATCH status→active (bot accept path
 * also calls startVetChat locally — Redis SETNX prevents duplicate CTAs).
 * Web CTA is mentioned once here; later web→Telegram relays stay silent.
 */
export async function startVetChatFromApi(opts: {
  consultId: number;
  vet: User;
  patient: User;
  /** When true, skip notifying the vet (they already got bot startVetChat). */
  skipVetNotify?: boolean;
}): Promise<boolean> {
  const webBase = infra.web.url.replace(/\/$/, '');
  const webChatUrl = `${webBase}/vet-chats/${opts.consultId}`;
  const canInline = (() => {
    try {
      return new URL(webChatUrl).protocol === 'https:';
    } catch {
      return false;
    }
  })();
  const webButton = canInline
    ? { inline_keyboard: [[{ text: 'ورود به چت وب', url: webChatUrl }]] }
    : undefined;

  await activateBotVetChatSessions({
    consultId: opts.consultId,
    vet: opts.vet,
    patient: opts.patient,
  });

  let anyOk = false;
  const vetTg = normalizeTelegramId(opts.vet.telegramId);
  const patientTg = normalizeTelegramId(opts.patient.telegramId);

  if (vetTg && !opts.skipVetNotify) {
    const vetIntro = [
      '💬 <b>چت با صاحب پت فعال شد</b>',
      '',
      `صاحب پت: <b>${escapeHtml(opts.patient.name)}</b>`,
      'هر پیامی بفرستی مستقیم به صاحب پت می‌رسد.',
    ].join('\n');
    const ok = await telegramCall('sendMessage', {
      chat_id: vetTg,
      text: vetIntro,
      parse_mode: 'HTML',
      reply_markup: vetKeyboard(),
    });
    anyOk = ok || anyOk;
    await sendWebCtaOnce({
      consultId: opts.consultId,
      telegramId: vetTg,
      webChatUrl,
      canInline,
      webButton,
    });
  }

  if (patientTg) {
    const patientIntro = [
      '💬 <b>چت با دامپزشک فعال شد</b>',
      '',
      `پزشک: <b>${escapeHtml(opts.vet.name)}</b>`,
      'هر پیامی بفرستی مستقیم به پزشک می‌رسد.',
      '',
      `پایان چت: ${VET_CHAT_END}`,
    ].join('\n');
    const ok = await telegramCall('sendMessage', {
      chat_id: patientTg,
      text: patientIntro,
      parse_mode: 'HTML',
      reply_markup: patientKeyboard(),
    });
    anyOk = ok || anyOk;
    await sendWebCtaOnce({
      consultId: opts.consultId,
      telegramId: patientTg,
      webChatUrl,
      canInline,
      webButton,
    });
  }

  return anyOk;
}
