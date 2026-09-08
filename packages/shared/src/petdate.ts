/** petdate domain types — shared by web, API, and Telegram bot */

export type UserRole =
  | 'pet_owner'
  | 'vet'
  | 'no_pet'
  | 'pet_seeker'
  | 'trainer';

/** Legacy roles removed from UX — migrated to pet_owner when they were the only role. */
export const REMOVED_USER_ROLES = ['pet_sitter', 'community_seeker'] as const;
export type RemovedUserRole = (typeof REMOVED_USER_ROLES)[number];

export type OnboardingStatus =
  | 'role_selected'
  | 'profile_incomplete'
  | 'profile_complete';

export type UserGender = 'male' | 'female';

/** وضعیت احراز هویت پروفایل مالک (سبک دوردوریا) */
export type VerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

export const VERIFICATION_STATUSES: VerificationStatus[] = [
  'none',
  'pending',
  'verified',
  'rejected',
];

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  none: 'احراز نشده',
  pending: 'در انتظار بررسی',
  verified: 'احراز شده',
  rejected: 'رد شده',
};

/** روش خرید سکه */
export type PaymentMethod = 'card' | 'stars' | 'coins' | 'toman';

/**
 * وضعیت سفارش پرداخت:
 * - awaiting_receipt: کارت — منتظر آپلود رسید
 * - pending: کارت — منتظر بررسی ادمین
 * - awaiting_stars: ستاره — فاکتور ارسال شده
 * - paid: ستاره — پرداخت موفق و سکه واریز شده
 * - approved: کارت — تأیید ادمین و سکه واریز شده
 * - rejected: کارت — رد شده
 * - cancelled: لغو
 */
export type PaymentOrderStatus =
  | 'awaiting_receipt'
  | 'pending'
  | 'awaiting_stars'
  | 'paid'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface PaymentOrder {
  id: number;
  userId: number;
  packageId: string;
  coins: number;
  amountToman?: number;
  amountStars?: number;
  method: PaymentMethod;
  status: PaymentOrderStatus;
  receiptFileId?: string;
  telegramPaymentChargeId?: string;
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
  /** join — برای اعلان ادمین */
  userName?: string;
  userTelegramId?: string;
  userUsername?: string;
}

/** بج نمایشی برای پروفایل‌های تأییدشده */
export const VERIFIED_BADGE = '✅ احراز شده';

/**
 * شناسهٔ عمومی پایدار (نمایشی) — جدا از id داخلی DB.
 * یک نفر = یک آیدی نمایشی برای وب و بات.
 * فرمت canonical: PD-U##### برای کاربر، PD-P##### برای پت.
 * پس از تخصیص تغییر نمی‌کند.
 *
 * نکته: `/u#####` فقط دستور عمیق تلگرام است (charset بدون خط تیره) —
 * برای نمایش «آیدی» به کاربر از userPublicIdOf استفاده کن، نه userCommandIdOf.
 */
export const USER_PUBLIC_ID_PREFIX = 'PD-U';
export const PET_PUBLIC_ID_PREFIX = 'PD-P';

export function makeUserPublicId(internalId: number): string {
  return `${USER_PUBLIC_ID_PREFIX}${String(Math.trunc(internalId)).padStart(5, '0')}`;
}

export function makePetPublicId(internalId: number): string {
  return `${PET_PUBLIC_ID_PREFIX}${String(Math.trunc(internalId)).padStart(5, '0')}`;
}

/**
 * نرمال‌سازی هر فرم شناخته‌شده به PD-U##### (با پد ۵رقمی).
 * قبول می‌کند: PD-U42، /u00042، u_00042، /user_PD-U00042، …
 */
export function normalizeUserPublicId(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const pd = /^(?:\/?user_)?PD-U(\d{1,10})$/i.exec(s);
  if (pd) return makeUserPublicId(Number(pd[1]));
  const cmd = /^\/?u_?(\d{1,10})(?:@\w+)?$/i.exec(s);
  if (cmd) return makeUserPublicId(Number(cmd[1]));
  return null;
}

/**
 * شناسهٔ نمایشی canonical کاربر — همیشه PD-U##### برای UI.
 * publicId ذخیره‌شده (حتی فرم قدیمی /u#####) را نرمال می‌کند؛ وگرنه از id داخلی مشتق می‌شود.
 */
export function userPublicIdOf(user: { id: number; publicId?: string | null }): string {
  const raw = user.publicId != null ? String(user.publicId).trim() : '';
  if (raw) {
    const normalized = normalizeUserPublicId(raw);
    if (normalized) return normalized;
    // شناسهٔ سفارشی ناشناخته — پایدار نگه دار (مهاجرت آینده)
    return raw;
  }
  return makeUserPublicId(user.id);
}

/**
 * نرمال‌سازی فرم‌های شناخته‌شده به PD-P##### (با پد ۵رقمی).
 * قبول می‌کند: PD-P42، PD-P00042، p00042، …
 */
export function normalizePetPublicId(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const pd = /^PD-P(\d{1,10})$/i.exec(s);
  if (pd) return makePetPublicId(Number(pd[1]));
  const bare = /^p_?(\d{1,10})$/i.exec(s);
  if (bare) return makePetPublicId(Number(bare[1]));
  return null;
}

/** شناسهٔ نمایشی پت — publicId ذخیره‌شده یا مشتق از id */
export function petPublicIdOf(pet: { id: number; publicId?: string | null }): string {
  const raw = pet.publicId != null ? String(pet.publicId).trim() : '';
  if (raw) {
    const normalized = normalizePetPublicId(raw);
    if (normalized) return normalized;
    return raw;
  }
  return makePetPublicId(pet.id);
}

/** استخراج id داخلی از آیدی عمومی پت (PD-P##### / p#####) */
export function parsePetIdFromPublicId(raw: string): number | null {
  const normalized = normalizePetPublicId(raw);
  if (!normalized) return null;
  const m = /^PD-P(\d+)$/i.exec(normalized);
  return m ? Number(m[1]) : null;
}

/**
 * توکن دستور تلگرام (بدون `/`) — فقط a-z / 0-9 / _ (خط تیرهٔ PD-U مجاز نیست).
 * مثال: PD-U00042 → u00042
 */
export function makeUserCommandToken(internalId: number): string {
  return `u${String(Math.trunc(internalId)).padStart(5, '0')}`;
}

/**
 * دستور عمیق تلگرام (قابل‌ضربه): `/u00042`
 * فقط برای bot_command — نه برای برچسب «آیدی» در UI.
 */
export function userCommandIdOf(user: { id: number; publicId?: string | null }): string {
  const publicId = userPublicIdOf(user);
  const fromPublic = /^PD-U(\d+)$/i.exec(publicId);
  if (fromPublic) return `/u${fromPublic[1].padStart(5, '0')}`;
  return `/${makeUserCommandToken(user.id)}`;
}

/** تبدیل PD-U##### یا /u##### یا u_##### به فرم دستور `/u#####` */
export function toUserCommandId(raw: string | { id: number; publicId?: string | null }): string {
  if (typeof raw !== 'string') return userCommandIdOf(raw);
  const s = String(raw).trim();
  if (!s) return s;
  const cmd = /^\/?u_?(\d{1,10})(?:@\w+)?$/i.exec(s);
  if (cmd) return `/u${cmd[1]}`;
  const pd = /^(?:\/?user_)?PD-U(\d{1,10})$/i.exec(s);
  if (pd) return `/u${pd[1]}`;
  if (s.startsWith('/')) return s;
  return `/${s.replace(/[^a-zA-Z0-9_]/g, '')}`;
}

/**
 * استخراج id داخلی از دستور/پی‌لود:
 * `/u00042`, `/u00042@Bot`, `u_00042`, `u00042`, `PD-U00042`, `/user_PD-U00042`
 */
export function parseUserIdFromCommand(raw: string): number | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  const stripped = s.replace(/@\w+$/i, '').trim();
  const patterns = [
    /^\/?u_?(\d{1,10})$/i,
    /^(?:\/?user_)?PD-U(\d{1,10})$/i,
    /^\/?user_PD-U(\d{1,10})$/i,
  ];
  for (const re of patterns) {
    const m = re.exec(stripped);
    if (!m) continue;
    const id = Number(m[1]);
    if (Number.isFinite(id) && id > 0) return Math.trunc(id);
  }
  return null;
}

/** متن معرفی احراز چهره — سبک دوردوریا */
export function faceVerifyIntroText(rewardCoins: number): string {
  const reward = new Intl.NumberFormat('fa-IR').format(rewardCoins);
  return [
    '🛡 <b>احراز چهره</b>',
    '',
    'اعتماد بیشتر = آشنایی امن‌تر 🤝',
    '',
    'با احراز چهره:',
    '✔️ پروفایلت واقعی‌تر دیده می‌شه',
    '✔️ اعتماد بقیه بیشتر می‌شه',
    '✔️ فضای امن‌تری می‌سازی',
    '',
    `🎁 جایزه پس از تأیید ادمین: <b>${reward}</b> سکه`,
    '',
    'یک <b>سلفی واضح</b> از چهره‌ات بفرست (یا ویدیوی کوتاه از چهره).',
    'عکس/ویدیو باید با چهرهٔ خودت یکی باشه.',
  ].join('\n');
}

/** وضعیت مدرک دامپزشک */
export type VetCredentialStatus = 'none' | 'pending' | 'verified';

export const VET_CREDENTIAL_STATUSES: VetCredentialStatus[] = [
  'none',
  'pending',
  'verified',
];

export const VET_CREDENTIAL_STATUS_LABELS: Record<VetCredentialStatus, string> = {
  none: 'مدرک ارسال نشده',
  pending: 'در انتظار بررسی مدرک',
  verified: 'مدرک تأیید شده',
};

export interface PetdateUser {
  id: number;
  /** شناسه عمومی پایدار نمایشی (مثلاً PD-U00014) */
  publicId?: string;
  telegramId?: string;
  phone?: string;
  /** موبایل با OTP تأیید شده (Candoo) */
  phoneVerified?: boolean;
  phoneVerifiedAt?: string;
  email?: string;
  name: string;
  username?: string;
  role?: UserRole;
  /** چند نقش همزمان — role برای سازگاری همان نقش اصلی است */
  roles?: UserRole[];
  onboarding: OnboardingStatus;
  locale: string;
  avatarUrl?: string;
  /** true when user uploaded a site avatar — Telegram login must not overwrite it */
  avatarCustom?: boolean;
  age?: number;
  gender?: UserGender;
  city?: string;
  province?: string;
  country?: string;
  bio?: string;
  interests?: string[];
  /** سکه ربات */
  coins?: number;
  walletTon?: number;
  walletStars?: number;
  walletToman?: number;
  profileViews?: number;
  likesCount?: number;
  isActive?: boolean;
  /** درخواست چت/همبازی بدون نوتیف مزاحم */
  silentChatRequests?: boolean;
  contactsCount?: number;
  blockedCount?: number;
  verificationStatus?: VerificationStatus;
  verificationPhotoFileId?: string;
  verifiedAt?: string;
  verificationNote?: string;
  /** فایل مدرک دامپزشک (Telegram file_id) */
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
  /** آخرین عرض جغرافیایی اشتراک‌گذاری‌شده */
  lat?: number;
  /** آخرین طول جغرافیایی اشتراک‌گذاری‌شده */
  lng?: number;
  locationUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileDraft {
  name?: string;
  age?: number;
  gender?: UserGender;
  country?: string;
  city?: string;
  province?: string;
  phone?: string;
  avatarFileId?: string;
  bio?: string;
  interests?: string[];
}

/** علایق پیش‌فرض پروفایل (سبک دوردوریا) */
export const PROFILE_INTEREST_OPTIONS = [
  '🐾 همبازی پت',
  '🚶 پیاده‌روی',
  '🎓 آموزش',
  '🏕 سفر با پت',
  '📸 عکاسی',
  '🏃 ورزش',
  '☕ کافه پت‌فرندلی',
  '💚 داوطلبانه',
] as const;

export type PetGender = 'male' | 'female';
export type PetSize = 'small' | 'medium' | 'large';

export interface PetProfile {
  id: number;
  /** شناسه عمومی پایدار نمایشی (مثلاً PD-P00025) */
  publicId?: string;
  ownerId: number;
  name: string;
  species: string;
  breed?: string;
  gender?: PetGender;
  ageMonths?: number;
  size?: PetSize;
  color?: string;
  bio?: string;
  vaccinated: boolean;
  neutered: boolean;
  lookingForPlaymate: boolean;
  personality: Record<string, unknown>;
  health: Record<string, unknown>;
  imageUrl?: string;
  city?: string;
  neighborhood?: string;
  /** از پروفایل صاحب پت (برای مچ همبازی) */
  ownerProvince?: string;
  ownerCity?: string;
  /** نام صاحب پت (برای لیست نزدیک) */
  ownerName?: string;
  /** صاحب پت احراز هویت شده */
  ownerVerified?: boolean;
  /** آواتار صاحب پت (برای کارت پروفایل ترکیبی) */
  ownerAvatarUrl?: string;
  /** آخرین فعالیت/موقعیت صاحب (برای «آخرین بازدید») */
  ownerLastSeenAt?: string;
  /** فاصله تا موقعیت درخواست‌کننده (کیلومتر) — فقط در نتایج nearby */
  distanceKm?: number;
  createdAt: string;
  updatedAt: string;
}

export type PlaydateStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'expired';

/** Pending playmate / chat requests auto-close after 2 minutes. */
export const PLAYDATE_REQUEST_TTL_MS = 120_000;

/**
 * Parse SQLite `datetime('now')` (`YYYY-MM-DD HH:MM:SS`, UTC) or ISO strings.
 */
export function parseDbDateMs(value: string | undefined | null): number {
  const raw = String(value ?? '').trim();
  if (!raw) return NaN;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    return Date.parse(raw.replace(' ', 'T') + 'Z');
  }
  return Date.parse(raw);
}

export function isPendingRequestExpired(
  createdAt: string | undefined | null,
  ttlMs: number = PLAYDATE_REQUEST_TTL_MS,
  nowMs: number = Date.now()
): boolean {
  const created = parseDbDateMs(createdAt);
  if (!Number.isFinite(created)) return false;
  return nowMs - created >= ttlMs;
}

export function requestRemainingMs(
  createdAt: string | undefined | null,
  ttlMs: number = PLAYDATE_REQUEST_TTL_MS,
  nowMs: number = Date.now()
): number {
  const created = parseDbDateMs(createdAt);
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, ttlMs - (nowMs - created));
}

export interface PlaydateRequest {
  id: number;
  fromPetId: number;
  toPetId: number;
  fromUserId: number;
  toUserId?: number;
  message?: string;
  status: PlaydateStatus;
  scheduledAt?: string;
  location?: string;
  /** چت امن برای پیام‌های همبازی (protect_content در تلگرام) */
  chatSecure?: boolean;
  /** چت از طرف یکی از کاربران قطع شده */
  chatEnded?: boolean;
  createdAt: string;
  updatedAt: string;
  fromPet?: PetProfile;
  toPet?: PetProfile;
}

/** نوع رسانهٔ پیام چت همبازی (از تلگرام یا وب) */
export type PlaydateChatMediaKind =
  | 'photo'
  | 'video'
  | 'animation'
  | 'video_note'
  | 'document'
  | 'voice'
  | 'audio'
  | 'sticker';

/** پیام چت همبازی (وب ↔ تلگرام) */
export interface PlaydateChatMessage {
  id: number;
  playdateId: number;
  senderUserId: number;
  text: string;
  mediaKind?: PlaydateChatMediaKind | null;
  telegramFileId?: string | null;
  /** Local upload key under API chat-uploads (web attach). */
  storageKey?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  createdAt: string;
}

/** وضعیت مشاوره دامپزشک */
export type VetConsultStatus =
  | 'requested'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'expired';

/** Pending vet consult requests auto-close after 2 minutes (same as playmate). */
export const VET_CONSULT_REQUEST_TTL_MS = PLAYDATE_REQUEST_TTL_MS;

/** رکورد مشاوره — برای لیست بیماران دامپزشک */
export interface VetConsultation {
  id: number;
  vetUserId: number;
  patientUserId: number;
  petId?: number;
  status: VetConsultStatus;
  notes?: string;
  /** مبلغ ویزیت توافق‌شده هنگام ایجاد درخواست (سکه) */
  feeCoins?: number;
  /** زمان واریز درآمد به دامپزشک (idempotent payout) */
  vetPaidAt?: string;
  /** چت امن برای پیام‌های مشاوره (protect_content در تلگرام) */
  chatSecure?: boolean;
  /** چت از طرف یکی از کاربران قطع شده */
  chatEnded?: boolean;
  createdAt: string;
  /** آخرین پیام یا ایجاد — برای مرتب‌سازی inbox */
  lastActivityAt?: string;
  /** غنی‌سازی در API */
  patientName?: string;
  patientCity?: string;
  vetName?: string;
  petName?: string;
  petSpecies?: string;
  petBreed?: string;
}

/** نوع رسانهٔ پیام چت مشاوره (همان مجموعهٔ همبازی) */
export type VetConsultChatMediaKind = PlaydateChatMediaKind;

/** پیام چت مشاوره دامپزشک (وب) */
export interface VetConsultChatMessage {
  id: number;
  consultId: number;
  senderUserId: number;
  text: string;
  mediaKind?: VetConsultChatMediaKind | null;
  telegramFileId?: string | null;
  /** Local upload key under API chat-uploads (web attach). */
  storageKey?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  createdAt: string;
}

/** Online if lastSeenAt is within this window (ms). */
export const USER_PRESENCE_ONLINE_MS = 90_000;

/** وضعیت آنلاین بودن کاربر (heartbeat / last_seen) */
export interface UserPresence {
  userId: number;
  online: boolean;
  lastSeenAt: string | null;
}

/** دامپزشکی که بیمار قبلاً باهاش مشاوره داشته (برای ارتباط سریع) */
export interface PreviousVet {
  id: number;
  name: string;
  city?: string;
  telegramId?: string;
  lastConsultAt: string;
  avgRating?: number;
  ratingCount?: number;
}

/** نسخه دارویی صادرشده توسط دامپزشک */
export interface Prescription {
  id: number;
  consultId?: number;
  petId: number;
  vetUserId: number;
  patientUserId: number;
  text: string;
  pdfPath?: string;
  createdAt: string;
  /** غنی‌سازی */
  vetName?: string;
  patientName?: string;
  petName?: string;
  petSpecies?: string;
  petBreed?: string;
}

export interface BotSession {
  telegramId: string;
  userId?: number;
  role?: UserRole;
  /** نقش‌های در حال انتخاب در مرحله role_select */
  draftRoles?: UserRole[];
  /** true = افزودن/ویرایش نقش از منوی «نقش‌های من» (نه آنبوردینگ اولیه) */
  addingRoles?: boolean;
  step: BotStep;
  locale: string;
  draftPet?: PetDraft;
  draftProfile?: ProfileDraft;
  selectedPetId?: number;
  selectedToPetId?: number;
  explorePage?: number;
  /** پتی که برایش همبازی می‌گردیم؛ undefined = همه / هنوز انتخاب نشده */
  exploreForPetId?: number;
  /** آیا کاربر پت مبدأ را برای جست‌وجوی همبازی انتخاب کرده */
  exploreForPicked?: boolean;
  /** صفحهٔ نژاد در ویزارد ثبت پت (reply keyboard) */
  breedPage?: number;
  /** حالت مرور/جستجوی پت */
  searchMode?: 'nearby' | 'breed' | 'province' | 'samebreed' | 'newest' | 'popular' | 'all';
  /** مختصات برای صفحه‌بندی پت‌های نزدیک (بعد از ارسال موقعیت) */
  searchLat?: number;
  searchLng?: number;
  /** شعاع جستجوی نزدیک (کیلومتر) */
  searchRadiusKm?: number;
  /** گونهٔ انتخاب‌شده در جستجو بر اساس نژاد */
  searchSpecies?: string;
  searchBreed?: string;
  searchPage?: number;
  searchBreedPage?: number;
  /** فروش سکه — منتظر شماره کارت */
  earnPendingCoins?: number;
  /** خرید سکه کارت‌به‌کارت — سفارش در انتظار رسید */
  paymentPendingOrderId?: number;
  /** ادمین — رد احراز هویت برای این userId */
  adminRejectUserId?: number;
  /** ادمین — ورود با رمز (وقتی ADMIN_IDS خالی است) */
  adminAuthed?: boolean;
  /**
   * ویرایش تک‌فیلدی پروفایل (نه ویزارد کامل).
   * بعد از ذخیرهٔ همان فیلد به منوی بخش‌ها برمی‌گردیم.
   */
  profileSectionEdit?: boolean;
  /**
   * ویرایش تک‌فیلدی پروفایل پت (از پت‌های من).
   * بعد از ذخیره به کارت پروفایل پت برمی‌گردیم.
   */
  petSectionEdit?: boolean;
  /** شماره در انتظار OTP احراز موبایل (نرمال‌شده 98…) */
  pendingPhone?: string;
  /** زمان مجاز بعدی برای ارسال مجدد OTP (epoch ms) */
  phoneOtpResendAt?: number;
  /** چت مشاوره دامپزشک — شناسه مشاوره */
  vetChatConsultId?: number;
  /** تلگرام طرف مقابل در چت مشاوره */
  vetChatPeerTelegramId?: string;
  /** نقش در چت: دامپزشک یا بیمار */
  vetChatRole?: 'vet' | 'patient';
  /** یک‌بار پیشنهاد لینک چت وب در جلسه مشاوره (جلوگیری از تکرار) */
  vetChatWebHintSent?: boolean;
  /** چت مالک↔مالک بعد از قبول همبازی — شناسه درخواست */
  ownerChatPlaydateId?: number;
  /** تلگرام طرف مقابل در چت همبازی */
  ownerChatPeerTelegramId?: string;
  /** شناسه کاربر طرف مقابل در چت همبازی */
  ownerChatPeerUserId?: number;
  /** پت خودم در این چت همبازی */
  ownerChatMyPetId?: number;
  /** پت طرف مقابل در این چت همبازی */
  ownerChatPeerPetId?: number;
  /** چت امن — پیام‌ها با protect_content و غیرقابل ذخیره */
  ownerChatSecure?: boolean;
  /** یک‌بار پیشنهاد لینک چت وب در جلسه همبازی (جلوگیری از تکرار) */
  ownerChatWebHintSent?: boolean;
  /** ثبت مورد در پرونده پزشکی (پت انتخاب‌شده) */
  medicalNotePetId?: number;
  /** نوشتن نسخه — پت انتخاب‌شده */
  prescriptionPetId?: number;
  /** پیش‌نویس متن نسخه (پیشنهاد دارو / دستی) قبل از تأیید صدور */
  prescriptionDraft?: string;
  /** پت‌شاپ — سبد موقت ربات (هم‌تراز کاتالوگ وب/DB) */
  shopCart?: Array<{ productId: string; qty: number }>;
  /** پت‌شاپ — فیلتر مرور */
  shopPetType?: 'dog' | 'cat' | 'bird' | 'all';
  shopCategorySlug?: string;
  shopPage?: number;
  /** پت‌شاپ — پیش‌نویس چک‌اوت */
  shopCheckout?: {
    productId: string;
    qty: number;
    /**
     * coins=سکه پنل · wallet_stars=ستاره پنل · telegram_stars/stars=فاکتور XTR تلگرام
     * toman=کیف‌پول تومان · card=کارت‌به‌کارت (رسید → تأیید ادمین)
     */
    method?: 'coins' | 'wallet_stars' | 'telegram_stars' | 'stars' | 'toman' | 'card';
    name?: string;
    phone?: string;
    address?: string;
  };
  updatedAt: string;
}

/** پرونده پزشکی پت */
export interface PetMedicalRecord {
  petId: number;
  notes?: string;
  vaccinations?: string;
  allergies?: string;
  chronicConditions?: string;
  lastCheckup?: string;
  medications?: string;
  /** آخرین ویرایشگر فیلدهای خلاصه پرونده */
  lastUpdatedByUserId?: number;
  /** نام نمایشی ویرایشگر در زمان آخرین به‌روزرسانی */
  lastUpdatedByName?: string;
  updatedAt: string;
}

export interface PetMedicalEntry {
  id: number;
  petId: number;
  authorUserId: number;
  /** نام پزشک/نویسنده در زمان ثبت (snapshot) */
  authorName?: string;
  consultId?: number;
  text: string;
  createdAt: string;
}

export type PetMedicalField =
  | 'notes'
  | 'vaccinations'
  | 'allergies'
  | 'chronicConditions'
  | 'lastCheckup'
  | 'medications';

export const PET_MEDICAL_FIELD_LABELS: Record<PetMedicalField, string> = {
  notes: 'یادداشت / تاریخچه',
  vaccinations: 'واکسیناسیون',
  allergies: 'آلرژی‌ها',
  chronicConditions: 'بیماری‌های مزمن',
  lastCheckup: 'آخرین چکاپ',
  medications: 'داروها',
};

export const PET_MEDICAL_FIELDS: PetMedicalField[] = [
  'notes',
  'vaccinations',
  'allergies',
  'chronicConditions',
  'lastCheckup',
  'medications',
];

/** نام پزشک برای نمایش در پرونده (اگر «دکتر» نداشت اضافه می‌شود) */
export function formatVetAuthorName(name?: string | null, fallbackUserId?: number): string {
  const raw = (name || '').trim();
  if (!raw) {
    return fallbackUserId != null ? `کاربر #${fallbackUserId}` : 'نامشخص';
  }
  if (/^دکتر\s/.test(raw) || /^دكتر\s/.test(raw)) return raw;
  return `دکتر ${raw}`;
}

/** تاریخ شمسی کوتاه مثل ۱۴۰۳/۰۶/۱۴ — ۱۲:۳۰ */
export function formatPersianDateTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'));
  if (Number.isNaN(d.getTime())) {
    // sqlite datetime('now') بدون TZ — به عنوان UTC نخوان؛ فقط رقم‌ها را فارسی کن
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!m) return toPersianDigits(iso.slice(0, 16));
    return toPersianDigits(`${m[1]}/${m[2]}/${m[3]}${m[4] ? ` — ${m[4]}:${m[5]}` : ''}`);
  }
  try {
    const datePart = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
    const timePart = new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    return `${datePart} — ${timePart}`;
  } catch {
    return toPersianDigits(iso.slice(0, 16).replace('T', ' '));
  }
}

/** خط انتساب ثبت بالینی برای نمایش پرونده */
export function formatMedicalEntryAttribution(entry: {
  authorName?: string;
  authorUserId: number;
  createdAt: string;
}): string {
  const who = formatVetAuthorName(entry.authorName, entry.authorUserId);
  const when = formatPersianDateTime(entry.createdAt);
  return when ? `🩺 ثبت‌شده توسط: ${who} · ${when}` : `🩺 ثبت‌شده توسط: ${who}`;
}


export type BotStep =
  | 'start'
  | 'role_select'
  | 'profile_name'
  | 'profile_age'
  | 'profile_gender'
  | 'profile_country'
  | 'profile_province'
  | 'profile_city'
  | 'profile_phone'
  | 'profile_photo'
  | 'profile_bio'
  | 'profile_interests'
  | 'profile_edit_menu'
  | 'vet_credential'
  | 'search_species'
  | 'search_breed'
  | 'awaiting_location_for_nearby'
  | 'awaiting_nearby_radius'
  | 'earn_card'
  | 'payment_receipt'
  | 'pet_name'
  | 'pet_species'
  | 'pet_breed'
  | 'pet_gender'
  | 'pet_age'
  | 'pet_size'
  | 'pet_color'
  | 'pet_vaccinated'
  | 'pet_neutered'
  | 'pet_diseases'
  | 'pet_city'
  | 'pet_looking'
  | 'pet_bio'
  | 'pet_photo'
  | 'pet_edit_menu'
  | 'playdate_message'
  | 'verify_photo'
  | 'phone_verify_ask'
  | 'phone_verify_otp'
  | 'admin_reject_reason'
  | 'admin_password'
  | 'vet_chat'
  | 'vet_medical_note'
  | 'vet_prescription'
  | 'vet_visit_fee'
  | 'owner_chat'
  | 'shop_checkout_name'
  | 'shop_checkout_phone'
  | 'shop_checkout_address'
  | 'ready';

export interface PetDraft {
  name?: string;
  species?: string;
  breed?: string;
  gender?: PetGender;
  ageMonths?: number;
  size?: PetSize;
  color?: string;
  vaccinated?: boolean;
  neutered?: boolean;
  diseases?: string;
  lookingForPlaymate?: boolean;
  city?: string;
  neighborhood?: string;
  bio?: string;
  imageUrl?: string;
}

export const PLAYDATE_STATUS_LABELS: Record<PlaydateStatus, string> = {
  pending: 'در انتظار',
  accepted: 'پذیرفته',
  rejected: 'رد شده',
  cancelled: 'لغو شده',
  expired: 'منقضی شده',
};

export const USER_ROLES: UserRole[] = [
  'pet_owner',
  'vet',
  'no_pet',
  'pet_seeker',
  'trainer',
];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  pet_owner: '🐾 صاحب پت',
  vet: '🩺 دامپزشک',
  no_pet: '🏠 بدون پت',
  pet_seeker: '🔍 دنبال پت',
  trainer: '🎓 مربی',
};

export const ROLE_CONFIRM_LABEL = '✅ ثبت نقش‌ها';
export const MY_ROLES_LABEL = '🎭 نقش‌های من';
export const ROLE_ADD_LABEL = '➕ افزودن نقش';

/**
 * مسیر داشبورد اختصاصی هر نقش (وب).
 * ربات معادل همین را با منوی reply keyboard نشان می‌دهد.
 */
export const ROLE_DASHBOARD_PATHS: Record<UserRole, string> = {
  pet_owner: '/home',
  vet: '/vet-consult',
  no_pet: '/home',
  pet_seeker: '/home',
  trainer: '/home',
};

/**
 * نقش فعال/اصلی.
 * اگر fallback (ستون role) بین نقش‌های کاربر باشد، همان اولویت دارد؛
 * وگرنه صاحب پت، وگرنه اولین نقش.
 */
export function primaryRole(roles: UserRole[] | undefined | null, fallback?: UserRole | null): UserRole | undefined {
  const list = normalizeRoles(roles, fallback);
  if (!list.length) return undefined;
  if (fallback && list.includes(fallback)) return fallback;
  if (list.includes('pet_owner')) return 'pet_owner';
  return list[0];
}

function isRemovedRole(value: unknown): value is RemovedUserRole {
  return typeof value === 'string' && (REMOVED_USER_ROLES as readonly string[]).includes(value);
}

/**
 * Drop removed roles (نگهبان / جامعه پت). If nothing valid remains but a
 * removed role was present, fall back to pet_owner so login/onboarding stay intact.
 */
export function sanitizeRoleList(
  roles?: readonly string[] | null,
  fallback?: string | null
): UserRole[] {
  const raw = [...(roles ?? [])];
  if (fallback) raw.push(fallback);
  const hadRemoved = raw.some(isRemovedRole);
  const kept = raw.filter((r): r is UserRole => USER_ROLES.includes(r as UserRole));
  if (kept.length) return [...new Set(kept)];
  if (hadRemoved) return ['pet_owner'];
  return [];
}

export function normalizeRoles(
  roles?: UserRole[] | null,
  fallback?: UserRole | null
): UserRole[] {
  return sanitizeRoleList(roles as string[] | null | undefined, fallback);
}

export function userHasRole(
  user: { role?: UserRole | null; roles?: UserRole[] | null } | null | undefined,
  role: UserRole
): boolean {
  if (!user) return false;
  const roles = normalizeRoles(user.roles, user.role);
  return roles.includes(role);
}

/** آیا نقش فعال/اصلی کاربر همین است؟ (متفاوت از userHasRole که مالکیت نقش را چک می‌کند) */
export function isPrimaryRole(
  user: { role?: UserRole | null; roles?: UserRole[] | null } | null | undefined,
  role: UserRole
): boolean {
  if (!user) return false;
  return primaryRole(user.roles, user.role) === role;
}

/** مسیر داشبورد وب برای نقش فعال کاربر */
export function dashboardPathForRole(role?: UserRole | null): string {
  if (!role || !(role in ROLE_DASHBOARD_PATHS)) return '/home';
  return ROLE_DASHBOARD_PATHS[role];
}

export function dashboardPathForUser(
  user: { role?: UserRole | null; roles?: UserRole[] | null } | null | undefined
): string {
  return dashboardPathForRole(primaryRole(user?.roles, user?.role));
}

export const USER_GENDER_LABELS: Record<UserGender, string> = {
  male: '👨 آقا',
  female: '👩 خانم',
};

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  role_selected: 'نقش انتخاب شده',
  profile_incomplete: 'پروفایل ناقص',
  profile_complete: 'پروفایل کامل',
};

/** گزینه‌های سن پت با برچسب خوانا (ذخیره به‌صورت ماه) */
export const PET_AGE_OPTIONS: ReadonlyArray<{ label: string; months: number }> = [
  { label: '🎂 زیر ۲ ماه', months: 1 },
  { label: '🎂 ۲ ماهه', months: 2 },
  { label: '🎂 ۳ ماهه', months: 3 },
  { label: '🎂 ۴ ماهه', months: 4 },
  { label: '🎂 ۶ ماهه', months: 6 },
  { label: '🎂 ۹ ماهه', months: 9 },
  { label: '🎂 ۱ ساله', months: 12 },
  { label: '🎂 ۱٫۵ ساله', months: 18 },
  { label: '🎂 ۲ ساله', months: 24 },
  { label: '🎂 ۳ ساله', months: 36 },
  { label: '🎂 ۴ ساله', months: 48 },
  { label: '🎂 ۵ ساله', months: 60 },
  { label: '🎂 ۷ ساله', months: 84 },
  { label: '🎂 ۱۰ ساله', months: 120 },
  { label: '🎂 ۱۲ ساله+', months: 144 },
] as const;

export const PET_AGE_CUSTOM_LABEL = '✏️ سن دقیق';

/** رنگ‌های رایج پت برای انتخاب دکمه‌ای */
export const PET_COLOR_OPTIONS = [
  '⬛ مشکی',
  '⬜ سفید',
  '🟫 قهوه‌ای',
  '🟨 طلایی',
  '🟡 کرم',
  '🩶 خاکستری',
  '🟧 نارنجی',
  '🌈 سه‌رنگ',
  '🎨 دو‌رنگ',
  '⬛⬜ مشکی-سفید',
  '⬛🟫 مشکی-قهوه‌ای',
  '🟫⬜ قهوه‌ای-سفید',
] as const;

export const PET_COLOR_CUSTOM_LABEL = '✏️ رنگ دیگر';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function toEnglishDigits(raw: string): string {
  return raw
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/**
 * نرمال‌سازی موبایل ایران به فرم بین‌المللی بدون +: 98912xxxxxxx
 * ورودی‌های مجاز: 09…، +989…، 989…، 9…
 */
export function normalizeIranMobile(raw: string): string | null {
  let digits = toEnglishDigits(raw ?? '')
    .replace(/[^\d]/g, '')
    .trim();
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('98') && digits.length >= 12) {
    digits = digits.slice(0, 12);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = `98${digits.slice(1)}`;
  } else if (digits.startsWith('9') && digits.length === 10) {
    digits = `98${digits}`;
  } else {
    return null;
  }
  // موبایل ایران: 989 + ۹ رقم (اپراتور با ۹ شروع می‌شود)
  if (!/^989\d{9}$/.test(digits)) return null;
  return digits;
}

/** نمایش موبایل به صورت ۰۹۱۲… */
export function formatIranMobileDisplay(phone: string): string {
  const n = normalizeIranMobile(phone) ?? phone.replace(/[^\d]/g, '');
  if (n.startsWith('98') && n.length === 12) return `0${n.slice(2)}`;
  return phone;
}

/** متن معرفی احراز موبایل */
export function phoneVerifyIntroText(opts?: { required?: boolean }): string {
  const required = opts?.required
    ? 'برای دامپزشکان احراز موبایل <b>اجباری</b> است.'
    : 'احراز موبایل اختیاری است — برای اعتماد بیشتر پیشنهاد می‌شه.';
  return [
    '📱 <b>احراز موبایل</b>',
    '',
    required,
    '',
    'شماره موبایل ایرانیت رو بفرست یا دکمهٔ «ارسال شماره تماس» رو بزن.',
    'یک کد تأیید پیامکی برات می‌فرستیم.',
  ].join('\n');
}


export function toPersianDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d);
}

/** محدوده سن کاربر (سال) در ثبت‌نام / پروفایل */
export const USER_AGE_MIN = 13;
export const USER_AGE_MAX = 90;

/** مقادیر دکمه‌ای سن کاربر — بدون ایموجی تا روی موبایل/دسکتاپ قابل لمس باشد */
export const PROFILE_AGE_CHIP_VALUES = [
  18, 20, 22, 24, 25, 26, 27, 28, 30, 32, 35, 40, 45, 50,
] as const;

export const USER_AGE_CUSTOM_LABEL = '✏️ سن دیگر';

/** برچسب دکمه سن کاربر (رقم پارسی) */
export function formatUserAgeChip(age: number): string {
  return toPersianDigits(age);
}

/** لیست برچسب‌های کیبورد سن پروفایل (ربات) */
export function profileAgeChipLabels(): string[] {
  return [
    ...PROFILE_AGE_CHIP_VALUES.map((n) => formatUserAgeChip(n)),
    USER_AGE_CUSTOM_LABEL,
  ];
}

/**
 * پارس سن کاربر از دکمه / ورودی آزاد.
 * پشتیبانی: رقم پارسی/عربی/لاتین، «۲۵ ساله»، «🎂 25»، برچسب دکمه
 */
export function parseUserAge(raw: string): number | null {
  const trimmed = (raw ?? '')
    .trim()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک');
  if (!trimmed || trimmed === USER_AGE_CUSTOM_LABEL) return null;

  for (const n of PROFILE_AGE_CHIP_VALUES) {
    const fa = formatUserAgeChip(n);
    if (
      trimmed === fa ||
      trimmed === String(n) ||
      trimmed === `🎂 ${n}` ||
      trimmed === `🎂 ${fa}` ||
      trimmed === `${n} ساله` ||
      trimmed === `${fa} ساله`
    ) {
      return n;
    }
  }

  const text = toEnglishDigits(trimmed);
  const match = text.match(/(\d{1,2})/);
  if (!match) return null;
  const age = Number(match[1]);
  if (!Number.isFinite(age) || age < USER_AGE_MIN || age > USER_AGE_MAX) return null;
  return age;
}

/** نمایش امتیاز دامپزشک — مثلاً «⭐ ۴.۶ (۱۲ نظر)» یا پیام خالی */
export function formatVetRatingLine(
  avgRating?: number | null,
  ratingCount?: number | null,
  opts?: { emptyLabel?: string }
): string {
  const count = ratingCount != null ? Math.max(0, Math.floor(Number(ratingCount))) : 0;
  if (!count || avgRating == null || !Number.isFinite(avgRating)) {
    return opts?.emptyLabel ?? 'هنوز نظری ثبت نشده';
  }
  const avg = Math.round(Number(avgRating) * 10) / 10;
  const avgText = toPersianDigits(avg % 1 === 0 ? String(avg) : avg.toFixed(1));
  return `⭐ ${avgText} (${toPersianDigits(count)} نظر)`;
}

/** نمایش سن پت به فارسی خوانا */
export function formatPetAge(ageMonths: number): string {
  if (!Number.isFinite(ageMonths) || ageMonths < 1) return '—';
  const months = Math.round(ageMonths);
  if (months < 12) return `${toPersianDigits(months)} ماهه`;
  if (months === 18) return '۱٫۵ ساله';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${toPersianDigits(years)} ساله`;
  if (rem === 6 && years === 1) return '۱٫۵ ساله';
  return `${toPersianDigits(years)} سال و ${toPersianDigits(rem)} ماه`;
}

/**
 * پارس ورودی سن پت.
 * پشتیبانی: برچسب دکمه، «۲ ساله»، «۸ ماهه»، «۱ سال و ۳ ماه»، عدد خام
 */
export function parsePetAgeInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/ي/g, 'ی').replace(/ك/g, 'ک');
  if (!trimmed || trimmed === PET_AGE_CUSTOM_LABEL) return null;

  const byLabel = PET_AGE_OPTIONS.find((o) => o.label === trimmed);
  if (byLabel) return byLabel.months;

  const text = toEnglishDigits(trimmed);

  // ۱ سال و ۳ ماه / 1 سال 3 ماه
  const yearsAndMonths = text.match(
    /^(\d+(?:[./٫]\d+)?)\s*سال(?:\s*و)?\s*(\d+)\s*ماه/
  );
  if (yearsAndMonths) {
    const y = Number(yearsAndMonths[1]!.replace('٫', '.').replace('/', '.'));
    const m = Number(yearsAndMonths[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
    const total = Math.round(y * 12) + m;
    return total >= 1 && total <= 360 ? total : null;
  }

  // ۱٫۵ ساله / 2 ساله / ۲ سال
  const yearsOnly = text.match(/^(\d+(?:[./٫]\d+)?)\s*سال/);
  if (yearsOnly) {
    const y = Number(yearsOnly[1]!.replace('٫', '.').replace('/', '.'));
    if (!Number.isFinite(y) || y <= 0) return null;
    const total = Math.round(y * 12);
    return total >= 1 && total <= 360 ? total : null;
  }

  // ۸ ماهه / 3 ماه
  const monthsOnly = text.match(/^(\d+)\s*ماه/);
  if (monthsOnly) {
    const m = Number(monthsOnly[1]);
    return Number.isFinite(m) && m >= 1 && m <= 360 ? m : null;
  }

  // عدد خام بعد از «سن دقیق»: ۱–۲۵ → سال، ۲۶–۳۶۰ → ماه
  if (/^\d+$/.test(text)) {
    const n = Number(text);
    if (!Number.isFinite(n) || n < 1) return null;
    if (n <= 25) {
      const total = Math.round(n * 12);
      return total >= 1 && total <= 360 ? total : null;
    }
    return n <= 360 ? n : null;
  }

  return null;
}

function normPlace(value?: string | null): string {
  return (value ?? '')
    .trim()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export interface PlaymateMatchScore {
  pet: PetProfile;
  score: number;
  reasons: string[];
}

/**
 * امتیاز همبازی با اولویت:
 * هم‌کشور (ایران) → هم‌استان → هم‌دسته → هم‌نژاد → سن نزدیک → جنسیت متفاوت
 * فقط هم‌گونه (species) واجد شرایط‌اند.
 */
export function rankPlaymateMatches(
  source: PetProfile,
  candidates: PetProfile[],
  opts?: { max?: number }
): PlaymateMatchScore[] {
  const max = opts?.max ?? 40;
  const sourceId = source.id;
  const sourceOwner = source.ownerId;
  const sourceSpecies = (source.species || '').toLowerCase();

  const scored: PlaymateMatchScore[] = [];

  for (const pet of candidates) {
    if (pet.id === sourceId || pet.ownerId === sourceOwner) continue;
    if (!pet.lookingForPlaymate) continue;
    if ((pet.species || '').toLowerCase() !== sourceSpecies) continue;

    let score = 0;
    const reasons: string[] = [];

    // هم‌کشور — فعلاً همه داخل ایران فرض می‌شوند
    score += 50;
    reasons.push('هم‌کشور');

    const srcProv = normPlace(source.ownerProvince);
    const candProv = normPlace(pet.ownerProvince);
    if (srcProv && candProv && srcProv === candProv) {
      score += 1000;
      reasons.push('هم‌استان');
    }

    const srcCity = normPlace(source.city || source.ownerCity);
    const candCity = normPlace(pet.city || pet.ownerCity);
    if (srcCity && candCity && srcCity === candCity) {
      score += 500;
      reasons.push('هم‌شهر');
    }

    // هم‌دسته (گونه) — شرط ورود؛ امتیاز پایه
    score += 300;
    reasons.push('هم‌دسته');

    const srcBreed = normPlace(source.breed);
    const candBreed = normPlace(pet.breed);
    if (srcBreed && candBreed && srcBreed === candBreed) {
      score += 200;
      reasons.push('هم‌نژاد');
    }

    if (source.ageMonths != null && pet.ageMonths != null) {
      const diff = Math.abs(source.ageMonths - pet.ageMonths);
      const ageScore = Math.max(0, 120 - diff);
      score += ageScore;
      if (diff <= 6) reasons.push('سن نزدیک');
      else if (diff <= 18) reasons.push('سن نسبتاً نزدیک');
    }

    if (source.gender && pet.gender && source.gender !== pet.gender) {
      score += 80;
      reasons.push('جنسیت متفاوت');
    }

    scored.push({ pet, score, reasons });
  }

  scored.sort((a, b) => b.score - a.score || a.pet.name.localeCompare(b.pet.name, 'fa'));

  // One request per owner — otherwise multi-pet owners get N simultaneous
  // requests from the same sender (one per looking-for-playmate pet).
  const seenOwners = new Set<number>();
  const unique: PlaymateMatchScore[] = [];
  for (const match of scored) {
    const ownerId = match.pet.ownerId;
    if (seenOwners.has(ownerId)) continue;
    seenOwners.add(ownerId);
    unique.push(match);
    if (unique.length >= max) break;
  }
  return unique;
}
