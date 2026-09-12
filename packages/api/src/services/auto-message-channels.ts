/**
 * Automatic-message channel adapters (SMS / Telegram / WhatsApp + register hook).
 * WhatsApp is exposed but not wired — never reports a fake send.
 */
import {
  AUTO_MESSAGE_CHANNEL_LABELS,
  AUTO_MESSAGE_CHANNEL_UNREADY,
  AUTO_MESSAGE_CHANNELS,
  type AutoMessageChannel,
} from '@petdate/shared';
import { formatIranMobileDisplay, normalizeIranMobile } from '@petdate/shared';
import { infra } from '../config/infra';
import { candooSendWithSrcFallback, isCandooConfigured } from './candoo';

export type AutoMessageChannelStatus = {
  id: AutoMessageChannel | string;
  label: string;
  ready: boolean;
  reason?: string;
};

export type AutoMessageChannelDelivery = {
  channel: string;
  sent: boolean;
  skipped?: boolean;
  reason?: string;
};

export type AutoMessageSendCtx = {
  text: string;
  customer: {
    mobile?: string | null;
    platformUserId?: number | null;
  };
};

export type AutoMessageChannelAdapter = {
  id: string;
  label: string;
  status: () => { ready: boolean; reason?: string };
  send: (ctx: AutoMessageSendCtx) => Promise<AutoMessageChannelDelivery>;
};

const extraAdapters = new Map<string, AutoMessageChannelAdapter>();

/** Extension point: register another delivery channel (email, push, …). */
export function registerAutoMessageChannel(adapter: AutoMessageChannelAdapter): void {
  extraAdapters.set(adapter.id, adapter);
}

export function unregisterAutoMessageChannel(id: string): void {
  extraAdapters.delete(id);
}

function smsStatus(): { ready: boolean; reason?: string } {
  return isCandooConfigured()
    ? { ready: true }
    : { ready: false, reason: 'سرویس پیامک پیکربندی نشده' };
}

function telegramStatus(): { ready: boolean; reason?: string } {
  return infra.telegram.botToken
    ? { ready: true }
    : { ready: false, reason: 'ربات تلگرام پیکربندی نشده' };
}

function whatsappStatus(): { ready: boolean; reason?: string } {
  return AUTO_MESSAGE_CHANNEL_UNREADY.whatsapp ?? {
    ready: false,
    reason: 'واتساپ هنوز به پنل متصل نشده',
  };
}

const builtins: Record<AutoMessageChannel, AutoMessageChannelAdapter> = {
  sms: {
    id: 'sms',
    label: AUTO_MESSAGE_CHANNEL_LABELS.sms,
    status: smsStatus,
    send: sendSmsChannel,
  },
  telegram: {
    id: 'telegram',
    label: AUTO_MESSAGE_CHANNEL_LABELS.telegram,
    status: telegramStatus,
    send: sendTelegramChannel,
  },
  whatsapp: {
    id: 'whatsapp',
    label: AUTO_MESSAGE_CHANNEL_LABELS.whatsapp,
    status: whatsappStatus,
    send: sendWhatsAppChannel,
  },
};

export function getAutoMessageChannelAdapter(id: string): AutoMessageChannelAdapter | undefined {
  if (id in builtins) return builtins[id as AutoMessageChannel];
  return extraAdapters.get(id);
}

export function listAutoMessageChannelStatus(): AutoMessageChannelStatus[] {
  const seen = new Set<string>();
  const out: AutoMessageChannelStatus[] = [];
  for (const id of AUTO_MESSAGE_CHANNELS) {
    const adapter = builtins[id];
    const st = adapter.status();
    seen.add(id);
    out.push({ id, label: adapter.label, ready: st.ready, reason: st.reason });
  }
  for (const adapter of extraAdapters.values()) {
    if (seen.has(adapter.id)) continue;
    const st = adapter.status();
    out.push({ id: adapter.id, label: adapter.label, ready: st.ready, reason: st.reason });
  }
  return out;
}

async function sendSmsChannel(ctx: AutoMessageSendCtx): Promise<AutoMessageChannelDelivery> {
  if (!isCandooConfigured()) {
    return { channel: 'sms', sent: false, skipped: true, reason: 'سرویس پیامک پیکربندی نشده' };
  }
  if (!ctx.customer.mobile) {
    return { channel: 'sms', sent: false, skipped: true, reason: 'شماره موبایل ثبت نشده' };
  }
  const recipient = normalizeIranMobile(ctx.customer.mobile);
  if (!recipient) {
    return { channel: 'sms', sent: false, skipped: true, reason: 'شماره موبایل نامعتبر است' };
  }
  try {
    const sent = await candooSendWithSrcFallback({
      recipient,
      body: ctx.text,
      customerId: ctx.customer.platformUserId ?? undefined,
      type: 0,
    });
    if (sent.ok) {
      return { channel: 'sms', sent: true, reason: formatIranMobileDisplay(recipient) };
    }
    return { channel: 'sms', sent: false, skipped: true, reason: sent.error || 'ارسال پیامک ناموفق بود' };
  } catch (err) {
    console.error('auto-message SMS failed:', err);
    return { channel: 'sms', sent: false, skipped: true, reason: 'خطا در ارسال پیامک' };
  }
}

async function sendTelegramChannel(ctx: AutoMessageSendCtx): Promise<AutoMessageChannelDelivery> {
  if (!infra.telegram.botToken) {
    return { channel: 'telegram', sent: false, skipped: true, reason: 'ربات تلگرام پیکربندی نشده' };
  }
  const { resolvePlatformUser, sendUserTelegramText } = await import('./ticket-user-notify');
  const user = resolvePlatformUser({
    platformUserId: ctx.customer.platformUserId,
    customerMobile: ctx.customer.mobile,
  });
  if (!user?.telegramId) {
    return { channel: 'telegram', sent: false, skipped: true, reason: 'تلگرام کاربر متصل نیست' };
  }
  const ok = await sendUserTelegramText(user.telegramId, ctx.text);
  if (ok) return { channel: 'telegram', sent: true };
  return { channel: 'telegram', sent: false, skipped: true, reason: 'ارسال تلگرام ناموفق بود' };
}

async function sendWhatsAppChannel(_ctx: AutoMessageSendCtx): Promise<AutoMessageChannelDelivery> {
  const st = whatsappStatus();
  return { channel: 'whatsapp', sent: false, skipped: true, reason: st.reason };
}

export async function deliverSelectedChannels(
  channels: string[],
  ctx: AutoMessageSendCtx
): Promise<AutoMessageChannelDelivery[]> {
  const results: AutoMessageChannelDelivery[] = [];
  for (const id of channels) {
    const adapter = getAutoMessageChannelAdapter(id);
    if (!adapter) {
      results.push({
        channel: id,
        sent: false,
        skipped: true,
        reason: 'کانال پشتیبانی نمی‌شود',
      });
      continue;
    }
    results.push(await adapter.send(ctx));
  }
  return results;
}

export function smsDeliveryFromChannels(
  results: AutoMessageChannelDelivery[]
): { sent: true; phone: string } | { sent: false; skipped: true; reason: string } {
  const sms = results.find((r) => r.channel === 'sms');
  if (sms?.sent) return { sent: true, phone: sms.reason || '' };
  if (sms) return { sent: false, skipped: true, reason: sms.reason || 'ارسال پیامک انجام نشد' };
  const anySent = results.find((r) => r.sent);
  if (anySent) return { sent: true, phone: '' };
  const first = results[0];
  return { sent: false, skipped: true, reason: first?.reason || 'هیچ کانالی ارسال نشد' };
}
