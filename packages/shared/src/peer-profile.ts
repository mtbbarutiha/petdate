/**
 * Peer-facing owner/user profile — safe fields only.
 * Never expose Telegram numeric id, @username, or phone to other users.
 */
import {
  USER_GENDER_LABELS,
  USER_ROLE_LABELS,
  VERIFIED_BADGE,
  normalizeRoles,
  userCommandIdOf,
  userPublicIdOf,
  type UserGender,
  type UserRole,
  type VerificationStatus,
} from './petdate';
import { profileGenderEmoji, profileVerifyStatusLabel } from './profile-card';

/** Minimal shape accepted from API User / mapUser rows */
export type PeerProfileSource = {
  id: number;
  publicId?: string | null;
  name?: string | null;
  age?: number | null;
  gender?: UserGender | null;
  country?: string | null;
  province?: string | null;
  city?: string | null;
  bio?: string | null;
  interests?: string[] | null;
  avatarUrl?: string | null;
  role?: UserRole | null;
  roles?: UserRole[] | null;
  verificationStatus?: VerificationStatus | null;
  isActive?: boolean | null;
  likesCount?: number | null;
  profileViews?: number | null;
  /** Optional last activity (ISO) when available on peer DTO */
  lastSeenAt?: string | null;
  // Sensitive — accepted only so we can strip them:
  telegramId?: string | null;
  username?: string | null;
  phone?: string | null;
  phoneVerified?: boolean | null;
  phoneVerifiedAt?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
  lat?: number | null;
  lng?: number | null;
  locationUpdatedAt?: string | null;
  coins?: number | null;
  walletTon?: number | null;
  walletStars?: number | null;
  walletToman?: number | null;
  wallet?: unknown;
  verificationPhotoFileId?: string | null;
  vetCredentialFileId?: string | null;
  verificationNote?: string | null;
};

/** Public peer DTO — no Telegram id / @username / phone / email / geo / wallet */
export type PeerPublicUser = {
  id: number;
  publicId: string;
  name: string;
  age?: number;
  gender?: UserGender;
  country?: string;
  province?: string;
  city?: string;
  bio?: string;
  interests?: string[];
  avatarUrl?: string;
  role?: UserRole;
  roles?: UserRole[];
  verificationStatus?: VerificationStatus;
  isActive?: boolean;
  likesCount?: number;
  profileViews?: number;
  lastSeenAt?: string;
  createdAt?: string;
};

const SENSITIVE_KEYS = [
  'telegramId',
  'username',
  'phone',
  'phoneVerified',
  'phoneVerifiedAt',
  'email',
  'emailVerified',
  'lat',
  'lng',
  'locationUpdatedAt',
  'coins',
  'walletTon',
  'walletStars',
  'walletToman',
  'wallet',
  'verificationPhotoFileId',
  'vetCredentialFileId',
  'verificationNote',
  'lastDailyCoinAt',
  'signupBonusClaimed',
  'profileRewards',
  'awardedRewards',
  'silentChatRequests',
  'contactsCount',
  'blockedCount',
  'vetCredentialStatus',
  'visitFeeCoins',
] as const;

/**
 * Strip contact / Telegram / wallet fields for peer-facing API responses.
 * Keeps display name, location, gender, interests, public id, verification badge.
 */
export function toPeerPublicUser(user: PeerProfileSource): PeerPublicUser {
  const name = (user.name && String(user.name).trim()) || 'بدون نام';
  const out: PeerPublicUser = {
    id: user.id,
    publicId: userPublicIdOf({ id: user.id, publicId: user.publicId }),
    name,
  };
  if (user.age != null && Number(user.age) > 0) out.age = Number(user.age);
  if (user.gender) out.gender = user.gender;
  if (user.country?.trim()) out.country = String(user.country).trim();
  if (user.province?.trim()) out.province = String(user.province).trim();
  if (user.city?.trim()) out.city = String(user.city).trim();
  if (user.bio?.trim()) out.bio = String(user.bio).trim();
  if (user.interests && user.interests.length > 0) {
    out.interests = user.interests.map(String).filter((s) => s.trim());
  }
  if (user.avatarUrl?.trim()) out.avatarUrl = String(user.avatarUrl).trim();
  if (user.role) out.role = user.role;
  const roles = normalizeRoles(user.roles, user.role);
  if (roles.length) out.roles = roles;
  if (user.verificationStatus) out.verificationStatus = user.verificationStatus;
  if (user.isActive != null) out.isActive = Boolean(user.isActive);
  if (user.likesCount != null) out.likesCount = Number(user.likesCount);
  if (user.profileViews != null) out.profileViews = Number(user.profileViews);
  if (user.lastSeenAt?.trim()) out.lastSeenAt = String(user.lastSeenAt).trim();
  return out;
}

/** True if a plain object still carries peer-sensitive contact fields */
export function peerDtoHasSensitiveLeak(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  for (const key of SENSITIVE_KEYS) {
    const v = o[key];
    if (v == null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (typeof v === 'boolean' && v === false) continue;
    if (typeof v === 'number' && !Number.isFinite(v)) continue;
    return true;
  }
  return false;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Eastern-style last-seen line (shared with nearby cards tone) */
export function formatPeerLastSeenFa(iso?: string | null): string | null {
  if (!iso) return null;
  const raw = String(iso).trim();
  const ms =
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)
      ? Date.parse(raw.replace(' ', 'T') + 'Z')
      : Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  const hours = (Date.now() - ms) / 3_600_000;
  if (hours < 1) return 'لحظاتی پیش آنلاین بوده';
  if (hours < 12) return 'امروز آنلاین بوده';
  if (hours < 48) return 'آخرین بازدید چند روز پیش';
  if (hours < 24 * 7) return 'این هفته آنلاین بوده';
  return 'آخرین بازدید مدتی پیش';
}

/**
 * HTML caption for peer owner profile (bot nearby / playdate / owner-chat / /u#####).
 * Shows display name + safe fields; never phone / Telegram id / @username.
 */
export function formatPeerOwnerProfileHtml(
  user: PeerProfileSource,
  opts?: { heading?: string; includePets?: string[] }
): string {
  const peer = toPeerPublicUser(user);
  const heading = opts?.heading ?? '👤 <b>پروفایل طرف مقابل</b>';
  const verified = (peer.verificationStatus ?? 'none') === 'verified';
  const gender = peer.gender ? USER_GENDER_LABELS[peer.gender] : '—';
  const roles = peer.roles?.length
    ? peer.roles.map((r) => USER_ROLE_LABELS[r]).join(' · ')
    : peer.role
      ? USER_ROLE_LABELS[peer.role]
      : '—';
  const location =
    [peer.province, peer.city].filter(Boolean).join('، ') ||
    peer.country ||
    '—';
  const publicId = peer.publicId;
  const interests =
    peer.interests && peer.interests.length
      ? peer.interests.join(' · ')
      : null;
  const lastSeen = formatPeerLastSeenFa(peer.lastSeenAt);

  const lines: Array<string | null> = [
    heading,
    verified ? VERIFIED_BADGE : null,
    '',
    `<b>نام:</b> ${escapeHtml(peer.name)}${verified ? ' ✅' : ''}`,
    `<b>آیدی:</b> <code>${escapeHtml(publicId)}</code>`,
    peer.age != null ? `<b>سن:</b> ${peer.age}` : null,
    `<b>جنسیت:</b> ${profileGenderEmoji(peer.gender)} ${gender}`,
    `<b>نقش:</b> ${escapeHtml(roles)}`,
    `<b>موقعیت:</b> ${escapeHtml(location)}`,
    interests ? `<b>علاقه‌مندی‌ها:</b> ${escapeHtml(interests)}` : null,
    lastSeen ? `<b>آخرین بازدید:</b> ${escapeHtml(lastSeen)}` : null,
    peer.bio ? `\n💬 ${escapeHtml(peer.bio)}` : null,
  ];

  if (opts?.includePets) {
    const pets =
      opts.includePets.length > 0
        ? opts.includePets.map((n) => `• ${escapeHtml(n)}`).join('\n')
        : 'هنوز پتی ثبت نشده';
    lines.push('', `🐾 پت‌ها (${opts.includePets.length})`, pets);
  }

  if (peer.isActive === false) {
    lines.push('', '⏸ حساب فعلاً غیرفعال است');
  }

  return lines.filter((x) => x != null && x !== '').join('\n');
}

/** Plain-text / web-friendly peer summary lines */
export function buildPeerOwnerSummaryLines(user: PeerProfileSource): {
  name: string;
  commandId: string;
  publicId: string;
  gender?: string;
  age?: number;
  location: string;
  interests?: string;
  verification: string;
  lastSeen?: string;
  bio?: string;
} {
  const peer = toPeerPublicUser(user);
  const location =
    [peer.city, peer.province, peer.country].filter(Boolean).join(' - ') || '—';
  return {
    name: peer.name,
    commandId: userCommandIdOf({ id: peer.id, publicId: peer.publicId }),
    publicId: peer.publicId,
    gender: peer.gender ? USER_GENDER_LABELS[peer.gender] : undefined,
    age: peer.age,
    location,
    interests:
      peer.interests && peer.interests.length ? peer.interests.join(' · ') : undefined,
    verification: profileVerifyStatusLabel(peer.verificationStatus),
    lastSeen: formatPeerLastSeenFa(peer.lastSeenAt) ?? undefined,
    bio: peer.bio,
  };
}
