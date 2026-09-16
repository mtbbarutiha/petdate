import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { dashboardPathForUser } from '@petdate/shared';
import { AuthShell } from '../../components/AuthShell';
import { useAuthStore } from '../../hooks/useAuthStore';
import { fetchMe } from '../../lib/api';
import { postAuthPath, sanitizeNext } from '../../lib/authRedirect';
import { trackAuthSuccess } from '../../lib/siteAnalytics';

/**
 * Completes Google OAuth after the API callback redirects here with a session token.
 */
export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { acceptSession, hasRole, isProfileComplete, isLoggedIn, user } = useAuthStore();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const token = searchParams.get('token')?.trim() ?? '';
    const next = sanitizeNext(searchParams.get('next'), '/home');
    if (!token) {
      setError('ورود گوگل ناقص است. دوباره از صفحه ورود تلاش کن.');
      setBusy(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const me = await fetchMe(token);
        if (cancelled) return;
        const user = me.user;
        acceptSession(token, user);
        const createdMs = user.createdAt ? Date.parse(user.createdAt) : NaN;
        const isNewUser = Number.isFinite(createdMs) && Date.now() - createdMs < 15 * 60 * 1000;
        trackAuthSuccess({ isNewUser, method: 'google', userId: user.id });
        const rolesOk = Boolean(user.role || (user.roles && user.roles.length));
        const profileOk =
          user.onboarding === 'profile_complete' ||
          Boolean(user.name?.trim() && user.age && user.gender && user.city);
        navigate(
          postAuthPath({
            hasRole: rolesOk,
            isProfileComplete: profileOk,
            next,
            roleHome: dashboardPathForUser(user),
          }),
          { replace: true }
        );
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'ورود با گوگل ناموفق بود';
        setError(msg);
        setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, acceptSession, navigate]);

  useEffect(() => {
    if (!isLoggedIn || busy || error) return;
    navigate(
      postAuthPath({
        hasRole,
        isProfileComplete,
        next: sanitizeNext(searchParams.get('next'), '/home'),
        roleHome: dashboardPathForUser(user),
      }),
      { replace: true }
    );
  }, [isLoggedIn, busy, error, hasRole, isProfileComplete, navigate, searchParams, user]);

  return (
    <AuthShell
      bannerTitle="ورود با گوگل"
      bannerLead="نام، ایمیل و عکس حساب گوگل روی پروفایل پت‌دیت می‌نشیند"
      bannerImage="/pepito/uploads/3.jpg"
    >
      <p className="pepito-auth-kicker">گوگل</p>
      <h1>{error ? 'ورود ناموفق' : 'در حال ورود…'}</h1>
      {busy && !error ? <p className="auth-lead">در حال تکمیل نشست امن…</p> : null}
      {error ? (
        <>
          <p className="auth-lead" role="alert">
            {error}
          </p>
          <p>
            <Link to="/auth/login">بازگشت به ورود</Link>
          </p>
        </>
      ) : null}
    </AuthShell>
  );
}
