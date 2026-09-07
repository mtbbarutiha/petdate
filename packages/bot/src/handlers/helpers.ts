import type { Context } from 'grammy';
import type { User } from '@petdate/shared';
import { BRAND } from '@petdate/shared';
import { getUserByTelegramId } from '../api-client';
import { mainMenuKeyboard } from '../keyboards';

export function displayName(from: {
  first_name: string;
  last_name?: string;
  username?: string;
}): string {
  const full = [from.first_name, from.last_name].filter(Boolean).join(' ');
  return full || from.username || `کاربر ${BRAND.name}`;
}

export async function getCtxUser(ctx: Context): Promise<User | null> {
  if (!ctx.from) return null;
  return getUserByTelegramId(String(ctx.from.id));
}

/** منوی اصلی با ردیف دسترسی (نقش‌ها / پنل ادمین) بر اساس دسترسی کاربر */
export function menuKeyboardFor(
  ctx: Context,
  user?: (Pick<User, 'role' | 'roles'> & { vetOnline?: boolean; readyToAdopt?: boolean }) | null
) {
  return mainMenuKeyboard(user?.role, user?.roles, ctx.from?.id, {
    vetOnline: user?.vetOnline,
    readyToAdopt: user?.readyToAdopt,
  });
}
