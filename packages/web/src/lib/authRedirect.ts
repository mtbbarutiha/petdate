import { stripTagAssistantParams, withTagAssistantParams } from './tagAssistantParams';

const SAFE_NEXT = /^\/(?!\/)[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/;

/** Only allow same-origin relative paths (block open redirects). */
export function sanitizeNext(raw: string | null | undefined, fallback = '/home'): string {
  if (!raw) return fallback;
  // Never treat Tag Assistant debug params as part of post-login destination noise.
  const value = stripTagAssistantParams(raw.trim());
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.startsWith('/auth') || value.startsWith('/welcome')) return fallback;
  if (value === '/') return '/home';
  if (!SAFE_NEXT.test(value)) return fallback;
  return value;
}

export function loginPath(next?: string | null): string {
  const target = sanitizeNext(next, '/home');
  const base =
    target === '/home'
      ? '/auth/login'
      : `/auth/login?next=${encodeURIComponent(target)}`;
  // Keep gtm_debug / _dbg on the login URL so Tag Assistant stays paired.
  return withTagAssistantParams(base);
}

export function readNextFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  return sanitizeNext(params.get('next'), '/home');
}

export function phoneVerifyPath(next?: string | null): string {
  const target = sanitizeNext(next, '/home');
  const base =
    target === '/home'
      ? '/auth/phone'
      : `/auth/phone?next=${encodeURIComponent(target)}`;
  return withTagAssistantParams(base);
}

/**
 * Logged-in users may browse marketing / help without SMS.
 * Product work (shop, wallet, playmate, events, profile, chats, consults)
 * is not exempt — AuthGuard sends them to /auth/phone.
 * Guests still use isPublic in AuthGuard; this list must not lock /auth/phone.
 */
const PHONE_GATE_EXEMPT_EXACT = new Set([
  '/',
  '/welcome',
  '/faq',
  '/help',
  '/magazine',
  '/news',
  '/invite',
  '/landings/app',
  '/app',
  '/reviews',
]);

const PHONE_GATE_EXEMPT_PREFIXES = [
  '/auth',
  '/admin',
  '/adoption',
  '/magazine',
  '/reviews',
  '/landings',
  '/pet',
  '/team-chat',
  '/support',
  '/news',
];

export function isPhoneGateExempt(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (PHONE_GATE_EXEMPT_EXACT.has(p)) return true;
  return PHONE_GATE_EXEMPT_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export function postAuthPath(opts: {
  hasRole: boolean;
  isProfileComplete: boolean;
  /** Telegram / Google sessions without SMS must verify phone before the app */
  phoneVerified?: boolean;
  next?: string | null;
  /** When set and next is default home, route to this role dashboard */
  roleHome?: string | null;
}): string {
  if (opts.phoneVerified === false) {
    return phoneVerifyPath(opts.next);
  }
  if (!opts.hasRole) return withTagAssistantParams('/onboarding/role');
  if (!opts.isProfileComplete) return withTagAssistantParams('/onboarding/profile');
  const sanitized = sanitizeNext(opts.next, '/home');
  if (opts.roleHome && sanitized === '/home') {
    return withTagAssistantParams(opts.roleHome);
  }
  return withTagAssistantParams(sanitized);
}
