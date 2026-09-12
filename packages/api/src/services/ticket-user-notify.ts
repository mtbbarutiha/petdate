/**
 * Deliver CRM / support public replies to the end user.
 * Channels: web support inbox (support_messages) + Telegram when telegram_id is linked.
 */
import { dbService } from '../db';
import { infra } from '../config/infra';
import { telegramFetch, telegramBotApiUrl } from './telegram-http';
import { usableTelegramId } from './telegram-id';

/** User-supplied PetDate ticket/user UUID — looked up as crm_tickets.uuid (and HR employee uuid). */
export const PETDATE_TICKET_REF_UUID = 'b98ef5d7-2e30-4fca-9854-4cadb3160aee';

const RFC_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRfcUuid(value: string): boolean {
  return RFC_UUID_RE.test(String(value || '').trim());
}

export function formatTicketReplyForUser(opts: {
  ticketPublicId: string;
  ticketTitle?: string;
  replyText: string;
  agentName?: string;
}): string {
  const code = String(opts.ticketPublicId || '').trim() || 'تیکت';
  const title = String(opts.ticketTitle || '').trim();
  const reply = String(opts.replyText || '').trim();
  const agent = String(opts.agentName || '').trim();
  return [
    '🛟 پاسخ پشتیبانی',
    '',
    title ? `تیکت ${code} — ${title}` : `تیکت ${code}`,
    agent ? `از طرف ${agent}` : null,
    '',
    reply,
  ]
    .filter((line) => line != null)
    .join('\n');
}

export async function sendUserTelegramText(chatId: string, text: string): Promise<boolean> {
  if (!infra.telegram.botToken || !usableTelegramId(chatId)) return false;
  const body = String(text || '').trim();
  if (!body) return false;
  try {
    const res = await telegramFetch(telegramBotApiUrl(infra.telegram.botToken, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: body.slice(0, 3900) }),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) {
      console.warn('ticket reply telegram failed:', data.description ?? res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('ticket reply telegram error:', (err as Error).message);
    return false;
  }
}

export function resolvePlatformUser(opts: {
  platformUserId?: number | null;
  customerMobile?: string | null;
}): ReturnType<typeof dbService.getUserById> {
  const id = Number(opts.platformUserId);
  if (Number.isFinite(id) && id > 0) {
    const user = dbService.getUserById(id);
    if (user) return user;
  }
  const mobile = String(opts.customerMobile || '').replace(/\D/g, '');
  if (mobile.length >= 10) {
    const variants = [
      mobile.startsWith('0') ? mobile : `0${mobile}`,
      mobile.startsWith('98') ? `0${mobile.slice(2)}` : `+98${mobile.replace(/^0/, '')}`,
      `+98${mobile.replace(/^0/, '')}`,
    ];
    for (const phone of variants) {
      const row = dbService.getUserByPhone(phone);
      if (row) return row;
    }
  }
  return null;
}

export type TicketReplyDelivery = {
  webInbox: boolean;
  telegram: boolean;
  userId: number | null;
  text: string;
};

export async function deliverTicketPublicReply(opts: {
  ticketPublicId: string;
  ticketTitle?: string;
  replyText: string;
  agentName?: string;
  platformUserId?: number | null;
  customerMobile?: string | null;
}): Promise<TicketReplyDelivery> {
  const text = formatTicketReplyForUser(opts);
  const user = resolvePlatformUser({
    platformUserId: opts.platformUserId,
    customerMobile: opts.customerMobile,
  });
  if (!user) {
    return { webInbox: false, telegram: false, userId: null, text };
  }

  let webInbox = false;
  try {
    dbService.addSupportMessage(user.id, 'assistant', text);
    webInbox = true;
  } catch (err) {
    console.warn('ticket reply web inbox failed:', (err as Error).message);
  }

  let telegram = false;
  if (user.telegramId) {
    telegram = await sendUserTelegramText(user.telegramId, text);
  }

  return { webInbox, telegram, userId: user.id, text };
}

export async function deliverSupportInboxReply(opts: {
  userId: number;
  text: string;
}): Promise<{ telegram: boolean }> {
  const user = dbService.getUserById(opts.userId);
  if (!user?.telegramId) return { telegram: false };
  const text = String(opts.text || '').trim();
  if (!text) return { telegram: false };
  const telegram = await sendUserTelegramText(user.telegramId, text);
  return { telegram };
}
