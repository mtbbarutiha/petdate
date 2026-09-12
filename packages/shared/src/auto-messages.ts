/**
 * Automatic messages — system-driven templates (SMS / Telegram / WhatsApp / …).
 * Catalog defaults ship in code; admin edits persist as overrides.
 */

export const AUTO_MESSAGE_CHANNELS = ['sms', 'telegram', 'whatsapp'] as const;
export type AutoMessageChannel = (typeof AUTO_MESSAGE_CHANNELS)[number];

export const AUTO_MESSAGE_CHANNEL_LABELS: Record<AutoMessageChannel, string> = {
  sms: 'پیامک',
  telegram: 'تلگرام',
  whatsapp: 'واتساپ',
};

/** Built-in channel that is not ready to send (honest admin copy). */
export const AUTO_MESSAGE_CHANNEL_UNREADY: Partial<
  Record<AutoMessageChannel, { ready: false; reason: string }>
> = {
  whatsapp: { ready: false, reason: 'واتساپ هنوز به پنل متصل نشده' },
};

export type AutoMessageTrigger =
  | 'after_purchase'
  | 'ticket_created'
  | 'ticket_resolved'
  | 'ticket_reply'
  | 'survey_done'
  | 'sla_breach'
  | 'manual';

export type AutoMessageCatalogEntry = {
  key: string;
  name: string;
  text: string;
  trigger: AutoMessageTrigger;
  auto: boolean;
  active: boolean;
  type: 'dynamic' | 'static';
  channels: AutoMessageChannel[];
};

/**
 * Default system automatic messages. Appear in admin even before customization.
 * Edits persist in crm_sms_patterns and override these defaults.
 */
export const AUTO_MESSAGE_CATALOG: readonly AutoMessageCatalogEntry[] = [
  {
    key: 'after_purchase',
    name: 'خوش‌آمدگویی پس از خرید',
    text: '{نام} عزیز، از خرید {محصول} در Pet Date سپاسگزاریم.',
    trigger: 'after_purchase',
    auto: true,
    active: true,
    type: 'dynamic',
    channels: ['sms', 'telegram'],
  },
  {
    key: 'ticket_created',
    name: 'ایجاد تیکت',
    text: '{نام} عزیز، تیکت {شناسه} ثبت شد و در حال پیگیری است.',
    trigger: 'ticket_created',
    auto: true,
    active: true,
    type: 'dynamic',
    channels: ['sms', 'telegram'],
  },
  {
    key: 'ticket_resolved',
    name: 'حل تیکت',
    text: '{نام} عزیز، تیکت {شناسه} حل شد. از همراهی شما ممنونیم.',
    trigger: 'ticket_resolved',
    auto: true,
    active: true,
    type: 'dynamic',
    channels: ['sms', 'telegram'],
  },
  {
    key: 'ticket_reply',
    name: 'پاسخ تیکت',
    text: '{نام} عزیز، پاسخ تیکت {شناسه}: {پاسخ}',
    trigger: 'ticket_reply',
    auto: true,
    active: true,
    type: 'dynamic',
    channels: ['sms', 'telegram'],
  },
  {
    key: 'survey_done',
    name: 'نظرسنجی تجربه',
    text: '{نام} عزیز، لطفاً تجربه تماس با {کارشناس} را امتیاز دهید.',
    trigger: 'survey_done',
    auto: true,
    active: true,
    type: 'dynamic',
    channels: ['sms', 'telegram'],
  },
  {
    key: 'sla_breach',
    name: 'پیگیری نقض SLA',
    text: 'تیکت {شناسه} از زمان SLA عبور کرد — اقدام فوری لازم است.',
    trigger: 'sla_breach',
    auto: true,
    active: true,
    type: 'dynamic',
    channels: ['sms', 'telegram'],
  },
] as const;

/** Legacy seed titles — used only to rename untouched defaults to the catalog names. */
export const AUTO_MESSAGE_LEGACY_SEED_NAMES: Record<string, string> = {
  after_purchase: 'تشکر پس از خرید',
  ticket_created: 'ثبت تیکت',
  ticket_resolved: 'اعلام حل مشکل',
  ticket_reply: 'پاسخ تیکت',
  survey_done: 'دعوت به نظرسنجی',
  sla_breach: 'پیگیری نقض SLA',
};

export function isAutoMessageChannel(value: unknown): value is AutoMessageChannel {
  return AUTO_MESSAGE_CHANNELS.includes(value as AutoMessageChannel);
}

export function parseAutoMessageChannels(raw: unknown): AutoMessageChannel[] {
  if (Array.isArray(raw)) {
    const seen = new Set<AutoMessageChannel>();
    const out: AutoMessageChannel[] = [];
    for (const item of raw) {
      if (isAutoMessageChannel(item) && !seen.has(item)) {
        seen.add(item);
        out.push(item);
      }
    }
    return out.length ? out : ['sms'];
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed) {
      try {
        return parseAutoMessageChannels(JSON.parse(trimmed));
      } catch {
        const parts = trimmed
          .split(/[,|]/)
          .map((p) => p.trim().toLowerCase())
          .filter(isAutoMessageChannel);
        if (parts.length) return [...new Set(parts)];
      }
    }
  }
  return ['sms'];
}

export function normalizeAutoMessageChannels(raw: unknown): AutoMessageChannel[] {
  return parseAutoMessageChannels(raw);
}

export function autoMessageCatalogByKey(key: string): AutoMessageCatalogEntry | undefined {
  return AUTO_MESSAGE_CATALOG.find((e) => e.key === key);
}

export function autoMessageCatalogByTrigger(trigger: string): AutoMessageCatalogEntry | undefined {
  if (trigger === 'manual') return undefined;
  return AUTO_MESSAGE_CATALOG.find((e) => e.trigger === trigger);
}
