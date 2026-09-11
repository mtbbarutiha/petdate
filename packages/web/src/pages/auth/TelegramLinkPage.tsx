import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '../../components/AuthShell';
import { useAuthStore } from '../../hooks/useAuthStore';
import { exchangeTelegramWebLink } from '../../lib/api';
import { postAuthPath, sanitizeNext } from '../../lib/authRedirect';
import { dashboardPathForUser } from '@petdate/shared';
import { trackAuthSuccess } from '../../lib/siteAnalytics';

/**
 * Consumes a bot-signed deep link and opens a web session on the same user row.
 */
export function TelegramLinkPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { acceptSession, hasRole, isProfileComplete, isLoggedIn, user } = useAuthStore();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const tg = searchParams.get('tg')?.trim() ?? '';
    const exp = searchParams.get('exp')?.trim() ?? '';
    const sig = searchParams.get('sig')?.trim() ?? '';
    const next = sanitizeNext(searchParams.get('next'), '/wallet');

    if (!tg || !exp || !sig) {
      setError('لینک ناقص است. از دکمهٔ ربات دوباره وارد شو.');
      setBusy(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await exchangeTelegramWebLink({ telegramId: tg, exp, sig });
        if (cancelled) return;
        acceptSession(res.token, res.user);
        const createdMs = res.user.createdAt ? Date.parse(res.user.createdAt) : NaN;
        const isNewUser =
          Number.isFinite(createdMs) && Date.now() - createdMs < 15 * 60 * 1000;
        trackAuthSuccess({ isNewUser, method: 'telegram_link', userId: res.user.id });
        const rolesOk = Boolean(res.user.role || (res.user.roles && res.user.roles.length));
        const profileOk =
          res.user.onboarding === 'profile_complete' ||
          Boolean(res.user.name?.trim() && res.user.age && res.user.gender && res.user.city);
        navigate(
          postAuthPath({
            hasRole: rolesOk,
            isProfileComplete: profileOk,
            next,
            roleHome: dashboardPathForUser(res.user),
          }),
          { replace: true }
        );
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'ورود از تلگرام ناموفق بود';
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
        next: sanitizeNext(searchParams.get('next'), '/wallet'),
        roleHome: dashboardPathForUser(user),
      }),
      { replace: true }
    );
  }, [isLoggedIn, busy, error, hasRole, isProfileComplete, navigate, searchParams, user]);

  return (
    <AuthShell
      bannerTitle="ورود از تلگرام"
      bannerLead="همان حساب ربات — همان پت‌ها، چت‌ها و کیف پول"
      bannerImage="/pepito/uploads/3.jpg"
    >
      <p className="pepito-auth-kicker">تلگرام</p>
      <h1>اتصال به وب</h1>
      {busy && !error ? (
        <p className="auth-lead">در حال ورود امن با حساب تلگرام…</p>
      ) : null}
      {error ? (
        <>
          <p className="auth-lead" role="alert">
            {error}
          </p>
          <p className="auth-lead">
            از ربات دکمه «🌐 باز کردن وب» را دوباره بزن، یا با موبایل وارد شو.
          </p>
          <p>
            <Link to="/auth/login">ورود با موبایل / ایمیل</Link>
            {user?.telegramId ? ` · tg ${user.telegramId}` : null}
          </p>
        </>
      ) : null}
    </AuthShell>
  );
}
