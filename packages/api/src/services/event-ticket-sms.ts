/**
 * Event ticket SMS — short Persian body with public ticket link (Candoo).
 */
import { formatIranMobileDisplay, normalizeIranMobile, SITE } from '@petdate/shared';
import { eventTicketPublicUrl } from '@petdate/shared';
import { candooSendWithSrcFallback, isCandooConfigured } from './candoo';

export function formatEventTicketSms(opts: {
  eventTitle: string;
  ticketUrl: string;
}): string {
  const title = String(opts.eventTitle || 'ایونت پت‌دیت').trim().slice(0, 48);
  const url = String(opts.ticketUrl || '').trim();
  return ['پت‌دیت', `بلیط ایونت «${title}»`, 'مشاهده بلیط:', url].join('\n');
}

export type SendEventTicketSmsResult =
  | { ok: true; sent: true; phone: string; body: string }
  | { ok: true; sent: false; skipped: true; reason: string; body?: string; phone?: string }
  | { ok: true; sent: false; failed: true; reason: string; phone?: string; body: string };

export async function sendEventTicketSms(opts: {
  rawPhone?: string | null;
  eventTitle: string;
  ticketCode: string;
  origin?: string;
  customerId?: number;
}): Promise<SendEventTicketSmsResult> {
  const ticketUrl = eventTicketPublicUrl(opts.ticketCode, opts.origin || SITE.origin);
  const body = formatEventTicketSms({ eventTitle: opts.eventTitle, ticketUrl });
  const raw = String(opts.rawPhone || '').trim();
  if (!raw) {
    return {
      ok: true,
      sent: false,
      skipped: true,
      reason: 'شماره موبایل ثبت نشده',
      body,
    };
  }
  const recipient = normalizeIranMobile(raw);
  if (!recipient) {
    return {
      ok: true,
      sent: false,
      skipped: true,
      reason: 'شماره موبایل نامعتبر است',
      body,
    };
  }
  const phone = formatIranMobileDisplay(recipient);
  if (!isCandooConfigured()) {
    return {
      ok: true,
      sent: false,
      skipped: true,
      reason: 'سرویس پیامک پیکربندی نشده',
      phone,
      body,
    };
  }
  try {
    let sent = await candooSendWithSrcFallback({
      recipient,
      body,
      type: 0,
      ...(opts.customerId != null ? { customerId: opts.customerId } : {}),
    });
    if (!sent.ok) {
      await new Promise((r) => setTimeout(r, 500));
      sent = await candooSendWithSrcFallback({
        recipient,
        body,
        type: 0,
        ...(opts.customerId != null ? { customerId: opts.customerId } : {}),
      });
    }
    if (sent.ok) {
      return { ok: true, sent: true, phone, body };
    }
    console.warn('event-ticket SMS failed:', sent.error, 'src=', sent.srcNum);
    return {
      ok: true,
      sent: false,
      failed: true,
      reason: sent.error || 'ارسال پیامک ناموفق بود',
      phone,
      body,
    };
  } catch (err) {
    console.error('event-ticket SMS exception:', err);
    return {
      ok: true,
      sent: false,
      failed: true,
      reason: 'خطا در ارسال پیامک',
      phone,
      body,
    };
  }
}
