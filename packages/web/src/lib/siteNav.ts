import type { LucideIcon } from 'lucide-react';
import {
  LogIn,
  MessagesSquare,
  HeartHandshake,
  PawPrint,
  ShoppingBag,
  Stethoscope,
  GraduationCap,
  UserRound,
  Wallet,
  Gamepad2,
} from 'lucide-react';
import type { PublicPlatformConfig, User, UserRole } from '@petdate/shared';
import { primaryRole } from '@petdate/shared';

export type SiteNavItem = {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Send guests through login when true */
  gate?: boolean;
  /** Wallet / money destinations use the finance accent. */
  tone?: 'finance';
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

/**
 * Owner/guest playmate hub — lives in /chats (find + inbox), not a separate page.
 * Distinct from «بازی‌ها» (/games) — scheduled group games via /api/games.
 */
const PLAYMATE_CHATS: SiteNavItem = {
  key: 'playmate',
  label: 'هم بازی',
  to: '/chats',
  icon: HeartHandshake,
  match: (p) => p === '/chats' || p.startsWith('/chats/') || p.startsWith('/vet-chats'),
};

/** Scheduled group games (football, board, …) — public list + join/create. */
const GAMES: SiteNavItem = {
  key: 'games',
  label: 'بازی‌ها',
  to: '/games',
  icon: Gamepad2,
  match: (p) => p === '/games' || p.startsWith('/games/'),
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
  tone: 'finance',
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

const LOGIN: SiteNavItem = {
  key: 'login',
  label: 'ورود',
  to: '/auth/login',
  icon: LogIn,
  match: (p) => p.startsWith('/auth'),
};

/**
 * Guest mobile dock — cart stays in the top-left cluster only (avoid duplicate
 * سبد in header + dock). Games lives on desktop/landing/footer, not this 4-slot bar.
 * Order: primary (هم بازی) → browse (شاپ / پت) → ورود.
 */
export const SITE_NAV_GUEST: SiteNavItem[] = [
  { ...PLAYMATE_CHATS, gate: true },
  SHOP,
  { ...MY_PETS, gate: true },
  LOGIN,
];

/**
 * Logged-in owner set (legacy default). Prefer `siteNavMobileForUser`.
 * Owner dock: هم بازی / پت‌های من / شاپ / کیف پول / پروفایل
 * Games must not replace کیف پول or گفتگو/هم بازی (#325 regression).
 */
export const SITE_NAV_AUTH: SiteNavItem[] = [
  PLAYMATE_CHATS,
  MY_PETS,
  SHOP_AUTH,
  WALLET,
  PROFILE,
];

/** Insert Games after شاپ so it never occupies the chats or wallet slot. */
function withGamesAfterShop(items: SiteNavItem[]): SiteNavItem[] {
  if (items.some((item) => item.key === 'games')) return items;
  const shopIdx = items.findIndex((item) => item.key === 'shop');
  if (shopIdx >= 0) {
    return [...items.slice(0, shopIdx + 1), GAMES, ...items.slice(shopIdx + 1)];
  }
  return [GAMES, ...items];
}

/**
 * Desktop header shortcuts — avoid duplicating left-cluster tools.
 * Guest: cart lives in NavUserCluster; Auth: wallet chip + circular avatar cover wallet/profile.
 * my_pets stays mobile-dock only (desktop app nav already links پت‌های من).
 * Games is a desktop/secondary destination — not a mobile-dock replacement.
 */
export const SITE_NAV_DESKTOP_GUEST: SiteNavItem[] = withGamesAfterShop(
  SITE_NAV_GUEST.filter((item) => item.key !== 'my_pets'),
);

export const SITE_NAV_DESKTOP_AUTH: SiteNavItem[] = withGamesAfterShop(
  SITE_NAV_AUTH.filter(
    (item) => item.key !== 'wallet' && item.key !== 'profile' && item.key !== 'my_pets',
  ),
);

/** Mobile dock items for the active primary role. */
export function siteNavMobileForRole(role?: UserRole | null): SiteNavItem[] {
  switch (role) {
    case 'vet':
      // دامپزشک: پنل (اصلی) → گفتگو → شاپ → کیف پول → پروفایل
      return [VET_PANEL, CHATS, SHOP_AUTH, WALLET, PROFILE];
    case 'trainer':
      return [TRAINER_PANEL, CHATS, SHOP_AUTH, WALLET, PROFILE];
    case 'pet_owner':
      // صاحب پت: هم بازی → پت‌های من → شاپ → کیف پول (مالی) → پروفایل
      return [PLAYMATE_CHATS, MY_PETS, SHOP_AUTH, WALLET, PROFILE];
    case 'no_pet':
      return [CHATS, MY_PETS, SHOP_AUTH, WALLET, PROFILE];
    default:
      return [CHATS, MY_PETS, SHOP_AUTH, WALLET, PROFILE];
  }
}

/** Desktop header items (no wallet/profile/my_pets — cluster + chrome cover those). */
export function siteNavDesktopForRole(role?: UserRole | null): SiteNavItem[] {
  return withGamesAfterShop(
    siteNavMobileForRole(role).filter(
      (item) => item.key !== 'wallet' && item.key !== 'profile' && item.key !== 'my_pets',
    ),
  );
}

export function siteNavMobileForUser(user?: User | null): SiteNavItem[] {
  return siteNavMobileForRole(primaryRole(user?.roles, user?.role));
}

export function siteNavDesktopForUser(user?: User | null): SiteNavItem[] {
  return siteNavDesktopForRole(primaryRole(user?.roles, user?.role));
}

export function filterNavByPlatformConfig(
  items: SiteNavItem[],
  cfg: PublicPlatformConfig | null | undefined
): SiteNavItem[] {
  if (!cfg) return items;
  return items.filter((item) => {
    if (item.key === 'shop' && !cfg.shopEnabled) return false;
    if (item.key === 'playmate' && !cfg.playdatesEnabled) return false;
    if (item.key === 'vet_panel' && !cfg.vetConsultEnabled) return false;
    return true;
  });
}
