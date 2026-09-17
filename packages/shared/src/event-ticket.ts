/**
 * Event (games) join tickets — public codes like PD-KRJ-2026-000154.
 */
import { SITE } from './brand';

export const EVENT_TICKET_PUBLIC_ID_PREFIX = 'PD';

export type EventTicketStatus = 'valid' | 'used' | 'cancelled' | 'expired';

export type EventTicketSummary = {
  id: number;
  ticketCode: string;
  userId: number;
  gameId: number;
  petId?: number | null;
  qrPayload: string;
  status: EventTicketStatus;
  expiresAt?: string | null;
  smsSentAt?: string | null;
  createdAt: string;
  /** Public path e.g. /t/PD-KRJ-2026-000154 */
  publicPath: string;
  /** Absolute URL for SMS */
  publicUrl: string;
  /** Whether the ticket is still usable for entry */
  isValid: boolean;
};

export type EventTicketPublicView = EventTicketSummary & {
  eventTitle: string;
  eventScheduledAt: string;
  eventLocation: string;
  eventProvince?: string;
  eventCity?: string;
  eventPhotoUrl?: string;
  currentPlayers: number;
  maxPlayers: number;
  ownerName: string;
  petName?: string;
  petSpecies?: string;
  petSpeciesLabel?: string;
  petImageUrl?: string;
  ticketTypeLabel: string;
};

/** Common Iranian city → short Latin codes for ticket IDs. */
const CITY_CODES: Record<string, string> = {
  کرج: 'KRJ',
  تهران: 'THR',
  اصفهان: 'ISF',
  شیراز: 'SHZ',
  مشهد: 'MSH',
  تبریز: 'TBZ',
  اهواز: 'AHW',
  قم: 'QOM',
  کرمان: 'KER',
  یزد: 'YZD',
  رشت: 'RST',
  ساری: 'SAR',
  ارومیه: 'URM',
  همدان: 'HMD',
  کرمانشاه: 'KSH',
  زاهدان: 'ZAH',
  بندرعباس: 'BND',
  بوشهر: 'BSH',
  اراک: 'ARK',
  قزوین: 'QZV',
  زنجان: 'ZJN',
  سنندج: 'SNJ',
  گرگان: 'GRG',
  اردبیل: 'ARD',
  خرمآباد: 'KRB',
  'خرم آباد': 'KRB',
  ایلام: 'ILM',
  یاسوج: 'YSJ',
  شهرکرد: 'SKD',
  بجنورد: 'BJN',
  بیرجند: 'BRJ',
  سمنان: 'SMN',
};

export function eventCityTicketCode(city?: string | null, province?: string | null): string {
  const c = String(city || '').trim();
  if (c && CITY_CODES[c]) return CITY_CODES[c];
  const p = String(province || '').trim();
  if (p && CITY_CODES[p]) return CITY_CODES[p];
  // Latin fallback from first letters
  const ascii = c
    .normalize('NFKD')
    .replace(/[^\w]/g, '')
    .toUpperCase();
  if (ascii.length >= 3) return ascii.slice(0, 3);
  return 'EVT';
}

export function padTicketSeq(n: number, width = 6): string {
  const id = Math.max(0, Math.floor(Number(n) || 0));
  return String(id).padStart(width, '0');
}

/**
 * Build display code: PD-{CITY}-{YEAR}-{SEQ}
 * Example: PD-KRJ-2026-000154
 */
export function makeEventTicketCode(opts: {
  id: number;
  city?: string | null;
  province?: string | null;
  scheduledAt?: string | null;
}): string {
  const city = eventCityTicketCode(opts.city, opts.province);
  let year = new Date().getFullYear();
  if (opts.scheduledAt) {
    const d = new Date(
      opts.scheduledAt.includes('T') ? opts.scheduledAt : opts.scheduledAt.replace(' ', 'T')
    );
    if (Number.isFinite(d.getTime())) year = d.getFullYear();
  }
  return `${EVENT_TICKET_PUBLIC_ID_PREFIX}-${city}-${year}-${padTicketSeq(opts.id)}`;
}

export function normalizeEventTicketCode(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  if (!s) return null;
  const m = /^PD-[A-Z]{2,4}-\d{4}-\d{1,8}$/.exec(s);
  if (!m) return null;
  const parts = s.split('-');
  const seq = padTicketSeq(Number(parts[3]), 6);
  return `PD-${parts[1]}-${parts[2]}-${seq}`;
}

export function eventTicketPublicPath(code: string): string {
  return `/t/${encodeURIComponent(String(code).trim())}`;
}

export function eventTicketPublicUrl(code: string, origin?: string): string {
  const base = String(origin || SITE.origin).replace(/\/$/, '');
  return `${base}${eventTicketPublicPath(code)}`;
}

/** Ticket stays valid while status is valid and event has not ended. */
export function isEventTicketCurrentlyValid(opts: {
  status: string;
  expiresAt?: string | null;
  gameStatus?: string | null;
  scheduledAt?: string | null;
  nowMs?: number;
}): boolean {
  const status = String(opts.status || '').trim().toLowerCase();
  if (status !== 'valid') return false;
  const gameStatus = String(opts.gameStatus || '').trim().toLowerCase();
  if (gameStatus === 'cancelled' || gameStatus === 'completed') return false;
  const now = opts.nowMs ?? Date.now();
  if (opts.expiresAt) {
    const exp = Date.parse(
      opts.expiresAt.includes('T') ? opts.expiresAt : opts.expiresAt.replace(' ', 'T')
    );
    if (Number.isFinite(exp) && exp < now) return false;
  }
  if (opts.scheduledAt) {
    const start = Date.parse(
      opts.scheduledAt.includes('T') ? opts.scheduledAt : opts.scheduledAt.replace(' ', 'T')
    );
    // Grace: valid until 18h after scheduled start
    if (Number.isFinite(start) && start + 18 * 60 * 60 * 1000 < now) return false;
  }
  return true;
}

export function eventTicketExpiresAtIso(scheduledAt: string): string {
  const start = Date.parse(
    scheduledAt.includes('T') ? scheduledAt : scheduledAt.replace(' ', 'T')
  );
  const ms = Number.isFinite(start) ? start + 18 * 60 * 60 * 1000 : Date.now() + 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

export const EVENT_TICKET_TYPE_LABEL_FA = '۱ صاحب + ۱ پت';
export const EVENT_TICKET_EXCLUSIVE_BADGE_FA = 'دعوت‌نامه اختصاصی';
export const EVENT_TICKET_YOURS_FA = 'این بلیط مختص شماست';
export const EVENT_TICKET_SCAN_FA = 'لطفاً هنگام ورود QR را اسکن کنید';
export const EVENT_TICKET_CTA_FA = 'آماده بازی؟ آماده دوست جدید؟';
export const EVENT_TICKET_FRIENDSHIP_FA = 'دوستی از اینجا شروع میشه...';
