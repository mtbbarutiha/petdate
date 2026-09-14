import type { LucideIcon } from 'lucide-react';
import {
  LogIn,
  ShoppingBag,
  Stethoscope,
  GraduationCap,
  UserRound,
  Wallet,
  Gamepad2,
  PawPrint,
} from 'lucide-react';
import type { PublicPlatformConfig, User, UserRole } from '@petdate/shared';
import { primaryRole } from '@petdate/shared';
import { ChatPawIcon } from '../components/icons/ChatPawIcon';

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

/**
 * Primary شاپ shortcut — active on shop home + product/checkout flows.
 * Not active on section extras that have their own header links
 * (سفارش‌ها / سگ / گربه / پرنده) so only one underline shows.
 */
function isShopPrimaryActive(pathname: string, includeCart: boolean): boolean {
  if (pathname === '/shop' || pathname === '/shop/') return true;
  if (!pathname.startsWith('/shop/')) return false;
  if (pathname === '/shop/orders' || pathname.startsWith('/shop/orders/')) return false;
  if (pathname.startsWith('/shop/c/')) return false;
  if (!includeCart && (pathname === '/shop/cart' || pathname.startsWith('/shop/cart/'))) return false;
  return true;
}

const SHOP: SiteNavItem = {
  key: 'shop',
  label: 'شاپ',
  to: '/shop',
  icon: ShoppingBag,
  match: (p) => isShopPrimaryActive(p, false),
};

const SHOP_AUTH: SiteNavItem = {
  ...SHOP,
  match: (p) => isShopPrimaryActive(p, true),
};

/**
 * Owner/guest playmate hub — lives in /chats (find + inbox), not a separate page.
 * Distinct from «ایونت‌ها» (/events) — scheduled group events via /api/games.
 * Icon: chat bubble + paw (PetDate conversations mark).
 */
const PLAYMATE_CHATS: SiteNavItem = {
  key: 'playmate',
  label: 'هم بازی',
  to: '/chats',
  icon: ChatPawIcon as LucideIcon,
  match: (p) => p === '/chats' || p.startsWith('/chats/') || p.startsWith('/vet-chats'),
};

/** Scheduled group events (football, board, …) — public list + join/create. */
const GAMES: SiteNavItem = {
  key: 'games',
  label: 'ایونت‌ها',
  to: '/events',
  icon: Gamepad2,
  match: (p) =>
    p === '/events' ||
    p.startsWith('/events/') ||
    p === '/games' ||
    p.startsWith('/games/'),
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
  icon: ChatPawIcon as LucideIcon,
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
 * سبد in header + dock). Events lives on desktop/landing/footer, not this 4-slot bar.
 * Order: browse (شاپ) → primary center (هم بازی) → پت → ورود.
 */
export const SITE_NAV_GUEST: SiteNavItem[] = [
  SHOP,
  { ...PLAYMATE_CHATS, gate: true },
  { ...MY_PETS, gate: true },
  LOGIN,
];

/**
 * Logged-in owner set (legacy default). Prefer `siteNavMobileForUser`.
 * Owner dock: شاپ / پت‌های من / هم بازی (مرکز) / کیف پول / پروفایل
 * Events must not replace کیف پول or گفتگو/هم بازی (#325 regression).
 */
export const SITE_NAV_AUTH: SiteNavItem[] = [
  SHOP_AUTH,
  MY_PETS,
  PLAYMATE_CHATS,
  WALLET,
  PROFILE,
];

/** Insert Events after شاپ so it never occupies the chats or wallet slot. */
function withGamesAfterShop(items: SiteNavItem[]): SiteNavItem[] {
  if (items.some((item) => item.key === 'games')) return items;
  const shopIdx = items.findIndex((item) => item.key === 'shop');
  if (shopIdx >= 0) {
    return [...items.slice(0, shopIdx + 1), GAMES, ...items.slice(shopIdx + 1)];
  }
  return [GAMES, ...items];
}

/**
 * Desktop chrome keeps گفتگو/هم بازی before شاپ (mobile dock puts chats in the center).
 * Relative order of other items is preserved; Events still appends after شاپ only.
 */
function desktopOrderFromMobile(items: SiteNavItem[]): SiteNavItem[] {
  const isChat = (key: string) => key === 'chats' || key === 'playmate';
  const chats = items.filter((item) => isChat(item.key));
  const shop = items.filter((item) => item.key === 'shop');
  const result: SiteNavItem[] = [];
  let chatsInserted = false;
  let shopInserted = false;
  for (const item of items) {
    if (isChat(item.key) || item.key === 'shop') {
      if (!chatsInserted) {
        result.push(...chats);
        chatsInserted = true;
      }
      if (!shopInserted) {
        result.push(...shop);
        shopInserted = true;
      }
      continue;
    }
    result.push(item);
  }
  if (!chatsInserted) result.push(...chats);
  if (!shopInserted) result.push(...shop);
  return withGamesAfterShop(result);
}

/**
 * Desktop header shortcuts — avoid duplicating left-cluster tools.
 * Guest: login icon + cart live in NavUserCluster (no text «ورود» in the right menu).
 * Auth: wallet chip + circular avatar cover wallet/profile.
 * my_pets stays mobile-dock only (desktop app nav already links پت‌های من).
 * Events is a desktop/secondary destination — not a mobile-dock replacement.
 * Desktop order: هم بازی / شاپ / ایونت‌ها (chats before shop).
 */
export const SITE_NAV_DESKTOP_GUEST: SiteNavItem[] = desktopOrderFromMobile(
  SITE_NAV_GUEST.filter((item) => item.key !== 'my_pets' && item.key !== 'login'),
);

export const SITE_NAV_DESKTOP_AUTH: SiteNavItem[] = desktopOrderFromMobile(
  SITE_NAV_AUTH.filter(
    (item) => item.key !== 'wallet' && item.key !== 'profile' && item.key !== 'my_pets',
  ),
);

/** Mobile dock items for the active primary role. */
export function siteNavMobileForRole(role?: UserRole | null): SiteNavItem[] {
  switch (role) {
    case 'vet':
      // دامپزشک: پنل → شاپ → گفتگو (مرکز) → کیف پول → پروفایل
      return [VET_PANEL, SHOP_AUTH, CHATS, WALLET, PROFILE];
    case 'trainer':
      return [TRAINER_PANEL, SHOP_AUTH, CHATS, WALLET, PROFILE];
    case 'pet_owner':
      // صاحب پت: شاپ → پت‌های من → هم بازی (مرکز) → کیف پول → پروفایل
      return [SHOP_AUTH, MY_PETS, PLAYMATE_CHATS, WALLET, PROFILE];
    case 'no_pet':
      return [SHOP_AUTH, MY_PETS, CHATS, WALLET, PROFILE];
    default:
      return [SHOP_AUTH, MY_PETS, CHATS, WALLET, PROFILE];
  }
}

/** Desktop header items (no wallet/profile/my_pets — cluster + chrome cover those). */
export function siteNavDesktopForRole(role?: UserRole | null): SiteNavItem[] {
  return desktopOrderFromMobile(
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

/** Routes where the Instagram-style mobile dock is hidden. */
export function isMobileDockHidden(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/onboarding') ||
    pathname === '/chats' ||
    pathname.startsWith('/chats/') ||
    pathname.startsWith('/vet-chats') ||
    pathname === '/vet-consult' ||
    pathname.startsWith('/vet-consult/')
  );
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
