import { InlineKeyboard, Keyboard } from 'grammy';
import type { PetBreed, PetProfile, PetSpecies, UserRole } from '@petdate/shared';
import {
  PET_AGE_CUSTOM_LABEL,
  PET_AGE_OPTIONS,
  PET_COLOR_CUSTOM_LABEL,
  PET_COLOR_OPTIONS,
  PET_GENDER_LABELS,
  PET_SIZE_LABELS,
  PROFILE_COUNTRIES,
  PROFILE_INTEREST_OPTIONS,
  IRAN_PROVINCES,
  MY_ROLES_LABEL,
  ROLE_ADD_LABEL,
  ROLE_CONFIRM_LABEL,
  USER_GENDER_LABELS,
  USER_ROLE_LABELS,
  USER_ROLES,
  citiesForProvince,
  normalizeRoles,
  primaryRole,
  profileAgeChipLabels,
} from '@petdate/shared';
import {
  COIN_PACKAGES,
  DAILY_COIN_REWARD,
  canClaimDaily,
  formatNum,
  packagePickerLabel,
} from './economy';
import { isTelegramAdmin } from './config';
import { telegramWebLoginUrl } from './telegram-web-link';
import { effectiveWebUrl, isTelegramInlineUrl } from './urls';

/** دکمهٔ ثابت بازگشت/باز کردن منوی اصلی روی reply keyboard */
export const MAIN_MENU_BTN = '📋 منو' as const;

/** متن‌های معادل «منو» که همان رندر منوی اصلی را صدا می‌زنند */
export const MAIN_MENU_ALIASES = new Set<string>([
  MAIN_MENU_BTN,
  '🏠 منو',
  'منو',
  'منوی اصلی',
  '🔙 منوی اصلی',
  '🏠 منوی اصلی',
  '🔙 بازگشت به منو',
]);

/** Labels for pet_owner main menu */
export const PET_OWNER_MENU = {
  findPlaymate: '🔍 پیدا کردن همبازی',
  nearbyPets: '📍 پت‌های نزدیک',
  searchPets: '🔎 جستجوی پت',
  myProfile: '👤 پروفایل',
  myPets: '🐾 پت‌های من',
  addPet: '➕ ثبت پت',
  coins: '🪙 سکه',
  earn: '💵 کسب درآمد',
  verify: '🛡 احراز چهره',
  phoneVerify: '📱 احراز موبایل',
  invite: '🎁 دعوت دوستان',
  help: '❓ راهنما',
  menu: MAIN_MENU_BTN,
  quickVet: '⚡ مشاوره سریع پزشک',
  shop: '🛒 پت‌شاپ',
  /** @deprecated حذف از منو — نگه‌داری برای کیبوردهای قدیمی تلگرام */
  chat: '💬 چت',
  services: '🛠 خدمات',
  myRoles: MY_ROLES_LABEL,
} as const;

/**
 * دکمه‌های مشترک همه نقش‌ها
 * — سکه، شاپ، دعوت، راهنما (بدون چت)
 */
export const COMMON_MENU = {
  coins: PET_OWNER_MENU.coins,
  shop: PET_OWNER_MENU.shop,
  invite: PET_OWNER_MENU.invite,
  help: PET_OWNER_MENU.help,
} as const;

/** زیرمنوی پنل ادمین (reply keyboard) */
export const ADMIN_MENU = {
  panel: '🛠 پنل ادمین',
  faceQueue: '📋 صف احراز چهره',
  vetQueue: '📄 صف مدارک دامپزشک',
  vetList: '🩺 مدیریت پزشک‌ها',
  stats: '📊 وضعیت صف‌ها',
  pendingPayments: '💳 پرداخت‌های در انتظار',
  back: '🔙 بازگشت به منو',
  menu: MAIN_MENU_BTN,
} as const;

/** زیرمنوی جستجوی پت — برچسب‌های reply (سازگاری) + اینلاین */
export const SEARCH_PETS_MENU = {
  /** @deprecated برچسب قدیمی — جستجو پیشرفته */
  byBreed: '🧬 بر اساس نژاد',
  advanced: '🔍 جستجو پیشرفته',
  sameProvince: '📍🍷 هم استانی‌ها',
  /** برچسب قدیمی reply */
  sameProvinceLegacy: '🗺 هم‌استان',
  sameBreed: '🧬 هم نژادها',
  viewAll: '📋 مشاهده همه',
  /** برچسب قدیمی reply */
  allPets: '🐾 همه پت‌ها',
  newest: '🙋 پت‌های جدید',
  popular: '❤️📊 پت‌های محبوب',
  /** حذف‌شده — فقط تشخیص کیبورد قدیمی */
  mashhad: '🏙 مشهد',
  backToMenu: '🔙 بازگشت به منو',
  menu: MAIN_MENU_BTN,
} as const;

/** callback_data منوی اینلاین جستجوی پت */
export const SEARCH_MENU_CALLBACKS = {
  province: 'search:go:province',
  sameBreed: 'search:go:samebreed',
  all: 'search:go:all',
  advanced: 'search:go:advanced',
  newest: 'search:go:newest',
  popular: 'search:go:popular',
} as const;

/** منوی نقش «بدون پت» */
export const NO_PET_MENU = {
  buyConsult: '🛒 به دنبال مشاوره برای خرید',
  profile: '👤 پروفایل',
  verify: '🛡 احراز چهره',
  phoneVerify: '📱 احراز موبایل',
  coins: COMMON_MENU.coins,
  shop: COMMON_MENU.shop,
  invite: COMMON_MENU.invite,
  myRoles: MY_ROLES_LABEL,
  help: COMMON_MENU.help,
  menu: MAIN_MENU_BTN,
  /** برچسب‌های قدیمی — فقط برای کیبورد کش‌شده تلگرام */
  explore: '🔍 کشف همبازی',
  myPets: '🐾 پت‌های من',
  chat: '💬 چت',
} as const;

/** منوی نقش «دنبال پت» */
export const PET_SEEKER_MENU = {
  petsAndPlaymates: '🐾 پت‌ها و همبازی',
  readyAdoptOn: '💚 آماده پذیرش پت هستم',
  readyAdoptOff: '⏸ فعلاً آماده پذیرش نیستم',
  profile: '👤 پروفایل',
  verify: '🛡 احراز چهره',
  phoneVerify: '📱 احراز موبایل',
  coins: COMMON_MENU.coins,
  shop: COMMON_MENU.shop,
  invite: COMMON_MENU.invite,
  myRoles: MY_ROLES_LABEL,
  help: COMMON_MENU.help,
  menu: MAIN_MENU_BTN,
  /** برچسب‌های قدیمی — فقط برای کیبورد کش‌شده تلگرام */
  explore: '🔍 کشف همبازی',
  myPets: '🐾 پت‌های من',
  chat: '💬 چت',
} as const;

/** @deprecated استفاده از NO_PET_MENU / PET_SEEKER_MENU — نگه‌داری برای سازگاری */
export const DEFAULT_MENU = {
  explore: NO_PET_MENU.explore,
  myPets: NO_PET_MENU.myPets,
  profile: NO_PET_MENU.profile,
  verify: NO_PET_MENU.verify,
  phoneVerify: NO_PET_MENU.phoneVerify,
  addPet: '➕ ثبت پت',
  coins: COMMON_MENU.coins,
  shop: COMMON_MENU.shop,
  invite: COMMON_MENU.invite,
  chat: NO_PET_MENU.chat,
  myRoles: MY_ROLES_LABEL,
  help: COMMON_MENU.help,
  menu: MAIN_MENU_BTN,
} as const;

/** منوی دامپزشک — فقط وقتی نقش فعال vet باشد */
export const VET_MENU = {
  goOnline: '🟢 آنلاین — آماده پذیرش',
  goOffline: '🔴 آفلاین شدم',
  recentPatients: '🩺 بیماران اخیر',
  visitFee: '💰 تعرفه ویزیت',
  profile: '👤 پروفایل',
  verify: '🛡 احراز چهره',
  phoneVerify: '📱 احراز موبایل',
  coins: COMMON_MENU.coins,
  shop: COMMON_MENU.shop,
  invite: COMMON_MENU.invite,
  /** @deprecated حذف از منو */
  chat: '💬 چت',
  myRoles: MY_ROLES_LABEL,
  help: COMMON_MENU.help,
  menu: MAIN_MENU_BTN,
} as const;

/** کیبورد مخصوص بخش پت‌های من (بدون پت‌های من / درخواست‌ها) */
export const MY_PETS_SECTION = {
  addPet: '➕ ثبت پت جدید',
  backToMenu: '🔙 بازگشت به منو',
  menu: MAIN_MENU_BTN,
} as const;

/** دکمه‌های ناوبری ویزارد (reply keyboard) */
export const WIZARD_NAV = {
  back: '↩️ بازگشت',
  cancel: '❌ انصراف',
  skip: '⏭ رد کردن',
  /** رد کردن کل ویزارد پروفایل و رفتن به منو */
  skipLater: '⏭ فعلاً رد کن',
  nextPage: 'بعدی ▶️',
  prevPage: '◀️ قبلی',
  custom: '✏️ نوشتن دستی',
  otherCity: '✏️ شهر دیگر',
  sharePhone: '📱 ارسال شماره تماس',
  /** دکمه request_location تلگرام — پت‌های نزدیک */
  shareLocation: '📍 ارسال موقعیت',
  interestsDone: '✅ ثبت علایق',
  keepName: '✓ همین نام',
} as const;

export const YES_LABEL = '✅ بله';
export const NO_LABEL = '❌ خیر';
export const VACCINATED_YES_LABEL = '💉 واکسن زده';
export const VACCINATED_NO_LABEL = '🚫 واکسن نزده';
export const NEUTERED_YES_LABEL = '✂️ عقیم شده';
export const NEUTERED_NO_LABEL = '➖ عقیم نشده';
export const LOOKING_YES_LABEL = '🤝 دنبال همبازی';
export const LOOKING_NO_LABEL = '⏸ فعلاً نه';
export const USER_MALE_LABEL = USER_GENDER_LABELS.male;
export const USER_FEMALE_LABEL = USER_GENDER_LABELS.female;
export const PET_MALE_LABEL = PET_GENDER_LABELS.male;
export const PET_FEMALE_LABEL = PET_GENDER_LABELS.female;

export const PROFILE_AGE_CHIPS = profileAgeChipLabels();
/** @deprecated use PET_AGE_OPTIONS / petAgeReplyKeyboard */
export const PET_AGE_CHIPS = PET_AGE_OPTIONS.map((o) => String(o.months));
export const COMMON_CITIES = [
  'تهران',
  'کرج',
  'مشهد',
  'اصفهان',
  'شیراز',
  'تبریز',
  'اهواز',
  'قم',
] as const;

export const BREED_PAGE_SIZE = 12;

export const WIZARD_NAV_LABELS = new Set<string>(Object.values(WIZARD_NAV));

export function isWizardNav(text: string): boolean {
  return WIZARD_NAV_LABELS.has(text);
}

export function withWizardNav(
  kb: Keyboard,
  opts?: { skip?: boolean; noBack?: boolean; skipLater?: boolean }
): Keyboard {
  if (opts?.skip) {
    kb.row().text(WIZARD_NAV.skip).primary();
  }
  if (opts?.skipLater) {
    kb.row().text(WIZARD_NAV.skipLater).primary();
  }
  kb.row();
  if (!opts?.noBack) kb.text(WIZARD_NAV.back).primary();
  kb.text(WIZARD_NAV.cancel).danger();
  // همیشه «منو» قابل‌دسترس باشد تا کیبورد قدیمی تلگرام گیر نکند
  kb.row().text(MAIN_MENU_BTN).primary();
  return kb.resized().persistent();
}

/** کیبورد انتخابی منویی برای مراحل ویزارد */
export function choiceReplyKeyboard(
  labels: string[],
  opts?: { columns?: number; skip?: boolean; noBack?: boolean; skipLater?: boolean }
): Keyboard {
  const cols = opts?.columns ?? 2;
  const kb = new Keyboard();
  labels.forEach((label, i) => {
    kb.text(label);
    if ((i + 1) % cols === 0) kb.row();
  });
  if (labels.length % cols !== 0) kb.row();
  return withWizardNav(kb, opts);
}

export function textStepKeyboard(
  opts?: { skip?: boolean; noBack?: boolean; skipLater?: boolean; keepName?: string }
): Keyboard {
  const kb = new Keyboard();
  if (opts?.keepName) {
    kb.text(WIZARD_NAV.keepName).success().row();
  }
  return withWizardNav(kb, opts);
}

/** ناوبری مشترک مراحل تکمیل پروفایل */
export function profileNavOpts(extra?: {
  skip?: boolean;
  noBack?: boolean;
  skipLater?: boolean;
}): { skip?: boolean; noBack?: boolean; skipLater?: boolean } {
  return { skipLater: true, ...extra };
}

export function genderReplyKeyboard(): Keyboard {
  return choiceReplyKeyboard([USER_MALE_LABEL, USER_FEMALE_LABEL], profileNavOpts());
}

export function ageChipKeyboard(chips: string[], opts?: { noBack?: boolean }): Keyboard {
  // ۳ ستون — دکمه‌های سن روی موبایل تلگرام قابل‌لمس‌ترند
  return choiceReplyKeyboard(chips, { columns: 3, ...profileNavOpts({ noBack: opts?.noBack }) });
}

/** کیبورد سن پت با برچسب‌های خوانا (ماه‌ای / سالی) */
export function petAgeReplyKeyboard(): Keyboard {
  const labels = [...PET_AGE_OPTIONS.map((o) => o.label), PET_AGE_CUSTOM_LABEL];
  return choiceReplyKeyboard(labels, { columns: 3 });
}

export function cityReplyKeyboard(opts?: { skip?: boolean; province?: string; skipLater?: boolean }): Keyboard {
  const cities = opts?.province
    ? [...citiesForProvince(opts.province), WIZARD_NAV.otherCity]
    : [...COMMON_CITIES, WIZARD_NAV.otherCity];
  return choiceReplyKeyboard(cities, {
    columns: 2,
    skip: opts?.skip,
    skipLater: opts?.skipLater,
  });
}

export function countryReplyKeyboard(): Keyboard {
  return choiceReplyKeyboard(['🇮🇷 ایران', '🌍 سایر کشورها'], {
    columns: 1,
    ...profileNavOpts(),
  });
}

export function provinceReplyKeyboard(): Keyboard {
  return choiceReplyKeyboard([...IRAN_PROVINCES], { columns: 2, ...profileNavOpts() });
}

export function phoneWizardKeyboard(): Keyboard {
  return new Keyboard()
    .requestContact(WIZARD_NAV.sharePhone)
    .primary()
    .row()
    .text(WIZARD_NAV.skip).primary()
    .row()
    .text(WIZARD_NAV.skipLater).primary()
    .row()
    .text(WIZARD_NAV.back).primary()
    .text(WIZARD_NAV.cancel)
    .danger()
    .row()
    .text(MAIN_MENU_BTN).primary()
    .resized()
    .persistent();
}

/** کیبورد درخواست موقعیت برای «پت‌های نزدیک» (سبک دوردوریا) */
export function nearbyLocationKeyboard(): Keyboard {
  return new Keyboard()
    .requestLocation(WIZARD_NAV.shareLocation)
    .primary()
    .row()
    .text(WIZARD_NAV.cancel)
    .danger()
    .row()
    .text(MAIN_MENU_BTN)
    .primary()
    .resized()
    .persistent();
}

/** شعاع‌های جستجوی نزدیک (کیلومتر) — ترتیب دکمه‌ها مثل دوردوریا */
export const NEARBY_RADII_KM = [5, 10, 20, 50, 100] as const;

/** انتخاب شعاع بعد از ذخیره موقعیت */
export function nearbyRadiusKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('۱۰ کیلومتر', 'nearby:radius:10')
    .primary()
    .text('۵ کیلومتر', 'nearby:radius:5')
    .primary()
    .row()
    .text('۵۰ کیلومتر', 'nearby:radius:50')
    .primary()
    .text('۲۰ کیلومتر', 'nearby:radius:20')
    .primary()
    .row()
    .text('۱۰۰ کیلومتر', 'nearby:radius:100')
    .primary()
    .row()
    .text('🛰️ به‌روزرسانی موقعیت GPS', 'search:nearby:askloc')
    .success();
}

/** خلاصه تعداد نتایج — قبل از لیست تصویری */
export function nearbySummaryKeyboard(_radiusKm: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('📋 نمایش بصورت لیستی', 'nearby:list:0')
    .primary()
    .row()
    .text('🛰️ به‌روزرسانی موقعیت GPS', 'search:nearby:askloc')
    .success()
    .row()
    .text('🔙 تغییر شعاع', 'nearby:pick-radius')
    .primary();
}

/** دکمه‌های زیر کارت لیست تصویری — باز کردن هر پت */
export function nearbyVisualListKeyboard(
  pets: PetProfile[],
  page: number,
  pageSize: number,
  totalCount: number
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = pets.slice(0, pageSize);

  slice.forEach((pet, idx) => {
    const n = safePage * pageSize + idx + 1;
    let label = `${n}. ${pet.name}`;
    if (pet.distanceKm != null && Number.isFinite(pet.distanceKm)) {
      label += ` · ${formatNearbyDistance(pet.distanceKm)}`;
    }
    if (label.length > 56) label = `${label.slice(0, 53)}…`;
    kb.text(`🐾 ${label}`, `search:pet:${pet.id}`).primary().row();
  });

  if (totalPages > 1) {
    if (safePage > 0) kb.text('◀️ قبلی', `nearby:list:${safePage - 1}`).primary();
    kb.text(`${safePage + 1}/${totalPages}`, 'noop');
    if (safePage < totalPages - 1) kb.text('بعدی ▶️', `nearby:list:${safePage + 1}`).primary();
    kb.row();
  }

  kb.text('📋 خلاصه', 'nearby:summary').primary().row();
  kb.text('📍 موقعیت دوباره', 'search:nearby:askloc').primary().row();
  kb.text('🔙 منوی اصلی', 'search:home').primary();
  return kb;
}

/** پروفایل پت در نتایج جستجو — بازگشت به لیست + اکشن‌های پت‌دیت */
export function searchPetDetailKeyboard(
  mode: string,
  page: number,
  opts?: { petId?: number; ownerId?: number }
): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (opts?.petId) {
    kb.text('🤝 درخواست همبازی', `playdate:ask:${opts.petId}`).primary();
    if (opts.ownerId) {
      kb.text('👤 پروفایل صاحب', `search:owner:${opts.ownerId}`).success();
    }
    kb.row();
  }
  if (mode === 'nearby') {
    kb.text('🔙 بازگشت به لیست', `nearby:list:${page}`).primary().row();
    kb.text('🏠 منوی اصلی', 'search:home').primary();
  } else {
    kb.text('🔙 بازگشت به لیست', `search:page:${mode}:${page}`).primary().row();
    kb.text('🔎 منوی جستجو', 'search:menu').primary();
  }
  return kb;
}

export function interestsReplyKeyboard(selected: string[] = []): Keyboard {
  const kb = new Keyboard();
  PROFILE_INTEREST_OPTIONS.forEach((opt, i) => {
    const label = selected.includes(opt) ? `✓ ${opt}` : opt;
    if (selected.includes(opt)) kb.text(label).success();
    else kb.text(label);
    if ((i + 1) % 2 === 0) kb.row();
  });
  if (PROFILE_INTEREST_OPTIONS.length % 2 !== 0) kb.row();
  kb.text(WIZARD_NAV.interestsDone).success();
  return withWizardNav(kb, profileNavOpts({ skip: true }));
}

export function speciesReplyKeyboard(species: PetSpecies[]): Keyboard {
  return choiceReplyKeyboard(species.map((s) => `${s.emoji} ${s.labelFa}`));
}

export function breedReplyKeyboard(breeds: PetBreed[], page: number): Keyboard {
  const totalPages = Math.max(1, Math.ceil(breeds.length / BREED_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = breeds.slice(safePage * BREED_PAGE_SIZE, (safePage + 1) * BREED_PAGE_SIZE);

  const kb = new Keyboard();
  slice.forEach((b, i) => {
    kb.text(b.nameFa);
    if ((i + 1) % 2 === 0) kb.row();
  });
  if (slice.length % 2 !== 0) kb.row();

  if (totalPages > 1) {
    kb.row();
    if (safePage > 0) kb.text(WIZARD_NAV.prevPage).primary();
    kb.text(`${safePage + 1}/${totalPages}`);
    if (safePage < totalPages - 1) kb.text(WIZARD_NAV.nextPage).primary();
  }

  // بازگشت و نوشتن دستی کنار هم — بدون رد کردن تا جا برای نژاد بیشتر باشد
  kb.row();
  kb.text(WIZARD_NAV.back).primary();
  kb.text(WIZARD_NAV.custom).primary();
  kb.row();
  kb.text(WIZARD_NAV.cancel).danger();
  kb.row().text(MAIN_MENU_BTN).primary();
  return kb.resized().persistent();
}

export function petGenderReplyKeyboard(): Keyboard {
  return choiceReplyKeyboard([PET_MALE_LABEL, PET_FEMALE_LABEL]);
}

export function petSizeReplyKeyboard(): Keyboard {
  return choiceReplyKeyboard([
    PET_SIZE_LABELS.small,
    PET_SIZE_LABELS.medium,
    PET_SIZE_LABELS.large,
  ]);
}

export function petColorReplyKeyboard(): Keyboard {
  return choiceReplyKeyboard([...PET_COLOR_OPTIONS, PET_COLOR_CUSTOM_LABEL], {
    columns: 3,
    skip: true,
  });
}

export function yesNoReplyKeyboard(): Keyboard {
  return new Keyboard()
    .text(YES_LABEL)
    .success()
    .text(NO_LABEL)
    .danger()
    .row()
    .text(WIZARD_NAV.back).primary()
    .text(WIZARD_NAV.cancel)
    .danger()
    .row()
    .text(MAIN_MENU_BTN).primary()
    .resized()
    .persistent();
}

export function vaccinatedReplyKeyboard(): Keyboard {
  return choiceReplyKeyboard([VACCINATED_YES_LABEL, VACCINATED_NO_LABEL]);
}

export function neuteredReplyKeyboard(): Keyboard {
  return choiceReplyKeyboard([NEUTERED_YES_LABEL, NEUTERED_NO_LABEL]);
}

export function lookingReplyKeyboard(): Keyboard {
  return choiceReplyKeyboard([LOOKING_YES_LABEL, LOOKING_NO_LABEL]);
}

export function roleReplyKeyboard(selected: UserRole[] = []): Keyboard {
  const kb = new Keyboard();
  USER_ROLES.forEach((role, index) => {
    const label = selected.includes(role)
      ? `✓ ${USER_ROLE_LABELS[role]}`
      : USER_ROLE_LABELS[role];
    if (selected.includes(role)) kb.text(label).success();
    else kb.text(label).primary();
    if ((index + 1) % 2 === 0) kb.row();
  });
  if (USER_ROLES.length % 2 !== 0) kb.row();
  kb.text(ROLE_CONFIRM_LABEL).success();
  return kb.resized().persistent();
}

export function roleKeyboard(selected: UserRole[] = []): InlineKeyboard {
  const kb = new InlineKeyboard();
  USER_ROLES.forEach((role, index) => {
    const label = selected.includes(role)
      ? `✓ ${USER_ROLE_LABELS[role]}`
      : USER_ROLE_LABELS[role];
    kb.text(label, `role:${role}`);
    if (selected.includes(role)) kb.success();
    else kb.primary();
    if (index % 2 === 1) kb.row();
  });
  if (USER_ROLES.length % 2 === 1) kb.row();
  kb.text(ROLE_CONFIRM_LABEL, 'role:confirm').success();
  return kb;
}

/** منوی اصلی بر اساس نقش فعال کاربر + ردیف دسترسی */
export function mainMenuKeyboard(
  role?: UserRole | string | null,
  roles?: UserRole[] | null,
  telegramId?: string | number | null,
  options?: { vetOnline?: boolean; readyToAdopt?: boolean },
): Keyboard {
  const list = normalizeRoles(roles as UserRole[] | null | undefined, role as UserRole | null | undefined);
  const active = primaryRole(list, role as UserRole | null | undefined);

  if (active === 'pet_owner') return petOwnerMenuKeyboard(telegramId);
  if (active === 'vet') return vetMenuKeyboard(telegramId, options);
  if (active === 'pet_seeker') return petSeekerMenuKeyboard(telegramId, options);
  if (active === 'no_pet') return noPetMenuKeyboard(telegramId);
  return noPetMenuKeyboard(telegramId);
}

/**
 * ردیف دسترسی پنل‌ها:
 * - «نقش‌های من» برای سوییچ نقش فعال (صاحب پت / دامپزشک / …)
 * - «پنل ادمین» فقط اگر telegramId در ADMIN_TELEGRAM_IDS / TELEGRAM_ADMIN_IDS باشد
 */
function appendAccessRow(kb: Keyboard, telegramId?: string | number | null): Keyboard {
  kb.row().text(MY_ROLES_LABEL).primary();
  if (telegramId != null && isTelegramAdmin(telegramId)) {
    kb.text(ADMIN_MENU.panel).primary();
  }
  return kb;
}

/** سکه / شاپ / دعوت / راهنما — مشترک همه نقش‌ها (بدون چت) */
function appendCommonMenuRows(kb: Keyboard): Keyboard {
  const c = COMMON_MENU;
  return kb
    .row()
    .text(c.coins)
    .primary()
    .text(c.shop)
    .primary()
    .row()
    .text(c.invite)
    .success()
    .text(c.help)
    .primary();
}

export function vetMenuKeyboard(
  telegramId?: string | number | null,
  options?: { vetOnline?: boolean },
): Keyboard {
  const m = VET_MENU;
  const online = options?.vetOnline === true;
  const kb = new Keyboard().text(online ? m.goOffline : m.goOnline);
  if (online) kb.danger();
  else kb.success();
  kb
    .row()
    .text(m.recentPatients)
    .primary()
    .text(m.visitFee)
    .primary()
    .row()
    .text(m.profile)
    .primary();
  appendCommonMenuRows(kb);
  return appendAccessRow(kb.resized().persistent(), telegramId);
}

export function petOwnerMenuKeyboard(telegramId?: string | number | null): Keyboard {
  const m = PET_OWNER_MENU;
  const kb = new Keyboard()
    .text(m.findPlaymate)
    .success()
    .row()
    .text(m.nearbyPets)
    .primary()
    .text(m.searchPets)
    .primary()
    .row()
    .text(m.myPets)
    .primary()
    .text(m.myProfile)
    .primary()
    .row()
    .text(m.quickVet)
    .success()
    .text(m.earn)
    .primary()
    .row()
    .text(m.services)
    .primary();
  appendCommonMenuRows(kb);
  return appendAccessRow(kb.resized().persistent(), telegramId);
}

export function petSeekerMenuKeyboard(
  telegramId?: string | number | null,
  options?: { readyToAdopt?: boolean },
): Keyboard {
  const m = PET_SEEKER_MENU;
  const ready = options?.readyToAdopt === true;
  const kb = new Keyboard()
    .text(m.petsAndPlaymates)
    .success()
    .row()
    .text(ready ? m.readyAdoptOff : m.readyAdoptOn);
  if (ready) kb.danger();
  else kb.success();
  kb.row().text(m.profile).primary();
  appendCommonMenuRows(kb);
  return appendAccessRow(kb.resized().persistent(), telegramId);
}

export function noPetMenuKeyboard(telegramId?: string | number | null): Keyboard {
  const m = NO_PET_MENU;
  const kb = new Keyboard()
    .text(m.buyConsult)
    .success()
    .row()
    .text(m.profile)
    .primary();
  appendCommonMenuRows(kb);
  return appendAccessRow(kb.resized().persistent(), telegramId);
}

/**
 * منوی اینلاین جستجوی پت (سبک اسکرین مرجع).
 * بدون دکمه مشهد و بدون «هم سن».
 */
export function searchPetsMenuInlineKeyboard(): InlineKeyboard {
  const m = SEARCH_PETS_MENU;
  const c = SEARCH_MENU_CALLBACKS;
  return new InlineKeyboard()
    .text(m.sameProvince, c.province)
    .primary()
    .text(m.sameBreed, c.sameBreed)
    .primary()
    .row()
    .text(m.viewAll, c.all)
    .primary()
    .text(m.advanced, c.advanced)
    .primary()
    .row()
    .text(m.newest, c.newest)
    .primary()
    .row()
    .text(m.popular, c.popular)
    .success();
}

/** Reply keyboard سبک — فقط بازگشت؛ گزینه‌های جستجو اینلاین‌اند */
export function searchPetsMenuKeyboard(): Keyboard {
  const m = SEARCH_PETS_MENU;
  return new Keyboard().text(m.backToMenu).primary().resized().persistent();
}

/** @deprecated — از noPetMenuKeyboard استفاده کن */
export function defaultMenuKeyboard(telegramId?: string | number | null): Keyboard {
  return noPetMenuKeyboard(telegramId);
}

/** کیبورد پنل ادمین بعد از ورود */
export function adminPanelKeyboard(): Keyboard {
  const m = ADMIN_MENU;
  return new Keyboard()
    .text(m.faceQueue)
    .primary()
    .row()
    .text(m.vetQueue)
    .primary()
    .row()
    .text(m.vetList)
    .primary()
    .row()
    .text(m.stats)
    .success()
    .text(m.pendingPayments)
    .primary()
    .row()
    .text(m.back)
    .primary()
    .resized()
    .persistent();
}

/** اینلاین: سوییچ بین نقش‌های فعلی کاربر */
export function myRolesSwitchKeyboard(
  roles: UserRole[],
  activeRole?: UserRole | null
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const active = primaryRole(roles, activeRole);
  roles.forEach((role) => {
    const isActive = role === active;
    const label = isActive ? `✓ ${USER_ROLE_LABELS[role]}` : USER_ROLE_LABELS[role];
    kb.text(label, `myroles:switch:${role}`);
    if (isActive) kb.success();
    else kb.primary();
    kb.row();
  });
  kb.text(ROLE_ADD_LABEL, 'myroles:add').primary().row();
  return kb;
}

export function adminVetCredentialKeyboard(userId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ تأیید مدرک', `vetcred:approve:${userId}`)
    .success()
    .text('❌ رد', `vetcred:reject:${userId}`)
    .danger()
    .row()
    .text('⏭ بعدی', 'vetcred:admin:next').primary()
    .text('📋 صف', 'vetcred:admin:queue').primary();
}

/** لیست فشردهٔ پزشک‌ها با انتخاب جزئیات + صفحه‌بندی */
export function adminVetListKeyboard(
  vets: Array<{ id: number; name: string; vetEnabled?: boolean }>,
  page: number,
  pageSize: number
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const totalPages = Math.max(1, Math.ceil(vets.length / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * pageSize;
  const slice = vets.slice(start, start + pageSize);

  slice.forEach((vet, i) => {
    const n = start + i + 1;
    const enabled = vet.vetEnabled !== false;
    const mark = enabled ? '✅' : '⏸';
    const name = vet.name.length > 28 ? `${vet.name.slice(0, 27)}…` : vet.name;
    kb.text(`${n}. ${mark} ${name}`, `admin:vet:view:${vet.id}:${safePage}`).row();
  });

  if (totalPages > 1) {
    if (safePage > 0) kb.text('◀️ قبلی', `admin:vet:list:${safePage - 1}`);
    kb.text(`${safePage + 1}/${totalPages}`, 'noop');
    if (safePage < totalPages - 1) kb.text('بعدی ▶️', `admin:vet:list:${safePage + 1}`);
    kb.row();
  }
  return kb;
}

/** فعال/غیرفعال کردن دامپزشک در لیست ادمین */
export function adminVetToggleKeyboard(
  userId: number,
  enabled: boolean,
  listPage = 0
): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (enabled) {
    kb.text('⏸ غیرفعال کردن', `admin:vet:disable:${userId}:${listPage}`).danger();
  } else {
    kb.text('▶️ فعال کردن', `admin:vet:enable:${userId}:${listPage}`).success();
  }
  kb.row().text('🔙 بازگشت به لیست', `admin:vet:list:${listPage}`).primary();
  return kb;
}

/** ریپلای‌کیبورد داخل بخش پت‌های من — فقط ثبت و بازگشت */
export function myPetsSectionKeyboard(): Keyboard {
  const m = MY_PETS_SECTION;
  return new Keyboard()
    .text(m.addPet)
    .success()
    .row()
    .text(m.backToMenu)
    .primary()
    .resized()
    .persistent();
}

export function speciesKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🐕 سگ', 'species:dog')
    .primary()
    .text('🐈 گربه', 'species:cat')
    .primary()
    .row()
    .text('🐾 سایر', 'species:other');
}

export function speciesKeyboardFromCatalog(species: PetSpecies[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  species.forEach((s, i) => {
    kb.text(`${s.emoji} ${s.labelFa}`, `species:${s.code}`).primary();
    if (i % 2 === 1) kb.row();
  });
  if (species.length % 2 === 1) kb.row();
  return kb;
}

export function breedKeyboard(breeds: PetBreed[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  breeds.forEach((b) => {
    kb.text(b.nameFa, `breed:${b.id}`).primary().row();
  });
  kb.text('✏️ نوشتن دستی', 'breed:custom');
  return kb;
}

export function petGenderKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(PET_GENDER_LABELS.male, 'pet:gender:male')
    .primary()
    .text(PET_GENDER_LABELS.female, 'pet:gender:female')
    .primary();
}

export function petSizeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(PET_SIZE_LABELS.small, 'pet:size:small')
    .primary()
    .text(PET_SIZE_LABELS.medium, 'pet:size:medium')
    .primary()
    .row()
    .text(PET_SIZE_LABELS.large, 'pet:size:large')
    .primary();
}

export function petBoolKeyboard(field: 'vaccinated' | 'neutered' | 'looking'): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ بله', `pet:bool:${field}:1`)
    .success()
    .text('❌ خیر', `pet:bool:${field}:0`)
    .danger();
}

export function skipKeyboard(callback: string): InlineKeyboard {
  return new InlineKeyboard().text('⏭ رد کردن', callback).primary();
}

export function exploreListKeyboard(pets: PetProfile[], page: number, pageSize: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  const start = page * pageSize;
  const slice = pets.slice(start, start + pageSize);

  slice.forEach((pet) => {
    kb.text(`${pet.name} (${pet.city ?? '—'})`, `explore:pet:${pet.id}`).primary().row();
  });

  const totalPages = Math.ceil(pets.length / pageSize);
  if (totalPages > 1) {
    if (page > 0) kb.text('◀️ قبلی', `explore:page:${page - 1}`);
    kb.text(`${page + 1}/${totalPages}`, 'noop');
    if (page < totalPages - 1) kb.text('بعدی ▶️', `explore:page:${page + 1}`);
    kb.row();
  }
  kb.text('🔄 تعویض پت من', 'explore:pick').primary().row();
  return kb;
}

/** انتخاب پت مبدأ برای پیدا کردن همبازی — فقط پت‌های خود کاربر */
export function explorePickMyPetKeyboard(pets: PetProfile[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  pets.forEach((pet) => {
    const bits = [pet.breed, pet.city].filter(Boolean).join(' · ');
    const label = bits ? `${pet.name} (${bits})` : pet.name;
    kb.text(`🐾 ${label}`, `explore:for:${pet.id}`).primary().row();
  });
  return kb;
}

export function petDetailKeyboard(petId: number, canRequest: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();
  // درخواست دستی حذف شد — پیدا کردن همبازی خودکار ارسال می‌کند
  void petId;
  void canRequest;
  kb.text('🔙 بازگشت', 'explore:pick').primary();
  return kb;
}

export function fromPetKeyboard(pets: PetProfile[], toPetId: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  pets.forEach((pet) => {
    kb.text(pet.name, `playdate:from:${pet.id}:${toPetId}`).primary().row();
  });
  kb.text('❌ انصراف', 'playdate:cancel').danger();
  return kb;
}

export function playdateActionKeyboard(requestId: number): InlineKeyboard {
  // callback_data budget: playdate:owner:<id> ≪ Telegram 64-byte limit
  return new InlineKeyboard()
    .text('✅ قبول', `playdate:accept:${requestId}`)
    .success()
    .text('❌ رد', `playdate:reject:${requestId}`)
    .danger()
    .row()
    .text('👤 مشاهده پروفایل صاحب پت', `playdate:owner:${requestId}`);
}

/** تأیید ارسال مجدد درخواست همبازی بعد از انقضا */
export function playdateResendConfirmKeyboard(fromPetId: number, toPetId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('بله، مجدد بفرست', `playdate:resend:${fromPetId}:${toPetId}`)
    .success()
    .text('انصراف', 'playdate:cancel')
    .danger();
}

export function webLinksKeyboard(telegramId: string): InlineKeyboard | undefined {
  const login = telegramWebLoginUrl(telegramId, '/wallet');
  if (login) {
    return new InlineKeyboard()
      .url('🌐 باز کردن وب (ورود خودکار)', login)
      .primary();
  }
  const base = effectiveWebUrl();
  if (!isTelegramInlineUrl(base)) return undefined;
  return new InlineKeyboard()
    .url('🌐 باز کردن petdate', `${base}/wallet`)
    .primary();
}

/** One-tap signed login after web «ورود با اکانت تلگرام» deep link. */
export function webAutoLoginKeyboard(
  telegramId: string,
  nextPath = '/home'
): InlineKeyboard | undefined {
  const login = telegramWebLoginUrl(telegramId, nextPath);
  if (login) {
    return new InlineKeyboard().url('🌐 ورود به وبسایت', login).primary();
  }
  const base = effectiveWebUrl();
  if (!isTelegramInlineUrl(base)) return undefined;
  const next = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
  return new InlineKeyboard()
    .url('🌐 باز کردن petdate', `${base}${next === '/home' ? '' : next}`)
    .primary();
}

/**
 * Mobile pending login: confirm in Telegram (callback) — do NOT open a website URL
 * so the original Safari/Chrome tab can poll and keep the session.
 */
export function webPendingLoginConfirmKeyboard(pendingId: string): InlineKeyboard {
  const id = String(pendingId).trim().toLowerCase();
  return new InlineKeyboard()
    .text('✅ تأیید ورود', `wpend:ok:${id}`)
    .success()
    .row()
    .text('❌ انصراف', `wpend:no:${id}`)
    .danger();
}

export function genderKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(USER_GENDER_LABELS.male, 'profile:gender:male')
    .primary()
    .text(USER_GENDER_LABELS.female, 'profile:gender:female')
    .primary();
}

export function phoneKeyboard(): Keyboard {
  return phoneWizardKeyboard();
}

export function profileActionsKeyboard(
  complete: boolean,
  isActive = true,
  verificationStatus: 'none' | 'pending' | 'verified' | 'rejected' = 'none',
  opts?: {
    isVet?: boolean;
    likesCount?: number;
    contactsCount?: number;
    silentChatRequests?: boolean;
    faceReward?: number;
  }
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const fa = new Intl.NumberFormat('fa-IR');
  const likes = fa.format(opts?.likesCount ?? 0);
  const contacts = opts?.contactsCount ?? 0;
  const contactsLabel =
    contacts > 0 ? `👥 مخاطبین (${fa.format(contacts)})` : '👥 مخاطبین (-)';
  const reward = fa.format(opts?.faceReward ?? 100);

  kb.text(`❤️ ${likes}`, 'profile:likes')
    .text(contactsLabel, 'profile:contacts')
    .row();

  if (complete) {
    kb.text('📝 ویرایش پروفایل', 'profile:edit').primary();
    kb.text('📋 تکمیل پروفایل', 'profile:edit:all').primary().row();
  } else {
    kb.text('📝 ویرایش پروفایل', 'profile:edit').primary();
    kb.text('📋 تکمیل پروفایل', 'profile:edit').success().row();
  }

  kb.text('🔄 تعاملات', 'profile:interactions').primary();
  if (verificationStatus === 'verified') {
    kb.text('✅ احراز چهره شده', 'verify:status').success().row();
  } else if (verificationStatus === 'pending') {
    kb.text('⏳ در انتظار احراز', 'verify:status').primary().row();
  } else {
    kb.text(`💰 احراز چهره (+${reward})`, 'verify:start').success().row();
  }

  if (opts?.isVet) {
    kb.text('📄 آپلود مدرک', 'profile:vet_credential').primary().row();
  }

  kb.text('📱 احراز موبایل', 'phone:verify:start').primary().row();

  kb.text('🚫 بلاک‌شده‌ها', 'profile:blocked').danger().row();

  if (opts?.silentChatRequests) {
    kb.text('🔔 سایلنت خاموش (روشن است)', 'profile:silent').primary().row();
  } else {
    kb.text('🔇 سایلنت درخواست چت', 'profile:silent').primary().row();
  }

  kb.text('🔴 حذف / غیرفعال‌سازی حساب', 'profile:account').danger().row();

  if (!isActive) {
    kb.text('▶️ فعال‌سازی حساب', 'profile:activate').success().row();
  }

  return kb;
}

/** منوی ویرایش بخش‌به‌بخش پروفایل */
export function profileEditSectionsKeyboard(opts?: {
  incomplete?: boolean;
  isVet?: boolean;
}): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text('✏️ ویرایش نام', 'profile:edit:name').primary()
    .text('🎂 ویرایش سن', 'profile:edit:age').primary()
    .row()
    .text('⚧ ویرایش جنسیت', 'profile:edit:gender').primary()
    .text('📍 ویرایش موقعیت', 'profile:edit:location').primary()
    .row()
    .text('📱 ویرایش موبایل', 'profile:edit:phone').primary()
    .text('🖼 ویرایش عکس', 'profile:edit:photo').primary()
    .row()
    .text('💬 ویرایش بیو', 'profile:edit:bio').primary()
    .text('💚 ویرایش علایق', 'profile:edit:interests').primary()
    .row();

  if (opts?.isVet) {
    kb.text('📄 آپلود مدرک', 'profile:vet_credential').primary().row();
  }
  if (opts?.incomplete) {
    kb.text('✨ تکمیل همه', 'profile:edit:all').success().row();
  }
  kb.text('↩️ بازگشت به پروفایل', 'profile:edit:back').primary();
  return kb;
}

export function verificationSubmitKeyboard(hasAvatar: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (hasAvatar) {
    kb.text('📷 ارسال عکس فعلی پروفایل', 'verify:use_avatar').success().row();
  }
  kb.text('↩️ انصراف', 'verify:cancel').danger();
  return kb;
}

export function adminVerificationKeyboard(userId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ تأیید', `verify:approve:${userId}`)
    .success()
    .text('❌ رد', `verify:reject:${userId}`)
    .danger()
    .row()
    .text('⏭ بعدی', 'verify:admin:next').primary()
    .text('📋 صف', 'verify:admin:queue').primary();
}

export function adminRejectSkipKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('⏭ بدون دلیل', 'verify:reject_skip').primary();
}

export function profileConfirmKeyboard(action: 'deactivate' | 'delete'): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ بله، مطمئنم', `profile:${action}:yes`)
    .danger()
    .text('↩️ نه', `profile:${action}:no`)
    .primary();
}

/** @deprecated alias — use profileConfirmKeyboard('delete') */
export function confirmDeleteKeyboard(): InlineKeyboard {
  return profileConfirmKeyboard('delete');
}

export function skipProfileKeyboard(callback: string): InlineKeyboard {
  return new InlineKeyboard().text('⏭ رد کردن', callback).primary();
}

export function myPetsActionKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('➕ ثبت پت جدید', 'pets:add').success();
}

/** لیست پت‌های کاربر + ثبت جدید */
export function myPetsListKeyboard(pets: PetProfile[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  pets.forEach((pet) => {
    const bits = [pet.breed, pet.city].filter(Boolean).join(' · ');
    const label = bits ? `${pet.name} (${bits})` : pet.name;
    kb.text(`🐾 ${label}`, `pets:view:${pet.id}`).primary().row();
  });
  kb.text('➕ ثبت پت جدید', 'pets:add').success();
  return kb;
}

export function myPetProfileKeyboard(petId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✏️ ویرایش پروفایل', `pets:edit:${petId}`)
    .primary()
    .row()
    .text('🗑 حذف پت', `pets:delete:${petId}`)
    .danger()
    .row()
    .text('🔙 بازگشت به پت‌های من', 'pets:list').primary();
}

/** منوی ویرایش بخش‌به‌بخش پروفایل پت (صاحب پت) */
export function petEditSectionsKeyboard(petId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✏️ نام', `pets:edit:${petId}:name`)
    .text('🧬 نوع/نژاد', `pets:edit:${petId}:species`)
    .row()
    .text('🎂 سن', `pets:edit:${petId}:age`)
    .text('⚧ جنسیت', `pets:edit:${petId}:gender`)
    .row()
    .text('📏 اندازه', `pets:edit:${petId}:size`)
    .text('🎨 رنگ', `pets:edit:${petId}:color`)
    .row()
    .text('🖼 عکس', `pets:edit:${petId}:photo`)
    .text('💬 بیو', `pets:edit:${petId}:bio`)
    .row()
    .text('💉 واکسن', `pets:edit:${petId}:vaccinated`)
    .text('✂️ عقیم', `pets:edit:${petId}:neutered`)
    .row()
    .text('🤝 همبازی', `pets:edit:${petId}:looking`)
    .text('🏥 بیماری', `pets:edit:${petId}:diseases`)
    .row()
    .text('↩️ بازگشت به پروفایل', `pets:edit:${petId}:back`).primary();
}

export function confirmPetDeleteKeyboard(petId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ بله، حذف شود', `pets:delete:yes:${petId}`)
    .danger()
    .text('↩️ نه', `pets:view:${petId}`)
    .primary();
}

export const MENU_LABELS = new Set<string>([
  ...Object.values(PET_OWNER_MENU),
  ...Object.values(DEFAULT_MENU),
  ...Object.values(NO_PET_MENU),
  ...Object.values(PET_SEEKER_MENU),
  ...Object.values(VET_MENU),
  ...Object.values(COMMON_MENU),
  ...Object.values(ADMIN_MENU),
  ...Object.values(MY_PETS_SECTION),
  ...Object.values(SEARCH_PETS_MENU),
  ...MAIN_MENU_ALIASES,
  // برچسب‌های قدیمی کیبورد تلگرام (کش‌شده)
  '📍 پت‌های نزدیک من',
  '👤 پروفایل خودم',
  '🎁 معرفی به دوستان',
  '🛒 پت شاپ',
  '⚡ مشاوره سریع با پزشک',
  '🟢 آنلاین هستم و آماده پذیرش بیمار',
  '🔴 آفلاین هستم',
  '🩺 آخرین بیمارها',
  '💰 مبلغ ویزیت',
]);

/** کیبورد فروشگاه سکه + سکه روزانه */
export function coinsShopKeyboard(lastDailyCoinAt?: string | null): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (canClaimDaily(lastDailyCoinAt)) {
    kb.text(`🎁 سکه روزانه (+${formatNum(DAILY_COIN_REWARD)})`, 'coins:daily').success().row();
  } else {
    kb.text('🎁 سکه روزانه (فردا)', 'coins:daily:done').primary().row();
  }
  for (const p of COIN_PACKAGES) {
    kb.text(packagePickerLabel(p), `coins:pkg:${p.id}`);
    if (p.vip) kb.success();
    else kb.primary();
    kb.row();
  }
  kb.text('📜 تراکنش‌ها', 'coins:tx').primary().row();
  return kb;
}

export function coinPackagePayKeyboard(pkgId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('⭐ پرداخت با ستاره', `coins:pay:stars:${pkgId}`)
    .primary()
    .row()
    .text('💳 کارت به کارت', `coins:pay:card:${pkgId}`)
    .primary()
    .row()
    .text('↩️ بازگشت', 'coins:back')
    .primary();
}

export function paymentReceiptCancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📤 ارسال فیش', 'coins:pay:receipt')
    .primary()
    .row()
    .text('↩️ انصراف از پرداخت', 'coins:pay:cancel').danger();
}

/** کیبورد reply هنگام انتظار فیش کارت‌به‌کارت */
export function paymentReceiptReplyKeyboard(): Keyboard {
  return new Keyboard()
    .text('📤 ارسال فیش')
    .primary()
    .row()
    .text('↩️ انصراف از پرداخت')
    .danger()
    .resized()
    .persistent();
}

export function adminPaymentKeyboard(orderId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ تأیید واریز سکه', `pay:approve:${orderId}`)
    .success()
    .row()
    .text('❌ رد', `pay:reject:${orderId}`)
    .danger();
}

export function earnKeyboard(canSell: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (canSell) {
    kb.text('💵 فروش سکه', 'earn:sell').success().row();
  }
  kb.text('✖️ بستن', 'earn:close').primary().primary();
  return kb;
}

export function earnConfirmKeyboard(coins: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ تأیید فروش', `earn:confirm:${coins}`)
    .success()
    .row()
    .text('↩️ انصراف', 'earn:cancel');
}

export function earnCancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('↩️ انصراف', 'earn:cancel');
}

/** لیست پت‌های جستجو — یک ردیف برای هر پت + صفحه‌بندی (سبک دوردوریا) */
export function searchPetsListKeyboard(
  pets: PetProfile[],
  mode: string,
  page: number,
  pageSize: number
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const totalPages = Math.max(1, Math.ceil(pets.length / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = pets.slice(safePage * pageSize, (safePage + 1) * pageSize);

  slice.forEach((pet, idx) => {
    const n = safePage * pageSize + idx + 1;
    const dist =
      pet.distanceKm != null && Number.isFinite(pet.distanceKm)
        ? formatNearbyDistance(pet.distanceKm)
        : null;
    const place = pet.ownerCity || pet.city || pet.ownerName;
    const bits = [pet.breed, place, dist].filter(Boolean).join(' · ');
    let label = bits ? `${n}. ${pet.name} (${bits})` : `${n}. ${pet.name}`;
    if (label.length > 56) label = `${label.slice(0, 53)}…`;
    kb.text(`🐾 ${label}`, `search:pet:${pet.id}`).primary().row();
  });

  if (totalPages > 1) {
    if (safePage > 0) kb.text('◀️ قبلی', `search:page:${mode}:${safePage - 1}`).primary();
    kb.text(`${safePage + 1}/${totalPages}`, 'noop');
    if (safePage < totalPages - 1) kb.text('بعدی ▶️', `search:page:${mode}:${safePage + 1}`).primary();
    kb.row();
  }

  if (mode === 'nearby') {
    kb.text('📍 موقعیت دوباره', 'search:nearby:askloc').primary().row();
    kb.text('🔙 منوی اصلی', 'search:home').primary();
  } else {
    kb.text('🔎 منوی جستجو', 'search:menu').primary();
  }
  return kb;
}

function formatNearbyDistance(km: number): string {
  if (km < 0.1) return 'نزدیک';
  if (km < 1) return `${Math.round(km * 1000)} متر`;
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return `${rounded} کیلومتر`;
}

/** @deprecated استفاده از searchPetsListKeyboard */
export function searchResultsNavKeyboard(
  mode: string,
  page: number,
  hasMore: boolean
): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (page > 0) kb.text('◀️ قبلی', `search:page:${mode}:${page - 1}`).primary();
  if (hasMore) kb.text('بعدی ▶️', `search:page:${mode}:${page + 1}`).primary();
  if (page > 0 || hasMore) kb.row();
  kb.text('🔎 منوی جستجو', 'search:menu').primary();
  return kb;
}
