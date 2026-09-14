import { dbService, type UserProfilePatch } from '../db';
import { isPlaceholderUserName } from './telegram-profile-sync';
import { MAX_USER_AVATAR_BYTES, saveUserAvatar } from './user-avatar-store';
import { nameFromEmailLocalPart, pickIranPhoneFromProvider } from './provider-profile-hints';

export { nameFromEmailLocalPart, pickIranPhoneFromProvider } from './provider-profile-hints';

/**
 * Fill empty profile fields from a login provider (email OTP / Google).
 * Never overwrites a real name, custom avatar, or a different verified phone.
 */
export function applyLoginProfileHints(opts: {
  userId: number;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  phoneVerified?: boolean;
}): NonNullable<ReturnType<typeof dbService.getUserById>> | null {
  let user = dbService.getUserById(opts.userId);
  if (!user) return null;

  const email = String(opts.email ?? '').trim().toLowerCase();
  if (email && user.email !== email) {
    user = dbService.linkEmailIdentity(user.id, email) ?? user;
  }

  const phone = opts.phone ? pickIranPhoneFromProvider(opts.phone) : null;
  if (phone && user.phone !== phone) {
    if (!user.phone || opts.phoneVerified) {
      user = dbService.linkPhoneIdentity(user.id, phone) ?? user;
    }
  }

  user = dbService.getUserById(user.id) ?? user;
  const patch: UserProfilePatch = {};
  const providerName = String(opts.name ?? '').trim();
  const emailName = nameFromEmailLocalPart(email || user.email);
  if (isPlaceholderUserName(user.name)) {
    if (providerName && !isPlaceholderUserName(providerName)) patch.name = providerName;
    else if (emailName) patch.name = emailName;
  }

  if (Object.keys(patch).length) {
    user = dbService.updateUserProfile(user.id, patch) ?? user;
  }
  return dbService.getUserById(user.id) ?? user;
}

export async function importRemoteAvatarIfEmpty(opts: {
  userId: number;
  pictureUrl?: string | null;
}): Promise<NonNullable<ReturnType<typeof dbService.getUserById>> | null> {
  let user = dbService.getUserById(opts.userId);
  if (!user) return null;
  const url = String(opts.pictureUrl ?? '').trim();
  if (!url || !/^https?:\/\//i.test(url)) return user;
  if (user.avatarCustom) return user;
  const existing = String(user.avatarUrl ?? '').trim();
  if (existing.startsWith('/api/auth/avatar') || existing.startsWith('/api/')) return user;

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    const res = await fetch(url, { signal: ac.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (!res.ok) return user;
    const mime = String(res.headers.get('content-type') || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_USER_AVATAR_BYTES) return user;
    const saved = await saveUserAvatar({
      userId: user.id,
      originalName: 'google-avatar.jpg',
      mimeType: mime || 'image/jpeg',
      buffer: buf,
    });
    user =
      dbService.updateUserProfile(user.id, {
        avatarUrl: saved.urlPath,
        avatarCustom: false,
      }) ?? user;
  } catch (err) {
    console.warn('google avatar import failed:', (err as Error).message);
  }
  return dbService.getUserById(user.id) ?? user;
}
