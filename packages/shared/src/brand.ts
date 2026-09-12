/** Shared petdate brand copy — bot, web, channel */

/** Canonical public site (CDN + production). Use env overrides only for local/dev. */
export const SITE = {
  domain: 'petdate.ir',
  origin: 'https://petdate.ir',
  wwwOrigin: 'https://www.petdate.ir',
  email: 'hello@petdate.ir',
  /** From identity for newsletter / marketing mail (alias → info@ inbox). */
  newsletterEmail: 'news@petdate.ir',
  telegramBot: 'https://t.me/Petdatebot',
  telegramBotUsername: 'Petdatebot',
  /** Absolute OG / social share image (1200-class landscape). */
  ogImage: 'https://petdate.ir/brand/petdate-banner.jpg',
  /** Square asset from لوگو مادر (full wordmark on soft canvas) for icons / schema. */
  markImage: 'https://petdate.ir/brand/petdate-mark.png',
} as const;

/** SEO / document-head strings — Persian-first, no clinic claims. */
export const SEO = {
  titleDefault: 'پت‌دیت | همبازی پت، پت‌شاپ و دامپزشک آنلاین — PLAY • MEET • FRIENDS',
  titleTemplate: (page: string) => `${page} | پت‌دیت`,
  description:
    'پت‌دیت (PetDate) پلتفرم فارسی همبازی پت در ایران، پت‌شاپ آنلاین، پذیرش حیوان خانگی و مشاوره دامپزشک آنلاین — وب و ربات تلگرام با یک حساب.',
  keywords:
    'پت‌دیت, PetDate, همبازی پت, همبازی سگ, دوستیابی پت, پت شاپ آنلاین, خرید غذای سگ, خرید غذای گربه, پذیرش حیوان خانگی, دامپزشک آنلاین, مشاوره دامپزشک, سگ, گربه',
  siteName: 'پت‌دیت',
  locale: 'fa_IR',
  themeColor: '#5c4d91',
} as const;

export const BRAND = {
  name: 'petdate',
  displayName: 'PET DATE',
  displayNameFa: 'پت‌دیت',
  taglineEn: 'PLAY • MEET • FRIENDS',
  taglineFa: 'همبازی برای پت‌ات',
  shortDescriptionFa: '🐾 petdate — همبازی برای پت | PLAY • MEET • FRIENDS',
  descriptionFa:
    '🐾 petdate — پیدا کردن همبازی برای پت، مشاوره دامپزشک و خدمات پت\nPLAY • MEET • FRIENDS',
  welcomeFa: 'به petdate خوش اومدی — همبازی برای پت‌ات',
  botTitle: 'petdate',
  domain: SITE.domain,
  url: SITE.origin,
  email: SITE.email,
  newsletterEmail: SITE.newsletterEmail,
} as const;

/** کد دعوت پایدار — همان شناسه کاربر (`ref_<id>`)؛ محصول جداگانه‌ای نیست. */
export function inviteReferralCode(userId: number | string): string {
  const id = Math.floor(Number(userId) || 0);
  return `ref_${id > 0 ? id : 0}`;
}

/** مسیر لندینگ وب دعوت (`/invite?ref=<id>`) */
export function inviteWebPath(userId: number | string): string {
  const id = Math.floor(Number(userId) || 0);
  return `/invite?ref=${id > 0 ? id : 0}`;
}

/** لینک دعوت وب (ثبت‌نام سایت یا ربات از همین صفحه) */
export function inviteWebLink(userId: number | string): string {
  return `${SITE.origin}${inviteWebPath(userId)}`;
}

/** لینک دعوت تلگرام برای کاربر (deep link /start=ref_<id>) */
export function inviteTelegramLink(userId: number | string): string {
  const id = Math.floor(Number(userId) || 0);
  return `https://t.me/${SITE.telegramBotUsername}?start=${inviteReferralCode(id)}`;
}

/**
 * Parse invite payload from query/start/code.
 * Accepts `38`, `ref_38`, `?ref=38`, `/invite?ref=38`, full site/t.me URLs.
 */
export function parseReferralRef(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  if (/^\d+$/.test(s)) {
    const id = Number(s);
    return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
  }

  const code = /^ref_(\d+)$/i.exec(s);
  if (code) {
    const id = Number(code[1]);
    return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
  }

  const start = /(?:[?&]start=|\/start(?:\s+|=))(ref_\d+)/i.exec(s);
  if (start) return parseReferralRef(start[1]);

  const qRef = /[?&]ref=(\d+)/i.exec(s);
  if (qRef) return parseReferralRef(qRef[1]);

  return null;
}

/** متن اشتراک‌گذاری دعوت (لینک تلگرام — سازگار با ربات) */
export function inviteShareText(userId: number | string): string {
  const link = inviteTelegramLink(userId);
  return `بیا تو petdate همبازی برای پتت پیدا کن! 🐾\n${BRAND.taglineEn}\n${link}`;
}

/** متن اشتراک لینک وب دعوت */
export function inviteWebShareText(userId: number | string): string {
  const link = inviteWebLink(userId);
  return `بیا تو petdate همبازی برای پتت پیدا کن! 🐾\n${BRAND.taglineEn}\n${link}`;
}

/** لینک t.me/share برای دکمه اشتراک ربات */
export function inviteTelegramShareUrl(userId: number | string): string {
  const link = inviteTelegramLink(userId);
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(inviteShareText(userId))}`;
}

/** لینک t.me/share برای لینک وب دعوت */
export function inviteWebShareUrl(userId: number | string): string {
  const link = inviteWebLink(userId);
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(inviteWebShareText(userId))}`;
}
