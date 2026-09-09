import type { LucideIcon } from 'lucide-react';
import {
  LogIn,
  MessagesSquare,
  HeartHandshake,
  PawPrint,
  ShoppingBag,
  Stethoscope,
  GraduationCap,
  Home,
  UserRound,
  Wallet,
} from 'lucide-react';
import type { User, UserRole } from '@petdate/shared';
import { primaryRole } from '@petdate/shared';

export type SiteNavItem = {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Send guests through login when true */
  gate?: boolean;
  match?: (pathname: string) => boolean;
};

const SHOP: SiteNavItem = {
  key: 'shop',
  label: 'شاپ',
  to: '/shop',
  icon: ShoppingBag,
  match: (p) => p === '/shop' || (p.startsWith('/shop/') && p !== '/shop/cart'),
};

const SHOP_AUTH: SiteNavItem = {
  ...SHOP,
  match: (p) => p === '/shop' || p.startsWith('/shop/'),
};

/** Owner/guest playmate hub — lives in /chats (find + inbox), not a separate page. */
const PLAYMATE_CHATS: SiteNavItem = {
  key: 'playmate',
  label: 'هم بازی',
  to: '/chats',
  icon: HeartHandshake,
  match: (p) => p === '/chats' || p.startsWith('/chats/') || p.startsWith('/vet-chats'),
};

const MY_PETS: SiteNavItem = {
  key: 'my_pets',
  label: 'پت‌های من',
  to: '/my-pets',
  icon: PawPrint,
  match: (p) =>
    p === '/my-pets' ||
    p.startsWith('/my-pets/') ||
    p === '/add-pet' ||
    (p.startsWith('/pets/') && p.endsWith('/edit')),
};

const CHATS: SiteNavItem = {
  key: 'chats',
  label: 'گفتگو',
  to: '/chats',
  icon: MessagesSquare,
  match: (p) => p === '/chats' || p.startsWith('/chats/') || p.startsWith('/vet-chats'),
};

const WALLET: SiteNavItem = {
  key: 'wallet',
  label: 'کیف پول',
  to: '/wallet',
  icon: Wallet,
  match: (p) => p === '/wallet' || p.startsWith('/wallet/'),
};

const PROFILE: SiteNavItem = {
  key: 'profile',
  label: 'پروفایل',
  to: '/profile',
  icon: UserRound,
  match: (p) => p === '/profile' || p.startsWith('/profile'),
};

const VET_PANEL: SiteNavItem = {
  key: 'vet_panel',
  label: 'پنل پزشک',
  to: '/vet-consult',
  icon: Stethoscope,
  match: (p) => p === '/vet-consult' || p.startsWith('/vet-consult'),
};

const TRAINER_PANEL: SiteNavItem = {
  key: 'trainer_panel',
  label: 'پنل مربی',
  to: '/trainer-consult',
  icon: GraduationCap,
  match: (p) => p === '/trainer-consult' || p.startsWith('/trainer-consult'),
};

const SITTER_PANEL: SiteNavItem = {
  key: 'sitter_panel',
  label: 'پنل پرستار',
  to: '/sitter-consult',
  icon: Home,
  match: (p) => p === '/sitter-consult' || p.startsWith('/sitter-consult'),
};

const LOGIN: SiteNavItem = {
  key: 'login',
  label: 'ورود',
  to: '/auth/login',
  icon: LogIn,
  match: (p) => p.startsWith('/auth'),
};

/**
 * Guest mobile dock — cart stays in the top-left cluster only (avoid duplicate
 * سبد in header + dock). Desktop guest nav uses the same set.
 */
export const SITE_NAV_GUEST: SiteNavItem[] = [
  SHOP,
  { ...PLAYMATE_CHATS, gate: true },
  { ...MY_PETS, gate: true },
  LOGIN,
];

/**
 * Logged-in owner set (legacy default). Prefer `siteNavMobileForUser`.
 * Owner: شاپ / هم بازی / پت‌های من / کیف پول / پروفایل
 */
export const SITE_NAV_AUTH: SiteNavItem[] = [
  SHOP_AUTH,
  PLAYMATE_CHATS,
  MY_PETS,
  WALLET,
  PROFILE,
];

/**
 * Desktop header shortcuts — avoid duplicating left-cluster tools.
 * Guest: cart lives in NavUserCluster; Auth: wallet chip + circular avatar cover wallet/profile.
 * my_pets stays mobile-dock only (desktop app nav already links پت‌های من).
 */
export const SITE_NAV_DESKTOP_GUEST: SiteNavItem[] = SITE_NAV_GUEST.filter(
  (item) => item.key !== 'my_pets',
);

export const SITE_NAV_DESKTOP_AUTH: SiteNavItem[] = SITE_NAV_AUTH.filter(
  (item) => item.key !== 'wallet' && item.key !== 'profile' && item.key !== 'my_pets',
);

/** Mobile dock items for the active primary role. */
export function siteNavMobileForRole(role?: UserRole | null): SiteNavItem[] {
  switch (role) {
    case 'vet':
      // دامپزشک: بدون همبازی — پنل پزشک + گفتگو
      return [SHOP_AUTH, VET_PANEL, CHATS, WALLET, PROFILE];
    case 'trainer':
      return [SHOP_AUTH, TRAINER_PANEL, CHATS, WALLET, PROFILE];
    case 'pet_sitter':
      return [SHOP_AUTH, SITTER_PANEL, CHATS, WALLET, PROFILE];
    case 'pet_owner':
      // صاحب پت: هم بازی + پت‌های من کنار هم (= /chats و /my-pets)
      return [SHOP_AUTH, PLAYMATE_CHATS, MY_PETS, WALLET, PROFILE];
    case 'pet_seeker':
    case 'no_pet':
      // بدون همبازی — گفتگو + پت‌های من
      return [SHOP_AUTH, CHATS, MY_PETS, WALLET, PROFILE];
    default:
      return [SHOP_AUTH, CHATS, MY_PETS, WALLET, PROFILE];
  }
}

/** Desktop header items (no wallet/profile/my_pets — cluster + chrome cover those). */
export function siteNavDesktopForRole(role?: UserRole | null): SiteNavItem[] {
  return siteNavMobileForRole(role).filter(
    (item) => item.key !== 'wallet' && item.key !== 'profile' && item.key !== 'my_pets',
  );
}

export function siteNavMobileForUser(user?: User | null): SiteNavItem[] {
  return siteNavMobileForRole(primaryRole(user?.roles, user?.role));
}

export function siteNavDesktopForUser(user?: User | null): SiteNavItem[] {
  return siteNavDesktopForRole(primaryRole(user?.roles, user?.role));
}
