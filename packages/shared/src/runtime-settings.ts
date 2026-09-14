/**
 * Public platform runtime flags + announcements.
 * Admin writes these via /api/admin/settings and /api/admin/content/announcements.
 * Site and bot must honor the same keys — never treat Settings toggles as decoration.
 */
export const RUNTIME_FLAG_KEYS = [
  'shopEnabled',
  'playdatesEnabled',
  'vetConsultEnabled',
  'botForceJoin',
  'paymentCardEnabled',
  'paymentStarsEnabled',
  'maintenanceMode',
] as const;

export type RuntimeFlagKey = (typeof RUNTIME_FLAG_KEYS)[number];

export const RUNTIME_FLAG_DEFAULTS: Record<RuntimeFlagKey, boolean> = {
  shopEnabled: true,
  playdatesEnabled: true,
  vetConsultEnabled: true,
  botForceJoin: true,
  paymentCardEnabled: true,
  paymentStarsEnabled: true,
  maintenanceMode: false,
};

export type PublicAnnouncement = {
  id: number;
  title: string;
  body: string;
  placement: string;
};

/** Public deposit card for card-to-card checkout (null when not configured). */
export type PublicPaymentCardInfo = {
  cardNumber: string;
  cardMasked: string;
  cardGrouped: string;
  cardHolder: string;
};

export type PublicPlatformConfig = Record<RuntimeFlagKey, boolean> & {
  announcements: PublicAnnouncement[];
  /** True when PAYMENT_CARD_* env resolves to a usable destination. */
  paymentCardConfigured?: boolean;
  paymentCard?: PublicPaymentCardInfo | null;
  paymentCardError?: string;
};

export const ANNOUNCEMENT_PLACEMENTS = ['landing', 'shop', 'app', 'bot'] as const;
export type AnnouncementPlacement = (typeof ANNOUNCEMENT_PLACEMENTS)[number];

export function isTruthySetting(value: string | undefined | null, defaultOn: boolean): boolean {
  if (value == null || String(value).trim() === '') return defaultOn;
  return !/^(0|false|off|no|disabled|-)$/i.test(String(value).trim());
}

export function announcementsForPlacement(
  items: PublicAnnouncement[],
  placement: AnnouncementPlacement | 'any'
): PublicAnnouncement[] {
  if (placement === 'any') return items;
  return items.filter((a) => a.placement === placement || a.placement === 'app');
}
