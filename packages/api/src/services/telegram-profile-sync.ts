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
import { looksLikeTelegramFileId } from './telegram-media';

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
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
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
    const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const res = await fetch(url);
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

/** Extract a Telegram file_id from raw DB value or mapped /api/media/telegram/... URL. */
export function extractTelegramFileIdFromAvatar(
  value: string | undefined | null
): string | null {
  const v = String(value ?? '').trim();
  if (!v) return null;
  if (looksLikeTelegramFileId(v)) return v;
  const m = v.match(/^\/api\/media\/telegram\/(.+)$/i);
  if (m?.[1]) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return null;
}

function avatarNeedsMaterialize(avatarUrl: string | undefined | null): boolean {
  const v = String(avatarUrl ?? '').trim();
  if (!v) return true;
  if (v.startsWith('/api/auth/avatar/')) return false;
  if (looksLikeTelegramFileId(v)) return true;
  if (v.includes('/api/media/telegram/')) return true;
  return false;
}

/**
 * After Telegram web login / attach: fill empty name + username from Bot API,
 * and refresh avatar from Telegram unless the user uploaded a custom one.
 * Also materializes bot-stored file_id avatars to /api/auth/avatar/... for web <img>.
 * Failures never block auth — returns the latest user row either way.
 */
export async function syncUserProfileFromTelegram(
  userId: number,
  telegramId: string
): Promise<User | null> {
  let user = dbService.getUserById(userId);
  if (!user) return null;

  const profile = await fetchTelegramPublicProfile(telegramId);
  const patch: Parameters<typeof dbService.updateUserProfile>[1] = {};

  if (profile) {
    const tgName = combineTelegramNames(profile.firstName, profile.lastName);
    if (tgName && isPlaceholderUserName(user.name)) {
      patch.name = tgName;
    }
    if (profile.username && !String(user.username ?? '').trim()) {
      patch.username = profile.username;
    }
  }

  const shouldRefreshAvatar = !user.avatarCustom;
  if (!shouldRefreshAvatar) {
    console.info(`telegram profile sync: skip avatar user=${userId} (avatarCustom)`);
  } else if (avatarNeedsMaterialize(user.avatarUrl)) {
    const fileId =
      profile?.photoFileId ||
      extractTelegramFileIdFromAvatar(user.avatarUrl) ||
      null;
    if (!fileId) {
      console.warn(`telegram profile sync: no photo for tg=${telegramId} user=${userId}`);
    } else {
      const downloaded = await downloadTelegramFile(fileId);
      if (!downloaded) {
        console.warn(`telegram profile sync: download failed tg=${telegramId} user=${userId}`);
      } else {
        try {
          const saved = saveUserAvatar({
            userId,
            originalName: downloaded.originalName,
            mimeType: downloaded.mimeType,
            buffer: downloaded.buffer,
          });
          patch.avatarUrl = saved.urlPath;
          patch.avatarCustom = false;
          console.info(`telegram profile sync: avatar saved user=${userId} path=${saved.urlPath}`);
        } catch (err) {
          console.warn('save telegram avatar failed:', (err as Error).message);
        }
      }
    }
  }

  if (Object.keys(patch).length) {
    const updated = dbService.updateUserProfile(userId, patch);
    if (updated) user = updated;
  }
  return user;
}
