/** اقتصاد سکه همبازی — ثابت‌های مشترک API و بات */

/** هزینه پیش‌فرض اتصال سریع به دامپزشک آنلاین (سکه ربات) — هم‌تراز ربات */
export const QUICK_VET_COST = 1;

/** حداقل/حداکثر مبلغ ویزیت قابل تنظیم توسط دامپزشک (سکه) */
export const MIN_VET_VISIT_FEE_COINS = 1;
export const MAX_VET_VISIT_FEE_COINS = 500;

/** نرمال‌سازی مبلغ ویزیت دامپزشک؛ مقدار نامعتبر → پیش‌فرض */
export function normalizeVisitFeeCoins(value: unknown, fallback = QUICK_VET_COST): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) {
    return Math.min(MAX_VET_VISIT_FEE_COINS, Math.max(MIN_VET_VISIT_FEE_COINS, fallback));
  }
  return Math.min(MAX_VET_VISIT_FEE_COINS, Math.max(MIN_VET_VISIT_FEE_COINS, n));
}

/** مبلغ ویزیت مؤثر یک دامپزشک */
export function vetVisitFeeCoins(user: { visitFeeCoins?: number | null } | null | undefined): number {
  return normalizeVisitFeeCoins(user?.visitFeeCoins, QUICK_VET_COST);
}

/**
 * نرخ تبدیل خرید سکه (تومان به‌ازای هر سکه) — هم‌تراز ربات.
 * برای پرداخت فروشگاه با سکه: ceil(قیمت_تومان / این_نرخ).
 */
export const COIN_PRICE_TOMAN = 2_000;

/**
 * قیمت هر سکه به Star در ربات (coins × COIN_PRICE_STARS).
 * هم‌تراز packages/bot economy: هر سکه = ۱ Star.
 */
export const COIN_PRICE_STARS = 1;

/**
 * نرخ تومان به‌ازای هر Star در فروشگاه.
 * از اقتصاد ربات: ۱ Star = ۱ سکه = COIN_PRICE_TOMAN تومان → ۲٬۰۰۰ تومان.
 */
export const STAR_PRICE_TOMAN = Math.floor(COIN_PRICE_TOMAN / COIN_PRICE_STARS);

/**
 * نرخ فروش سکه به تومان (کسب درآمد / درخواست برداشت) — هم‌تراز ربات.
 * خرید: ۲٬۰۰۰ تومان؛ فروش: ۱٬۰۰۰ تومان.
 */
export const COIN_SELL_PRICE_TOMAN = 1_000;

/** حداقل سکه برای ثبت درخواست فروش / برداشت */
export const MIN_SELL_COINS = 50;

export type CoinSellRequestStatus = 'open' | 'paid' | 'rejected' | 'cancelled';

export type CoinSellRequestSummary = {
  id: number;
  coins: number;
  rateToman: number;
  amountToman: number;
  /** کارت ماسک‌شده برای نمایش امن */
  cardMasked: string;
  status: CoinSellRequestStatus;
  createdAt: string;
  reviewedAt?: string | null;
  adminNote?: string | null;
};

export function sellAmountToman(coins: number, rate = COIN_SELL_PRICE_TOMAN): number {
  const c = Math.floor(Number(coins) || 0);
  const r = Math.floor(Number(rate) || COIN_SELL_PRICE_TOMAN);
  return Math.max(0, c) * Math.max(0, r);
}

/** نرمال‌سازی شماره کارت ایرانی — فقط رقم */
export function normalizeCardNumber(raw: string): string {
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  const ar = '٠١٢٣٤٥٦٧٨٩';
  let s = (raw || '').trim().replace(/[\s\-]/g, '');
  s = s
    .split('')
    .map((ch) => {
      const fi = fa.indexOf(ch);
      if (fi >= 0) return String(fi);
      const ai = ar.indexOf(ch);
      if (ai >= 0) return String(ai);
      return ch;
    })
    .join('');
  return s.replace(/\D/g, '');
}

function luhnOk(digits: string): boolean {
  if (!/^\d{16}$/.test(digits)) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function validateIranCard(
  raw: string
): { ok: true; card: string } | { ok: false; reason: 'length' | 'luhn' } {
  const card = normalizeCardNumber(raw);
  if (card.length !== 16) return { ok: false, reason: 'length' };
  if (!luhnOk(card)) return { ok: false, reason: 'luhn' };
  return { ok: true, card };
}

export function formatCardGrouped(card: string): string {
  const d = normalizeCardNumber(card);
  if (d.length === 16) return d.replace(/(\d{4})(?=\d)/g, '$1-');
  return d;
}

/** ماسک کارت برای UI: ۱۲۳۴-****-****-۵۶۷۸ */
export function maskCardNumber(card: string): string {
  const d = normalizeCardNumber(card);
  if (d.length !== 16) return '****';
  return `${d.slice(0, 4)}-****-****-${d.slice(12)}`;
}

export const COIN_SELL_STATUS_LABELS_FA: Record<CoinSellRequestStatus, string> = {
  open: 'در انتظار بررسی',
  paid: 'پرداخت شد',
  rejected: 'رد شد',
  cancelled: 'لغو شد',
};

/** تبدیل مبلغ تومان به سکه موردنیاز برای پرداخت فروشگاه (حداقل ۱ برای مبلغ مثبت) */
export function tomanToShopCoins(toman: number): number {
  const t = Math.floor(Number(toman) || 0);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.max(1, Math.ceil(t / COIN_PRICE_TOMAN));
}

/**
 * تبدیل مبلغ تومان به ستاره موردنیاز برای پرداخت فروشگاه.
 * همان نرخ اقتصاد ربات (۱ Star ≈ ۲٬۰۰۰ تومان).
 */
export function tomanToShopStars(toman: number): number {
  const t = Math.floor(Number(toman) || 0);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.max(1, Math.ceil(t / STAR_PRICE_TOMAN));
}

/** موجودی کیف پول چندارزی کاربر */
export type WalletCurrency = 'ton' | 'stars' | 'coins' | 'toman';

export interface WalletBalances {
  /** TON (Telegram Toncoin) — ذخیره و نمایش؛ واریز on-chain فعلاً stub */
  ton: number;
  /** ستاره‌های تلگرام نگه‌داری‌شده — جدا از خرید سکه با Stars */
  stars: number;
  /** سکه ربات (users.coins) */
  coins: number;
  /** تومان (IRT) */
  toman: number;
}

export const WALLET_CURRENCY_LABELS_FA: Record<WalletCurrency, string> = {
  ton: 'تون',
  stars: 'ستاره‌ها',
  coins: 'سکه ربات',
  toman: 'تومان',
};

export const WALLET_CURRENCY_SYMBOLS: Record<WalletCurrency, string> = {
  ton: '◆',
  stars: '⭐',
  coins: '🪙',
  toman: 'تومان',
};

/** وضعیت اتصال هر ارز — برای UI و مستندات */
export const WALLET_CURRENCY_STATUS: Record<
  WalletCurrency,
  { deposit: 'wired' | 'stub' | 'bot_only'; noteFa: string }
> = {
  ton: {
    deposit: 'stub',
    noteFa: 'نمایش موجودی؛ واریز TON هنوز فعال نیست',
  },
  stars: {
    deposit: 'bot_only',
    noteFa: 'موجودی مشترک وب/ربات (wallet_stars)؛ پرداخت فروشگاه — نه موجودی بومی Stars تلگرام',
  },
  coins: {
    deposit: 'wired',
    noteFa: 'سکه ربات — خرید/جایزه از بات و API',
  },
  toman: {
    deposit: 'stub',
    noteFa: 'نمایش موجودی تومان؛ واریز بانکی به‌زودی',
  },
};

export function emptyWallet(): WalletBalances {
  return { ton: 0, stars: 0, coins: 0, toman: 0 };
}

export function normalizeWalletBalances(input: Partial<WalletBalances> | null | undefined): WalletBalances {
  const n = (v: unknown) => {
    const x = Math.floor(Number(v ?? 0));
    return Number.isFinite(x) && x > 0 ? x : 0;
  };
  return {
    ton: n(input?.ton),
    stars: n(input?.stars),
    coins: n(input?.coins),
    toman: n(input?.toman),
  };
}

/** ساخت کیف پول از فیلدهای کاربر (coins = سکه ربات) */
export function walletFromUserFields(user: {
  coins?: number | null;
  walletTon?: number | null;
  walletStars?: number | null;
  walletToman?: number | null;
  wallet?: Partial<WalletBalances> | null;
}): WalletBalances {
  const pick = (...vals: Array<number | null | undefined>) => {
    for (const v of vals) {
      if (v != null) return v;
    }
    return 0;
  };
  if (user.wallet) {
    return normalizeWalletBalances({
      ton: pick(user.wallet.ton, user.walletTon),
      stars: pick(user.wallet.stars, user.walletStars),
      coins: pick(user.wallet.coins, user.coins),
      toman: pick(user.wallet.toman, user.walletToman),
    });
  }
  return normalizeWalletBalances({
    ton: pick(user.walletTon),
    stars: pick(user.walletStars),
    coins: pick(user.coins),
    toman: pick(user.walletToman),
  });
}

/** هدیه یک‌باره ثبت‌نام */
export const SIGNUP_BONUS = 20;
/** جایزه تکمیل هر بخش پروفایل (اولین بار) */
export const PROFILE_SECTION_REWARD = 5;
/** جایزه تأیید احراز هویت تصویری توسط ادمین */
export const FACE_VERIFY_REWARD = 100;

/** کلیدهای ledger برای idempotency */
export const COIN_REASON = {
  signup: 'signup',
  faceVerify: 'face_verify',
  daily: 'daily',
  profile: (section: ProfileRewardSection) => `profile:${section}` as const,
} as const;

/** بخش‌های پروفایل که جایزه دارند (هم‌تراز ویرایش بخش‌بندی‌شده بات) */
export const PROFILE_REWARD_SECTIONS = [
  'name',
  'age',
  'gender',
  'location',
  'phone',
  'photo',
  'bio',
  'interests',
] as const;

export type ProfileRewardSection = (typeof PROFILE_REWARD_SECTIONS)[number];

export type CoinAward = {
  reason: string;
  amount: number;
  section?: ProfileRewardSection;
};

export const PROFILE_SECTION_LABELS_FA: Record<ProfileRewardSection, string> = {
  name: 'نام',
  age: 'سن',
  gender: 'جنسیت',
  location: 'موقعیت',
  phone: 'موبایل',
  photo: 'عکس',
  bio: 'بیو',
  interests: 'علایق',
};

export function formatCoinAwardMessage(awards: CoinAward[]): string {
  if (!awards.length) return '';
  const total = awards.reduce((s, a) => s + a.amount, 0);
  const fa = new Intl.NumberFormat('fa-IR').format(total);
  if (awards.length === 1 && awards[0]!.reason === COIN_REASON.signup) {
    return `${fa} سکه هدیه ثبت‌نام دریافت کردید`;
  }
  if (awards.length === 1 && awards[0]!.reason === COIN_REASON.faceVerify) {
    return `🎁 ${fa} سکه جایزه احراز هویت به موجودی‌ات اضافه شد.`;
  }
  const sections = awards
    .filter((a) => a.section)
    .map((a) => PROFILE_SECTION_LABELS_FA[a.section!])
    .filter(Boolean);
  if (sections.length === 1) {
    return `🎁 ${fa} سکه بابت تکمیل «${sections[0]}» دریافت کردید`;
  }
  if (sections.length > 1) {
    return `🎁 ${fa} سکه بابت تکمیل بخش‌های پروفایل (${sections.join('، ')}) دریافت کردید`;
  }
  return `🎁 ${fa} سکه دریافت کردید`;
}

/** جهت ردیف لجر کیف پول */
export type WalletLedgerDirection = 'credit' | 'debit';

/** تراکنش قابل‌نمایش در وب/ربات */
export type WalletTransaction = {
  id: number;
  currency: WalletCurrency;
  amount: number;
  direction: WalletLedgerDirection;
  /** متن ذخیره‌شده در لجر (معمولاً فارسی) */
  reason: string;
  /** برچسب نمایش — همیشه فارسی */
  labelFa: string;
  refType: string | null;
  refId: string | null;
  createdAt: string;
  /** اختلاف موجودی: credit مثبت، debit منفی */
  delta: number;
};

/** تبدیل کلیدهای idempotent / انگلیسی به برچسب فارسی برای لیست تراکنش‌ها */
export function walletLedgerLabelFa(reason: string): string {
  const r = String(reason || '').trim();
  if (!r) return 'تراکنش کیف پول';
  if (r === COIN_REASON.signup || r === 'signup') return 'جایزه ثبت‌نام';
  if (r === COIN_REASON.faceVerify || r === 'face_verify') return 'جایزه احراز هویت';
  if (r === COIN_REASON.daily || r === 'daily') return 'سکه روزانه';
  if (r.startsWith('profile:')) {
    const section = r.slice('profile:'.length) as ProfileRewardSection;
    const label = PROFILE_SECTION_LABELS_FA[section];
    return label ? `جایزه پروفایل (${label})` : 'جایزه پروفایل';
  }
  return r;
}
