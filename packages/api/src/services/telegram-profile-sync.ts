import dns from 'dns';
import path from 'path';
import type { User } from '@petdate/shared';

// Prefer IPv4 — some VPS hosts time out on Telegram's IPv6 routes.
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  /* ignore on older Node */
}
import { infra } from '../config/infra';
import { dbService } from '../db';
import { MAX_USER_AVATAR_BYTES, saveUserAvatar } from './user-avatar-store';
import { telegramFetch, telegramBotApiUrl, telegramFileApiUrl } from './telegram-http';

const PLACEHOLDER_NAMES = new Set([
  'کاربر تلگرام',
  'کاربر petdate',
  'کاربر Pet Date',
  'کاربر PetDate',
]);

type TgApiResult<T> = { ok?: boolean; result?: T; description?: string };

function botToken(): string | null {
  const token = infra.telegram.botToken?.trim();
  return token || null;
}

async function tgApi<T>(method: string, body?: Record<string, unknown>): Promise<T | null> {
  const token = botToken();
  if (!token) return null;
  try {
    const res = await telegramFetch(telegramBotApiUrl(token, method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const data = (await res.json()) as TgApiResult<T>;
    if (!data.ok || data.result == null) {
      console.warn(`telegram ${method} failed:`, data.description ?? res.status);
      return null;
    }
    return data.result;
  } catch (err) {
    console.warn(`telegram ${method} error:`, (err as Error).message);
    return null;
  }
}

export function isPlaceholderUserName(name: string | undefined | null): boolean {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return true;
  if (PLACEHOLDER_NAMES.has(trimmed)) return true;
  // Generic "کاربر …" placeholders used by bot/web OTP
  if (/^کاربر\s+/u.test(trimmed) && trimmed.length <= 40) return true;
  return false;
}

export function combineTelegramNames(first?: string | null, last?: string | null): string {
  return [first, last]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

type TgChat = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  type?: string;
  photo?: { small_file_id?: string; big_file_id?: string };
};

type TgPhotos = {
  total_count: number;
  photos: Array<Array<{ file_id: string; file_unique_id: string; width: number; height: number }>>;
};

type TgFile = { file_id: string; file_path?: string; file_size?: number };

/** Pick the largest size from the newest profile photo set. */
export function pickLargestProfilePhotoFileId(photos: TgPhotos | null | undefined): string | null {
  const sets = photos?.photos;
  if (!sets?.length) return null;
  const newest = sets[0];
  if (!newest?.length) return null;
  const best = newest.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
  return best.file_id || null;
}

function mimeFromTelegramPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

async function downloadTelegramFile(fileId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
  originalName: string;
} | null> {
  const token = botToken();
  if (!token || !fileId) return null;

  const file = await tgApi<TgFile>('getFile', { file_id: fileId });
  if (!file?.file_path) return null;
  if (file.file_size != null && file.file_size > MAX_USER_AVATAR_BYTES) {
    console.warn('telegram profile photo too large:', file.file_size);
    return null;
  }

  try {
    const url = telegramFileApiUrl(token, file.file_path);
    const res = await telegramFetch(url);
    if (!res.ok) {
      console.warn('telegram file download failed:', res.status);
      return null;
    }
    const ab = await res.arrayBuffer();
    const buffer = Buffer.from(ab);
    if (!buffer.length || buffer.length > MAX_USER_AVATAR_BYTES) return null;
    const mimeType = mimeFromTelegramPath(file.file_path);
    const base = path.basename(file.file_path) || 'telegram-avatar.jpg';
    return { buffer, mimeType, originalName: base };
  } catch (err) {
    console.warn('telegram file download error:', (err as Error).message);
    return null;
  }
}

export async function fetchTelegramPublicProfile(telegramId: string): Promise<{
  firstName?: string;
  lastName?: string;
  username?: string;
  photoFileId?: string;
} | null> {
  const tg = String(telegramId ?? '').trim();
  if (!/^\d{3,20}$/.test(tg)) return null;
  if (!botToken()) return null;

  const chat = await tgApi<TgChat>('getChat', { chat_id: Number(tg) });
  const photos = await tgApi<TgPhotos>('getUserProfilePhotos', {
    user_id: Number(tg),
    limit: 1,
  });
  // Prefer getUserProfilePhotos; fall back to getChat.photo (works when profile
  // albums are empty/hidden but the chat avatar is still visible to the bot).
  const photoFileId =
    pickLargestProfilePhotoFileId(photos ?? undefined) ??
    chat?.photo?.big_file_id ??
    chat?.photo?.small_file_id ??
    undefined;

  return {
    firstName: chat?.first_name,
    lastName: chat?.last_name,
    username: chat?.username,
    photoFileId,
  };
}

/** True when value is a site/HTTP URL path Telegram or the web can fetch by URL. */
export function isWebAvatarUrl(value: string | null | undefined): boolean {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  return raw.startsWith('/') || /^https?:\/\//i.test(raw);
}

/**
 * Bot wizard historically stored Telegram file_id in users.avatar_url.
 * Those work with sendPhoto but not as <img src> on the website.
 */
export function looksLikeTelegramFileId(value: string | null | undefined): boolean {
  const raw = String(value ?? '').trim();
  if (!raw || isWebAvatarUrl(raw)) return false;
  // Telegram file_ids are opaque tokens (often AgAC… / BAAC…); never paths.
  return raw.length >= 16 && !/\s/.test(raw);
}

/** Download a Telegram file_id and persist under /api/auth/avatar/... */
export async function materializeTelegramFileIdAsAvatar(
  userId: number,
  fileId: string
): Promise<string | null> {
  const id = String(fileId ?? '').trim();
  if (!id || !Number.isFinite(userId) || userId <= 0) return null;
  const downloaded = await downloadTelegramFile(id);
  if (!downloaded) return null;
  try {
    const saved = await saveUserAvatar({
      userId,
      originalName: downloaded.originalName,
      mimeType: downloaded.mimeType,
      buffer: downloaded.buffer,
    });
    return saved.urlPath;
  } catch (err) {
    console.warn('materialize telegram avatar failed:', (err as Error).message);
    return null;
  }
}

/**
 * Ensure avatarUrl is a web-fetchable path when possible:
 * - file_id → download + /api/auth/avatar/...
 * - empty → sync Telegram profile photo (unless avatarCustom)
 */
/** Skip repeated Bot API profile pulls when Telegram has no photo / is unreachable. */
const PROFILE_SYNC_COOLDOWN_MS = Math.max(
  60_000,
  Number(process.env.TELEGRAM_PROFILE_SYNC_COOLDOWN_MS ?? 30 * 60_1000)
);
const profileSyncCooldownUntil = new Map<number, number>();

/** Test helper — clears in-memory sync cooldowns. */
export function clearTelegramProfileSyncCooldowns(): void {
  profileSyncCooldownUntil.clear();
}

function isProfileSyncCoolingDown(userId: number): boolean {
  const until = profileSyncCooldownUntil.get(userId);
  if (until == null) return false;
  if (Date.now() >= until) {
    profileSyncCooldownUntil.delete(userId);
    return false;
  }
  return true;
}

function markProfileSyncCooldown(userId: number): void {
  profileSyncCooldownUntil.set(userId, Date.now() + PROFILE_SYNC_COOLDOWN_MS);
  // Bound map size for long-lived API processes
  if (profileSyncCooldownUntil.size > 5000) {
    const now = Date.now();
    for (const [id, exp] of profileSyncCooldownUntil) {
      if (exp <= now) profileSyncCooldownUntil.delete(id);
    }
  }
}

export async function ensureWebAccessibleAvatar(userId: number): Promise<User | null> {
  let user = dbService.getUserById(userId);
  if (!user) return null;

  const raw = String(user.avatarUrl ?? '').trim();
  if (isWebAvatarUrl(raw)) return user;

  if (looksLikeTelegramFileId(raw)) {
    const urlPath = await materializeTelegramFileIdAsAvatar(userId, raw);
    if (urlPath) {
      const updated = dbService.updateUserProfile(userId, {
        avatarUrl: urlPath,
        // Preserve custom flag if user uploaded via bot wizard
        avatarCustom: user.avatarCustom ?? true,
        // Rematerialize only — do not re-queue moderation
        avatarModerationStatus: user.avatarModerationStatus ?? 'approved',
      });
      if (updated) return updated;
    }
  }

  const tg = String(user.telegramId ?? '').trim();
  if (tg && !user.avatarCustom) {
    if (isProfileSyncCoolingDown(userId)) {
      return user;
    }
    const synced = await syncUserProfileFromTelegram(userId, tg);
    if (synced) return synced;
  }
  return dbService.getUserById(userId);
}

/**
 * After Telegram web login / attach: fill empty name + username from Bot API,
 * and refresh avatar from Telegram unless the user uploaded a custom one.
 * Failures never block auth — returns the latest user row either way.
 */
export async function syncUserProfileFromTelegram(
  userId: number,
  telegramId: string
): Promise<User | null> {
  let user = dbService.getUserById(userId);
  if (!user) return null;

  if (isProfileSyncCoolingDown(userId)) {
    return user;
  }

  const profile = await fetchTelegramPublicProfile(telegramId);
  if (!profile) {
    // Bot API unreachable / failed — back off so hot paths (profile-card) cannot
    // pile up 12s×N Telegram connect timeouts and trip WCDN/nginx 504s.
    markProfileSyncCooldown(userId);
    return user;
  }

  const patch: Parameters<typeof dbService.updateUserProfile>[1] = {};
  const tgName = combineTelegramNames(profile.firstName, profile.lastName);

  if (tgName && isPlaceholderUserName(user.name)) {
    patch.name = tgName;
  }
  if (profile.username && !String(user.username ?? '').trim()) {
    patch.username = profile.username;
  }

  // If avatar is still a raw Telegram file_id, materialize it first (web needs a URL).
  if (looksLikeTelegramFileId(user.avatarUrl)) {
    const urlPath = await materializeTelegramFileIdAsAvatar(userId, String(user.avatarUrl));
    if (urlPath) {
      patch.avatarUrl = urlPath;
      if (user.avatarCustom == null) patch.avatarCustom = true;
      // Keep existing moderation when only converting storage format
      patch.avatarModerationStatus = user.avatarModerationStatus ?? 'approved';
    }
  }

  const shouldRefreshAvatar =
    !user.avatarCustom && !isWebAvatarUrl(patch.avatarUrl ?? user.avatarUrl);
  if (!shouldRefreshAvatar) {
    if (user.avatarCustom) {
      console.info(`telegram profile sync: skip avatar user=${userId} (avatarCustom)`);
    }
  } else if (!profile.photoFileId) {
    console.warn(`telegram profile sync: no photo for tg=${telegramId} user=${userId}`);
    markProfileSyncCooldown(userId);
  } else {
    const urlPath = await materializeTelegramFileIdAsAvatar(userId, profile.photoFileId);
    if (!urlPath) {
      console.warn(`telegram profile sync: download failed tg=${telegramId} user=${userId}`);
      markProfileSyncCooldown(userId);
    } else {
      patch.avatarUrl = urlPath;
      patch.avatarCustom = false;
      // Fresh Telegram profile photo → wait for admin approval before public display
      delete patch.avatarModerationStatus;
      console.info(`telegram profile sync: avatar saved user=${userId} path=${urlPath}`);
      profileSyncCooldownUntil.delete(userId);
    }
  }

  if (Object.keys(patch).length) {
    const updated = dbService.updateUserProfile(userId, patch);
    if (updated) user = updated;
  }
  return user;
}
