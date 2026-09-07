import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { loginPath, postAuthPath, readNextFromSearch, sanitizeNext } from '../lib/authRedirect';
import { useAuthStore } from '../hooks/useAuthStore';
import { TelegramSync } from './OnboardingGuard';
import { dashboardPathForUser } from '@petdate/shared';

const PUBLIC_EXACT = new Set(['/', '/welcome', '/faq']);
const PUBLIC_PREFIXES = ['/auth', '/admin', '/adoption', '/shop'];

function isPublic(pathname: string) {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AuthGuard({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const { isLoggedIn, hasRole, isProfileComplete, refreshMe, token, user } = useAuthStore();
  const [authReady, setAuthReady] = useState(() => !token);
  const nextFromQuery = readNextFromSearch(location.search);
  const nextFromState = sanitizeNext(
    (location.state as { from?: string } | null)?.from,
    nextFromQuery
  );
  const roleHome = dashboardPathForUser(user);

  // Depend on token only — refreshMe is a stable module-level bind, but keeping
  // it out of deps prevents accidental re-fetch loops if the hook regresses.
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setAuthReady(true);
      return;
    }
    setAuthReady(false);
    void refreshMe()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token is the sole trigger
  }, [token]);

  if (location.pathname.startsWith('/admin')) {
    return <>{children ?? <Outlet />}</>;
  }

  if (!authReady) {
    return <div className="pepito-auth-boot" aria-busy="true" aria-label="در حال بررسی ورود" />;
  }

  if (!isLoggedIn && !isPublic(location.pathname)) {
    const next = sanitizeNext(location.pathname + location.search, '/home');
    return <Navigate to={loginPath(next)} replace state={{ from: next }} />;
  }

  // Public surfaces (landing, shop, adoption) stay browsable even before role pick.
  if (
    isLoggedIn &&
    !hasRole &&
    !location.pathname.startsWith('/onboarding/role') &&
    !isPublic(location.pathname)
  ) {
    return <Navigate to="/onboarding/role" replace state={{ next: nextFromState }} />;
  }

  // پروفایل ناقص را مثل ربات اجباری نگه نمی‌داریم — «فعلاً رد کن» باید به اپ راه بدهد.
  // ورود اولیه هنوز از postAuthPath به /onboarding/profile هدایت می‌شود.

  if (isLoggedIn && isPublic(location.pathname) && location.pathname.startsWith('/auth')) {
    if (!hasRole) return <Navigate to="/onboarding/role" replace />;
    return <Navigate to={postAuthPath({ hasRole, isProfileComplete, next: nextFromQuery, roleHome })} replace />;
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
