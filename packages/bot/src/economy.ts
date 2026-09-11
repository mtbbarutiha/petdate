/** اقتصاد سکه petdate — هم‌تراز با مدل دوردوریا */

export {
  SIGNUP_BONUS,
  PROFILE_SECTION_REWARD,
  FACE_VERIFY_REWARD,
  COIN_REASON,
  PROFILE_REWARD_SECTIONS,
  PROFILE_SECTION_LABELS_FA,
  QUICK_VET_COST,
  formatCoinAwardMessage,
} from '@petdate/shared';
export type { CoinAward, ProfileRewardSection } from '@petdate/shared';

import {
  COIN_PRICE_STARS as SHARED_COIN_PRICE_STARS,
  COIN_PRICE_TOMAN as SHARED_COIN_PRICE_TOMAN,
  COIN_SELL_PRICE_TOMAN as SHARED_COIN_SELL_PRICE_TOMAN,
  COIN_PACKAGES as SHARED_COIN_PACKAGES,
  MIN_SELL_COINS as SHARED_MIN_SELL_COINS,
  REFERRAL_BONUS_COINS as SHARED_REFERRAL_BONUS_COINS,
  sellAmountToman as sharedSellAmountToman,
  normalizeCardNumber as sharedNormalizeCardNumber,
  validateIranCard as sharedValidateIranCard,
  formatCardGrouped as sharedFormatCardGrouped,
  type CoinPackage as SharedCoinPackage,
} from '@petdate/shared';

export const COIN_PRICE_TOMAN = SHARED_COIN_PRICE_TOMAN;
export const COIN_PRICE_STARS = SHARED_COIN_PRICE_STARS;
export const COIN_SELL_PRICE_TOMAN = SHARED_COIN_SELL_PRICE_TOMAN;
export const MIN_SELL_COINS = SHARED_MIN_SELL_COINS;
export const DAILY_COIN_REWARD = 10;
/** جایزه دعوت دوست — از shared */
export const REFERRAL_BONUS_COINS = SHARED_REFERRAL_BONUS_COINS;
/** @deprecated استفاده از SIGNUP_BONUS */
export const WELCOME_COINS = 20;

export type CoinPackage = SharedCoinPackage;

/** پکیج سکه — منبع واحد shared */
export const COIN_PACKAGES: CoinPackage[] = SHARED_COIN_PACKAGES;

export function formatNum(n: number): string {
  return new Intl.NumberFormat('fa-IR').format(n);
}

export function formatToman(n: number): string {
  return `${formatNum(n)} تومان`;
}

export function sellAmountToman(coins: number, rate = COIN_SELL_PRICE_TOMAN): number {
  return sharedSellAmountToman(coins, rate);
}

export function packagePickerLabel(p: CoinPackage): string {
  if (p.vip) {
    return `👑 VIP · ${formatNum(p.coins)} سکه · ⭐${formatNum(p.stars)} · ${formatNum(p.toman)}ت`;
  }
  return `💰 ${formatNum(p.coins)} سکه · ⭐${formatNum(p.stars)} · ${formatNum(p.toman)}ت`;
}

export function coinsShopIntroText(balance: number, starsBalance = 0): string {
  return [
    '💰 <b>سکه‌ها و ستاره‌ها</b>',
    '',
    `🪙 موجودی سکه پنل پت‌دیت: <b>${formatNum(balance)}</b>`,
    `⭐ موجودی ستاره پنل پت‌دیت (خریداری‌شده): <b>${formatNum(starsBalance)}</b>`,
    '📱 موجودی Stars شما در تلگرام: فقط داخل خود اپ تلگرام دیده می‌شود (ربات عدد آن را نمی‌خواند).',
    '',
    `قیمت هر سکه: ${formatNum(COIN_PRICE_TOMAN)} تومان یا ${formatNum(COIN_PRICE_STARS)} Star`,
    `نرخ فروشگاه: هر Star ≈ ${formatNum(COIN_PRICE_TOMAN)} تومان`,
    `🎁 هر روز ${formatNum(DAILY_COIN_REWARD)} سکه رایگان — دکمه بالای لیست`,
    `🎁 دعوت دوستان: هر ثبت‌نام از لینک تو → ${formatNum(REFERRAL_BONUS_COINS)} سکه`,
    '',
    'بسته را بزن → پرداخت با ستاره یا کارت به کارت',
  ].join('\n');
}

export function packageCheckoutText(p: CoinPackage): string {
  if (p.vip) {
    return [
      '👑━━━━━━━━━━━━━━👑',
      '         VIP',
      '👑━━━━━━━━━━━━━━👑',
      '',
      `💎 ${formatNum(p.coins)} سکه`,
      `⭐ پرداخت با ستاره: ${formatNum(p.stars)} (هر سکه ${formatNum(COIN_PRICE_STARS)} Star)`,
      `💳 کارت به کارت: ${formatToman(p.toman)} (هر سکه ${formatNum(COIN_PRICE_TOMAN)} تومان)`,
      '',
      'روش پرداخت را انتخاب کن:',
    ].join('\n');
  }
  return [
    '💰 <b>خرید سکه</b>',
    '',
    `بسته: ${formatNum(p.coins)} سکه`,
    `⭐ پرداخت با ستاره: ${formatNum(p.stars)} (هر سکه ${formatNum(COIN_PRICE_STARS)} Star)`,
    `💳 کارت به کارت: ${formatToman(p.toman)} (هر سکه ${formatNum(COIN_PRICE_TOMAN)} تومان)`,
    '',
    'روش پرداخت را انتخاب کن:',
  ].join('\n');
}

export function earnIntroText(balance: number): string {
  const toman = sellAmountToman(balance);
  return [
    '💵 <b>کسب درآمد — فروش سکه</b>',
    '',
    `موجودی تو: <b>${formatNum(balance)}</b> سکه`,
    `نرخ فروش: هر سکه ${formatNum(COIN_SELL_PRICE_TOMAN)} تومان`,
    `ارزش موجودی ≈ <b>${formatToman(toman)}</b>`,
    `حداقل برای فروش: ${formatNum(MIN_SELL_COINS)} سکه`,
    '',
    'دکمه فروش را بزن → تأیید مبلغ → شماره کارت بانکی را بفرست.',
    'پرداخت بعد از بررسی ادمین انجام می‌شود.',
  ].join('\n');
}

/** آیا امروز (UTC) سکه روزانه گرفته؟ */
export function canClaimDaily(lastDailyCoinAt?: string | null): boolean {
  if (!lastDailyCoinAt) return true;
  const last = new Date(lastDailyCoinAt);
  if (Number.isNaN(last.getTime())) return true;
  const now = new Date();
  return (
    last.getUTCFullYear() !== now.getUTCFullYear() ||
    last.getUTCMonth() !== now.getUTCMonth() ||
    last.getUTCDate() !== now.getUTCDate()
  );
}

export const normalizeCardNumber = sharedNormalizeCardNumber;
export const validateIranCard = sharedValidateIranCard;
export const formatCardGrouped = sharedFormatCardGrouped;

/** جزئیات کارت واریز خرید سکه (از env با fallback) */
export function paymentCardInfo(): { number: string; holder: string; display: string } {
  const number = (
    process.env.PAYMENT_CARD_NUMBER ||
    '62198611052407631'
  ).replace(/\s+/g, '');
  const holder = process.env.PAYMENT_CARD_HOLDER || 'محمد تقی باروتیها';
  return { number, holder, display: formatCardGrouped(number) };
}

export function cardPaymentInstructionsText(p: CoinPackage): string {
  const card = paymentCardInfo();
  return [
    '💳 <b>پرداخت کارت‌به‌کارت</b>',
    '',
    `بسته: <b>${formatNum(p.coins)}</b> سکه`,
    `مبلغ واریز: <b>${formatToman(p.toman)}</b>`,
    '',
    'به این کارت واریز کن:',
    `🔢 شماره کارت: <code>${card.number}</code>`,
    `👤 به‌نام: <b>${card.holder}</b>`,
    '',
    'بعد از واریز:',
    '۱) دکمه <b>📤 ارسال فیش</b> را بزن',
    '۲) <b>عکس رسید کارت‌به‌کارت</b> را همین‌جا بفرست',
    '',
    'بعد از تأیید ادمین، سکه‌ها به موجودی‌ات اضافه می‌شود.',
  ].join('\n');
}
