export * from './petdate';
export * from './catalog';
export * from './brand';
export * from './economy';
export * from './rx-suggestions';
export * from './profile-card';
export * from './peer-profile';
export * from './pet-slug';
export * from './hr';
export * from './admin-notifications';
export * from './gtm-contract';

import type {
  OnboardingStatus,
  PhotoModerationStatus,
  UserRole,
  VerificationStatus,
  VetCredentialStatus,
} from './petdate';
import type { UserGender } from './petdate';
import type { CoinAward, WalletBalances } from './economy';

export type GameType =
  | 'football'
  | 'volleyball'
  | 'basketball'
  | 'futsal'
  | 'tennis'
  | 'board'
  | 'other';

export type GameStatus = 'open' | 'full' | 'cancelled' | 'completed';

export {
  ONBOARDING_STATUS_LABELS,
  PET_AGE_CUSTOM_LABEL,
  PET_AGE_OPTIONS,
  PET_COLOR_CUSTOM_LABEL,
  PET_COLOR_OPTIONS,
  ORDER_PUBLIC_ID_PREFIX,
  CONSULT_PUBLIC_ID_PREFIX,
  PLAYDATE_PUBLIC_ID_PREFIX,
  PAYMENT_PUBLIC_ID_PREFIX,
  PET_PUBLIC_ID_PREFIX,
  PLAYDATE_REQUEST_TTL_MS,
  PLAYDATE_STATUS_LABELS,
  PROFILE_AGE_CHIP_VALUES,
  PROFILE_INTEREST_OPTIONS,
  ROLE_CONFIRM_LABEL,
  MY_ROLES_LABEL,
  ROLE_ADD_LABEL,
  ROLE_DASHBOARD_PATHS,
  USER_AGE_CUSTOM_LABEL,
  USER_AGE_MAX,
  USER_AGE_MIN,
  USER_GENDER_LABELS,
  USER_PUBLIC_ID_PREFIX,
  USER_ROLE_LABELS,
  USER_ROLES,
  VET_CONSULT_REQUEST_TTL_MS,
  VET_CREDENTIAL_STATUSES,
  VET_CREDENTIAL_STATUS_LABELS,
  dashboardPathForRole,
  dashboardPathForUser,
  faceVerifyIntroText,
  formatIranMobileDisplay,
  formatMedicalEntryAttribution,
  formatPersianDateTime,
  formatPetAge,
  formatUserAgeChip,
  formatVetAuthorName,
  formatVetRatingLine,
  isPendingRequestExpired,
  isPrimaryRole,
  makeOrderPublicId,
  makeConsultPublicId,
  makePlaydatePublicId,
  makePaymentPublicId,
  makePetPublicId,
  makeUserPublicId,
  normalizeOrderPublicId,
  normalizeConsultPublicId,
  normalizePlaydatePublicId,
  normalizePaymentPublicId,
  normalizePetPublicId,
  normalizeUserPublicId,
  orderPublicIdOf,
  consultPublicIdOf,
  playdatePublicIdOf,
  paymentPublicIdOf,
  parseOrderIdFromPublicId,
  normalizeIranMobile,
  normalizeRoles,
  REMOVED_USER_ROLES,
  sanitizeRoleList,
  parseDbDateMs,
  parsePetAgeInput,
  parsePetIdFromPublicId,
  parseUserAge,
  PET_MEDICAL_FIELD_LABELS,
  PET_MEDICAL_FIELDS,
  petPublicIdOf,
  phoneVerifyIntroText,
  primaryRole,
  profileAgeChipLabels,
  rankPlaymateMatches,
  requestRemainingMs,
  toEnglishDigits,
  toPersianDigits,
  userHasRole,
  userPublicIdOf,
  userCommandIdOf,
  toUserCommandId,
  makeUserCommandToken,
  parseUserIdFromCommand,
  VERIFIED_BADGE,
} from './petdate';
export type {
  BotStep,
  OnboardingStatus,
  PetDraft,
  PetGender,
  PetDiaryEntry,
  PetMedicalEntry,
  PetMedicalField,
  PetMedicalRecord,
  PetSize,
  PlaydateChatMessage,
  PlaydateChatMediaKind,
  PlaymateMatchScore,
  PlaydateRequest,
  PlaydateStatus,
  PetProfile,
  ProfileDraft,
  RemovedUserRole,
  UserGender,
  UserRole,
  PreviousVet,
  UserPresence,
  VetConsultChatMessage,
  VetConsultChatMediaKind,
  VetConsultation,
  VetConsultStatus,
  VetCredentialStatus,
  ConsultServiceKind,
  PhotoModerationStatus,
  ProviderCredentialStatus,
} from './petdate';
export {
  COUNTRY_IRAN,
  IRAN_CITIES_BY_PROVINCE,
  IRAN_PROVINCES,
  PROFILE_COUNTRIES,
  citiesForProvince,
} from './locations';
export type { PetBreed, PetSpecies, PetSpeciesCode } from './catalog';
export {
  PET_BREEDS_SEED,
  PET_GENDER_LABELS,
  PET_SIZE_LABELS,
  PET_SPECIES,
  PET_SPECIES_LABELS,
} from './catalog';

export type { Prescription } from './petdate';

export interface User {
  id: number;
  /** شناسه عمومی پایدار نمایشی (مثلاً PD-U00014) — یک نفر = یک آیدی، نقش‌ها جدا نیستند */
  publicId?: string;
  telegramId?: string;
  name: string;
  username?: string;
  sectionId?: number;
  role?: UserRole;
  roles?: UserRole[];
  onboarding?: OnboardingStatus;
  age?: number;
  gender?: UserGender;
  country?: string;
  city?: string;
  province?: string;
  phone?: string;
  email?: string;
  emailVerified?: boolean;
  /** تأیید OTP پیامکی (Candoo) */
  phoneVerified?: boolean;
  phoneVerifiedAt?: string;
  bio?: string;
  interests?: string[];
  avatarUrl?: string;
  /** true when user uploaded a site avatar — Telegram login must not overwrite it */
  avatarCustom?: boolean;
  /** تأیید ادمین برای نمایش عمومی عکس پروفایل */
  avatarModerationStatus?: PhotoModerationStatus;
  /** سکه ربات (هم‌تراز wallet.coins) */
  coins?: number;
  /** موجودی TON (Telegram Toncoin) */
  walletTon?: number;
  /** موجودی ستاره‌های تلگرام نگه‌داری‌شده */
  walletStars?: number;
  /** موجودی تومان (IRT) */
  walletToman?: number;
  /** کیف پول چندارزی — همیشه از mapUser پر می‌شود */
  wallet?: WalletBalances;
  /** آخرین دریافت سکه روزانه (ISO) */
  lastDailyCoinAt?: string;
  /** هدیه ثبت‌نام یک‌باره واریز شده؟ */
  signupBonusClaimed?: boolean;
  /** شناسه کاربری که این کاربر را دعوت کرده (لینک ref_) */
  referredBy?: number | null;
  /** کلیدهای بخش پروفایل که جایزه‌شان گرفته شده */
  profileRewards?: string[];
  /** جایزه‌هایی که همین پاسخ API تازه واریز کرده (ephemeral) */
  awardedRewards?: CoinAward[];
  profileViews?: number;
  likesCount?: number;
  /** false = حساب غیرفعال (سبک دوردوریا) */
  isActive?: boolean;
  /** درخواست چت/همبازی بدون اعلان مزاحم */
  silentChatRequests?: boolean;
  /** تعداد مخاطبین (غنی‌سازی در پاسخ پروفایل) */
  contactsCount?: number;
  /** تعداد بلاک‌شده‌ها (غنی‌سازی در پاسخ پروفایل) */
  blockedCount?: number;
  /** احراز هویت پروفایل مالک (سبک دوردوریا) */
  verificationStatus?: VerificationStatus;
  verificationPhotoFileId?: string;
  verifiedAt?: string;
  verificationNote?: string;
  /** مدرک دامپزشک (Telegram file_id) */
  vetCredentialFileId?: string;
  vetCredentialStatus?: VetCredentialStatus;
  /** دامپزشک آنلاین و آماده پذیرش بیمار */
  vetOnline?: boolean;
  /** دنبال‌کننده پت — آماده پذیرش / فرزندخواندگی */
  readyToAdopt?: boolean;
  /** false = توسط ادمین از لیست/اتصال پزشک‌ها خارج شده */
  vetEnabled?: boolean;
  /** مبلغ ویزیت دامپزشک به سکه (قابل تنظیم از پنل پزشک) */
  visitFeeCoins?: number;
  /** مدرک / آنلاین / فعال بودن مربی */
  trainerCredentialFileId?: string;
  trainerCredentialStatus?: VetCredentialStatus;
  trainerOnline?: boolean;
  trainerEnabled?: boolean;
  /** مدرک / آنلاین / فعال بودن پرستار پت */
  sitterCredentialFileId?: string;
  sitterCredentialStatus?: VetCredentialStatus;
  sitterOnline?: boolean;
  sitterEnabled?: boolean;
  /** صاحب پت: پذیرش مشورت خرید از دنبال‌کننده بدون پت */
  acceptSeekerAdvice?: boolean;
  /** آخرین عرض جغرافیایی اشتراک‌گذاری‌شده (ربات — پت‌های نزدیک) */
  lat?: number;
  /** آخرین طول جغرافیایی اشتراک‌گذاری‌شده */
  lng?: number;
  locationUpdatedAt?: string;
  /** میانگین امتیاز کاربران (۱–۵) — فقط برای دامپزشک */
  avgRating?: number;
  /** تعداد نظرات ثبت‌شده برای دامپزشک */
  ratingCount?: number;
  /** آخرین بازدید (فقط وقتی API peer/presence آن را برگرداند) */
  lastSeenAt?: string;
  createdAt: string;
}

/** امتیاز صاحب‌پت به دامپزشک پس از مشاوره */
export interface VetRating {
  id: number;
  consultId: number;
  vetUserId: number;
  patientUserId: number;
  rating: number;
  comment?: string;
  createdAt: string;
}

/** خلاصه امتیاز دامپزشک */
export interface VetRatingStats {
  vetUserId: number;
  avgRating: number;
  ratingCount: number;
}

export interface Section {
  id: number;
  name: string;
  description?: string;
  city?: string;
  memberCount: number;
  createdAt: string;
}

export interface Game {
  id: number;
  title: string;
  gameType: GameType;
  sectionId?: number;
  sectionName?: string;
  hostUserId: number;
  hostName?: string;
  location: string;
  scheduledAt: string;
  maxPlayers: number;
  currentPlayers: number;
  status: GameStatus;
  description?: string;
  createdAt: string;
}

export interface GamePlayer {
  id: number;
  gameId: number;
  userId: number;
  userName?: string;
  joinedAt: string;
}

export const GAME_TYPE_LABELS: Record<GameType, string> = {
  football: 'فوتبال',
  volleyball: 'والیبال',
  basketball: 'بسکتبال',
  futsal: 'فوتسال',
  tennis: 'تنیس',
  board: 'بازی فکری',
  other: 'سایر',
};

export const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  open: 'باز',
  full: 'تکمیل',
  cancelled: 'لغو شده',
  completed: 'برگزار شده',
};
export * from './admin-nav';
export * from './sales'
export * from './crm';
export * from './platform-settings';
export * from './finance-os';
export * from './pet-purchase-leads';
