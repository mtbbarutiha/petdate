import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { loginPath, postAuthPath, readNextFromSearch, sanitizeNext } from '../lib/authRedirect';
import { stripTagAssistantParams, withTagAssistantParams } from '../lib/tagAssistantParams';
import { useAuthStore } from '../hooks/useAuthStore';
import { TelegramSync } from './OnboardingGuard';
import { dashboardPathForUser } from '@petdate/shared';

const PUBLIC_EXACT = new Set(['/', '/welcome', '/faq', '/vet-consult', '/magazine', '/news']);
const PUBLIC_PREFIXES = [
  '/auth',
  '/admin',
  '/adoption',
  '/games',
  '/shop',
  '/magazine',
  '/vet-consult',
  '/pet',
];

function isPublic(pathname: string) {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (PUBLIC_EXACT.has(p)) return true;
  return PUBLIC_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export function AuthGuard({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const { isLoggedIn, hasRole, isProfileComplete, refreshMe, token, user } = useAuthStore();
  const nextFromQuery = readNextFromSearch(location.search);
  const nextFromState = sanitizeNext(
    (location.state as { from?: string } | null)?.from,
    nextFromQuery
  );
  const roleHome = dashboardPathForUser(user);

  // Depend on token only — refreshMe is a stable module-level bind, but keeping
  // it out of deps prevents accidental re-fetch loops if the hook regresses.
  useEffect(() => {
    if (token) void refreshMe().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token is the sole trigger
  }, [token]);

  if (location.pathname.startsWith('/admin')) {
    return <>{children ?? <Outlet />}</>;
  }

  if (!isLoggedIn && !isPublic(location.pathname)) {
    // Strip gtm_debug/_dbg out of `next`; loginPath re-attaches them top-level.
    const next = sanitizeNext(
      stripTagAssistantParams(location.pathname + location.search),
      '/home',
    );
    return <Navigate to={loginPath(next)} replace state={{ from: next }} />;
  }

  // Public surfaces (landing, shop, adoption) stay browsable even before role pick.
  if (
    isLoggedIn &&
    !hasRole &&
    !location.pathname.startsWith('/onboarding/role') &&
    !isPublic(location.pathname)
  ) {
    return (
      <Navigate
        to={withTagAssistantParams('/onboarding/role')}
        replace
        state={{ next: nextFromState }}
      />
    );
  }

  // پروفایل ناقص را مثل ربات اجباری نگه نمی‌داریم — «فعلاً رد کن» باید به اپ راه بدهد.
  // ورود اولیه هنوز از postAuthPath به /onboarding/profile هدایت می‌شود.

  if (isLoggedIn && isPublic(location.pathname) && location.pathname.startsWith('/auth')) {
    if (!hasRole) {
      return <Navigate to={withTagAssistantParams('/onboarding/role')} replace />;
    }
    return (
      <Navigate
        to={postAuthPath({ hasRole, isProfileComplete, next: nextFromQuery, roleHome })}
        replace
      />
    );
  }

  return <>{children ?? <Outlet />}</>;
}

export function AppGuards({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TelegramSync />
      <AuthGuard>{children}</AuthGuard>
    </>
  );
}
