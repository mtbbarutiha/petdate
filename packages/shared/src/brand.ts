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
  /** Official Mini App short link (BotFather direct-link name: Petdate). */
  telegramMiniApp: 'https://t.me/Petdatebot/Petdate',
  /** Channel username without @ */
  telegramChannel: 'petdating',
  telegramChannelUrl: 'https://t.me/petdating',
  /** Absolute OG / social share image (1200-class landscape). */
  ogImage: 'https://petdate.ir/brand/petdate-banner.jpg',
  /** Square asset from لوگو مادر (full wordmark on soft canvas) for icons / schema. */
  markImage: 'https://petdate.ir/brand/petdate-mark.png',
} as const;

/** SEO / document-head strings — Persian-first, no clinic claims. */
export const SEO = {
  titleDefault: 'پت‌دیت | همبازی برای پت‌ات — PLAY • MEET • FRIENDS',
  titleTemplate: (page: string) => `${page} | پت‌دیت`,
  description:
    'پت‌دیت (PetDate) پلتفرم فارسی پیدا کردن همبازی برای پت، پت‌شاپ، پذیرش پت و مشاوره دامپزشک — روی وب و ربات تلگرام.',
  keywords: 'پت‌دیت, PetDate, همبازی پت, پت شاپ, پذیرش حیوان, مشاوره دامپزشک, سگ, گربه',
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
  /** Profile short bio. Main Mini App (Open App on profile) is BotFather-only — see docs/MAIN_MINI_APP.md */
  shortDescriptionFa: '🐾 پت‌دیت — همبازی برای پت | مینی‌اپ: t.me/Petdatebot/Petdate',
  descriptionFa:
    '🐾 پت‌دیت — پیدا کردن همبازی برای پت، مشاوره دامپزشک و خدمات پت\nPLAY • MEET • FRIENDS\n\nمینی‌اپ: https://t.me/Petdatebot/Petdate',
  /** Channel about / description (Telegram ~255 chars). */
  channelDescriptionFa:
    '🐾 کانال رسمی پت‌دیت\nهمبازی برای پت · PLAY • MEET • FRIENDS\nمینی‌اپ: https://t.me/Petdatebot/Petdate\nربات: @Petdatebot',
  welcomeFa: 'به petdate خوش اومدی — همبازی برای پت‌ات',
  botTitle: 'petdate',
  domain: SITE.domain,
  url: SITE.origin,
  email: SITE.email,
  newsletterEmail: SITE.newsletterEmail,
  /** Menu button label (Telegram MenuButtonWebApp text). */
  menuButtonTextFa: 'پت‌دیت',
} as const;
