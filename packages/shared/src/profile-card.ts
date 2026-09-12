/**
 * کارت پروفایل مشترک بات / وب / PWA — معماری اطلاعات سبک دوردوریا،
 * با فیلدهای دامنهٔ پت‌دیت (همبازی، دامپزشک، کیف پول).
 */
import { FACE_VERIFY_REWARD, PROFILE_REWARD_SECTIONS, type ProfileRewardSection } from './economy';
import { COUNTRY_IRAN } from './locations';
import {
  USER_GENDER_LABELS,
  USER_ROLE_LABELS,
  normalizeRoles,
  primaryRole,
  toPersianDigits,
  userCommandIdOf,
  userPublicIdOf,
  type UserGender,
  type UserRole,
  type VerificationStatus,
} from './petdate';

/** فیلدهای لازم برای «پروفایل کامل» (گیت چت/آنبوردینگ) */
export const PROFILE_REQUIRED_FIELDS = [
  'name',
  'age',
  'gender',
  'location',
] as const satisfies readonly ProfileRewardSection[];

export type ProfileCardUser = {
  id: number;
  publicId?: string | null;
  name?: string | null;
  age?: number | null;
  gender?: UserGender | null;
  country?: string | null;
  province?: string | null;
  city?: string | null;
  bio?: string | null;
  phone?: string | null;
  interests?: string[] | null;
  avatarUrl?: string | null;
  role?: UserRole | null;
  roles?: UserRole[] | null;
  coins?: number | null;
  profileViews?: number | null;
  likesCount?: number | null;
  verificationStatus?: VerificationStatus | null;
  isActive?: boolean | null;
  silentChatRequests?: boolean | null;
  contactsCount?: number | null;
  blockedCount?: number | null;
  locale?: string | null;
};

export type ProfileCompletion = {
  filled: number;
  total: number;
  percent: number;
  missing: ProfileRewardSection[];
};

function hasName(u: ProfileCardUser): boolean {
  return Boolean(u.name && String(u.name).trim().length >= 2);
}

function hasAge(u: ProfileCardUser): boolean {
  return u.age != null && Number(u.age) > 0;
}

function hasGender(u: ProfileCardUser): boolean {
  return Boolean(u.gender);
}

function hasLocation(u: ProfileCardUser): boolean {
  const country = (u.country ?? '').trim();
  const city = (u.city ?? '').trim();
  if (!country || !city) return false;
  if (country === COUNTRY_IRAN && !(u.province ?? '').trim()) return false;
  return true;
}

function hasPhone(u: ProfileCardUser): boolean {
  return Boolean(u.phone && String(u.phone).trim());
}

function hasPhoto(u: ProfileCardUser): boolean {
  return Boolean(u.avatarUrl && String(u.avatarUrl).trim());
}

function hasBio(u: ProfileCardUser): boolean {
  return Boolean(u.bio && String(u.bio).trim());
}

function hasInterests(u: ProfileCardUser): boolean {
  return Boolean(u.interests && u.interests.length > 0);
}

export function isProfileSectionFilled(
  section: ProfileRewardSection,
  user: ProfileCardUser
): boolean {
  switch (section) {
    case 'name':
      return hasName(user);
    case 'age':
      return hasAge(user);
    case 'gender':
      return hasGender(user);
    case 'location':
      return hasLocation(user);
    case 'phone':
      return hasPhone(user);
    case 'photo':
      return hasPhoto(user);
    case 'bio':
      return hasBio(user);
    case 'interests':
      return hasInterests(user);
    default:
      return false;
  }
}

/** درصد تکمیل روی ۸ بخش جایزه‌دار پروفایل */
export function computeProfileCompletion(user: ProfileCardUser): ProfileCompletion {
  const missing: ProfileRewardSection[] = [];
  let filled = 0;
  for (const section of PROFILE_REWARD_SECTIONS) {
    if (isProfileSectionFilled(section, user)) filled += 1;
    else missing.push(section);
  }
  const total = PROFILE_REWARD_SECTIONS.length;
  const percent = Math.round((filled / Math.max(total, 1)) * 100);
  return { filled, total, percent, missing };
}

/** گیت «پروفایل کامل» — نام/سن/جنسیت/موقعیت */
export function isProfileComplete(user: ProfileCardUser): boolean {
  return PROFILE_REQUIRED_FIELDS.every((f) => isProfileSectionFilled(f, user));
}

/**
 * مراحل جداگانهٔ ویزارد بات برای تکمیل پروفایل.
 * موقعیت به کشور / استان / شهر شکسته می‌شود تا فقط زیر‌فیلد خالی پرسیده شود.
 */
export const PROFILE_WIZARD_STEPS = [
  'profile_name',
  'profile_age',
  'profile_gender',
  'profile_country',
  'profile_province',
  'profile_city',
  'profile_phone',
  'profile_photo',
  'profile_bio',
  'profile_interests',
] as const;

export type ProfileWizardStep = (typeof PROFILE_WIZARD_STEPS)[number];

export const PROFILE_WIZARD_STEP_LABELS_FA: Record<ProfileWizardStep, string> = {
  profile_name: 'نام',
  profile_age: 'سن',
  profile_gender: 'جنسیت',
  profile_country: 'کشور',
  profile_province: 'استان',
  profile_city: 'شهر',
  profile_phone: 'موبایل',
  profile_photo: 'عکس',
  profile_bio: 'بیو',
  profile_interests: 'علایق',
};

export const PROFILE_OPTIONAL_WIZARD_STEPS = [
  'profile_phone',
  'profile_photo',
  'profile_bio',
  'profile_interests',
] as const satisfies readonly ProfileWizardStep[];

export function isOptionalProfileWizardStep(step: string): boolean {
  return (PROFILE_OPTIONAL_WIZARD_STEPS as readonly string[]).includes(step);
}

/**
 * فقط مراحل خالی — فیلد پرشده هرگز برنمی‌گردد.
 * برای CTA «تکمیل پروفایل» (نه ثبت‌نام اول).
 */
export function missingProfileWizardSteps(
  user: ProfileCardUser,
  opts?: { skip?: readonly string[] }
): ProfileWizardStep[] {
  const skip = new Set(opts?.skip ?? []);
  const out: ProfileWizardStep[] = [];
  const push = (step: ProfileWizardStep) => {
    if (!skip.has(step)) out.push(step);
  };

  if (!isProfileSectionFilled('name', user)) push('profile_name');
  if (!isProfileSectionFilled('age', user)) push('profile_age');
  if (!isProfileSectionFilled('gender', user)) push('profile_gender');

  if (!isProfileSectionFilled('location', user)) {
    const country = (user.country ?? '').trim();
    const province = (user.province ?? '').trim();
    const city = (user.city ?? '').trim();
    if (!country) push('profile_country');
    else if (country === COUNTRY_IRAN && !province) push('profile_province');
    if (!city) push('profile_city');
  }

  if (!isProfileSectionFilled('phone', user)) push('profile_phone');
  if (!isProfileSectionFilled('photo', user)) push('profile_photo');
  if (!isProfileSectionFilled('bio', user)) push('profile_bio');
  if (!isProfileSectionFilled('interests', user)) push('profile_interests');

  return out;
}

export function nextMissingProfileWizardStep(
  user: ProfileCardUser,
  opts?: { skip?: readonly string[] }
): ProfileWizardStep | null {
  return missingProfileWizardSteps(user, opts)[0] ?? null;
}

/** شناسهٔ دستور تلگرام (قابل‌ضربه): /u00014 — فقط deep-link بات، نه نمایش «آیدی» */
export function userCommandId(user: ProfileCardUser): string {
  return userCommandIdOf({ id: user.id, publicId: user.publicId });
}

/** آیدی نمایشی canonical کاربر: PD-U##### */
export function userDisplayPublicId(user: ProfileCardUser): string {
  return userPublicIdOf({ id: user.id, publicId: user.publicId });
}

export function profileLanguageCode(user: ProfileCardUser): string {
  const loc = String(user.locale ?? 'fa').toLowerCase();
  if (loc.startsWith('en')) return 'En';
  return 'Fa';
}

export function profileGenderEmoji(gender?: UserGender | null): string {
  if (gender === 'male') return '👨';
  if (gender === 'female') return '👩';
  return '👤';
}

export function profileCountryFlag(country?: string | null): string {
  const c = (country ?? '').trim();
  if (c === 'ایران' || c === 'Iran' || c === 'IR') return '🇮🇷';
  return '🌍';
}

/** هدف/نقش به‌جای «دوست‌یابی» دوردوریا */
export function profilePurposeLabel(user: ProfileCardUser): string {
  const roles = normalizeRoles(user.roles, user.role);
  if (!roles.length) return '—';
  const primary = primaryRole(roles, user.role);
  const ordered = primary ? [primary, ...roles.filter((r) => r !== primary)] : roles;
  return ordered.map((r) => USER_ROLE_LABELS[r]).join(' · ');
}

export function profileLocationLine(user: ProfileCardUser): string {
  const parts = [user.city, user.province, user.country].filter(
    (p): p is string => Boolean(p && String(p).trim())
  );
  return parts.length ? parts.map((p) => String(p).trim()).join(' - ') : '—';
}

export function profilePhotoStatusLabel(user: ProfileCardUser): string {
  return hasPhoto(user) ? 'دارد' : 'عکس پیش‌فرض';
}

export function profileLocationStatusLabel(user: ProfileCardUser): string {
  return hasLocation(user) ? 'ثبت‌شده (قابل ویرایش)' : 'ثبت نشده';
}

export function profileVerifyStatusLabel(status?: VerificationStatus | null): string {
  const s = status ?? 'none';
  if (s === 'verified') return 'احراز هویت شده';
  if (s === 'pending') return 'در انتظار احراز';
  if (s === 'rejected') return 'احراز رد شده';
  return 'احراز هویت نشده';
}

export function formatFaInt(n: number | null | undefined): string {
  return new Intl.NumberFormat('fa-IR').format(n ?? 0);
}

export type ProfileCardLines = {
  likes: string;
  completion: string;
  userId: string;
  identity: string;
  location: string;
  purpose: string;
  interests: string;
  walletViews: string;
  contacts: string;
  photo: string;
  verification: string;
  locationStatus: string;
};

/** خطوط متنی کارت (بدون HTML) — مشترک بات و وب */
export function buildProfileCardLines(
  user: ProfileCardUser,
  extras?: { contactsCount?: number }
): ProfileCardLines {
  const completion = computeProfileCompletion(user);
  const likes = user.likesCount ?? 0;
  const contacts = extras?.contactsCount ?? user.contactsCount ?? 0;
  const interests =
    user.interests && user.interests.length > 0
      ? user.interests.join(' · ')
      : 'هنوز انتخاب نشده';
  const agePart =
    user.age != null && Number(user.age) > 0 ? ` (${toPersianDigits(user.age)})` : '';
  const name = (user.name && String(user.name).trim()) || 'بدون نام';
  const verify = user.verificationStatus ?? 'none';

  return {
    likes: `❤️ ${formatFaInt(likes)} لایک`,
    completion: `📊 تکمیل پروفایل: ${toPersianDigits(completion.percent)}٪`,
    userId: `شناسه کاربر/صاحب پت: ${userDisplayPublicId(user)}`,
    identity: `${profileGenderEmoji(user.gender)} ${name}${agePart} | ${profileLanguageCode(user)}`,
    location: `${profileCountryFlag(user.country)} ${profileLocationLine(user)}`,
    purpose: profilePurposeLabel(user),
    interests: `✨ علاقه‌مندی‌ها: ${interests}`,
    walletViews: `💰 ${formatFaInt(user.coins ?? 0)} | 👁️ ${formatFaInt(user.profileViews ?? 0)}`,
    contacts: `👥 مخاطبین: ${formatFaInt(contacts)}`,
    photo: `عکس: 🖼️ ${profilePhotoStatusLabel(user)}`,
    verification: `🛡️ ${profileVerifyStatusLabel(verify)}`,
    locationStatus: `📍 موقعیت: ${profileLocationStatusLabel(user)}`,
  };
}

/** متن کارت برای تلگرام (HTML) */
export function formatProfileCardHtml(
  user: ProfileCardUser,
  extras?: { contactsCount?: number; petCount?: number; petNames?: string[] }
): string {
  const lines = buildProfileCardLines(user, extras);
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const body = [
    escape(lines.likes),
    escape(lines.completion),
    escape(lines.userId),
    escape(lines.identity),
    escape(lines.location),
    escape(lines.purpose),
    escape(lines.interests),
    escape(lines.walletViews),
    escape(lines.contacts),
    escape(lines.photo),
    escape(lines.verification),
    escape(lines.locationStatus),
  ];

  if (extras?.petCount != null) {
    const pets =
      extras.petNames && extras.petNames.length
        ? extras.petNames.map((n) => `• ${escape(n)}`).join('\n')
        : 'هنوز پتی ثبت نشده';
    body.push('', `🐾 پت‌ها (${formatFaInt(extras.petCount)})`, pets);
  }

  if (user.isActive === false) {
    body.push('', '⏸ حساب فعلاً غیرفعال است');
  }

  return body.join('\n');
}

export const PROFILE_FACE_VERIFY_REWARD = FACE_VERIFY_REWARD;

export function faceVerifyButtonLabel(status?: VerificationStatus | null): string {
  const s = status ?? 'none';
  const reward = formatFaInt(FACE_VERIFY_REWARD);
  if (s === 'verified') return '✅ احراز چهره شده';
  if (s === 'pending') return '⏳ در انتظار احراز';
  return `💰 احراز چهره (+${reward})`;
}

export function genderLabelFa(gender?: UserGender | null): string {
  return gender ? USER_GENDER_LABELS[gender] : '—';
}
