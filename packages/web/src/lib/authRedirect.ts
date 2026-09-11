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
    target === '/home' || target === '/vet-consult'
      ? '/auth/login'
      : `/auth/login?next=${encodeURIComponent(target)}`;
  // Keep gtm_debug / _dbg on the login URL so Tag Assistant stays paired.
  return withTagAssistantParams(base);
}

export function readNextFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  return sanitizeNext(params.get('next'), '/home');
}

export function postAuthPath(opts: {
  hasRole: boolean;
  isProfileComplete: boolean;
  next?: string | null;
  /** When set and next is default home, route to this role dashboard */
  roleHome?: string | null;
}): string {
  if (!opts.hasRole) return withTagAssistantParams('/onboarding/role');
  if (!opts.isProfileComplete) return withTagAssistantParams('/onboarding/profile');
  const sanitized = sanitizeNext(opts.next, '/home');
  if (
    opts.roleHome &&
    (sanitized === '/home' || sanitized === '/vet-consult')
  ) {
    return withTagAssistantParams(opts.roleHome);
  }
  return withTagAssistantParams(sanitized);
}
