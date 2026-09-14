import { FormEvent, MouseEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Send, Smartphone } from 'lucide-react';
import { AuthShell } from '../../components/AuthShell';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useAppToast } from '../../hooks/useAppToast';
import {
  fetchAuthProviders,
  googleOAuthStartPath,
  pollTelegramPendingLogin,
  prefersSameBrowserTelegramLogin,
  startTelegramPendingLogin,
  telegramWebLoginDeepLink,
} from '../../lib/api';
import { postAuthPath, sanitizeNext } from '../../lib/authRedirect';
import { dashboardPathForUser } from '@petdate/shared';

type WaitingState = {
  id: string;
  deepLink: string;
  expiresAt: string;
};

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.3 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.8-6.7 7.2l.1.1 6.3 5.3C36.9 41.5 44 36 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

function googleErrorCopy(code: string | null): string {
  if (code === 'missing') return 'ورود گوگل روی سرور پیکربندی نشده است.';
  if (code === 'denied') return 'ورود گوگل لغو شد.';
  if (code === 'expired' || code === 'bad_state') return 'نشست گوگل منقضی شد. دوباره تلاش کن.';
  if (code === 'token' || code === 'profile') return 'گوگل پروفایل را برنگرداند. دوباره تلاش کن.';
  if (code) return 'ورود با گوگل ناموفق بود.';
  return '';
}

function readRetryAfterSec(err: unknown): number | null {
  if (err && typeof err === 'object' && 'retryAfterSec' in err) {
    const n = Number((err as { retryAfterSec?: unknown }).retryAfterSec);
    if (Number.isFinite(n) && n > 0) return Math.max(1, Math.ceil(n));
  }
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const m = msg.match(/(\d+)\s*ثانیه/);
  if (m) return Math.max(1, Number(m[1]));
  return null;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const next = sanitizeNext(
    searchParams.get('next') || (location.state as { from?: string } | null)?.from,
    '/home'
  );
  const { requestOtp, isLoggedIn, isProfileComplete, hasRole, user, acceptSession } =
    useAuthStore();
  const { toastError, toastSuccess, toastInfo } = useAppToast();
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => googleErrorCopy(searchParams.get('google')));
  const [devHint, setDevHint] = useState('');
  const [waiting, setWaiting] = useState<WaitingState | null>(null);
  const [tgBusy, setTgBusy] = useState(false);
  /** null = loading providers */
  const [googleReady, setGoogleReady] = useState<boolean | null>(null);
  const [sendIn, setSendIn] = useState(0);
  const telegramLoginUrl = telegramWebLoginDeepLink(next);
  const usePendingFlow = prefersSameBrowserTelegramLogin();
  const finishingRef = useRef(false);
  const googleHref = googleOAuthStartPath(next);

  useEffect(() => {
    let cancelled = false;
    void fetchAuthProviders()
      .then((res) => {
        if (!cancelled) setGoogleReady(Boolean(res.google));
      })
      .catch(() => {
        if (!cancelled) setGoogleReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (sendIn <= 0) return;
    const t = window.setTimeout(() => setSendIn((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [sendIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    navigate(
      postAuthPath({
        hasRole,
        isProfileComplete,
        next,
        roleHome: dashboardPathForUser(user),
      }),
      { replace: true }
    );
  }, [isLoggedIn, hasRole, isProfileComplete, navigate, next, user]);

  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;
    finishingRef.current = false;

    const tick = async () => {
      if (cancelled || finishingRef.current) return;
      try {
        const res = await pollTelegramPendingLogin(waiting.id);
        if (cancelled || finishingRef.current) return;
        if (res.status === 'pending') return;
        if (res.status === 'ready' && res.token && res.user) {
          finishingRef.current = true;
          acceptSession(res.token, res.user);
          const rolesOk = Boolean(res.user.role || (res.user.roles && res.user.roles.length));
          const profileOk =
            res.user.onboarding === 'profile_complete' ||
            Boolean(res.user.name?.trim() && res.user.age && res.user.gender && res.user.city);
          navigate(
            postAuthPath({
              hasRole: rolesOk,
              isProfileComplete: profileOk,
              next: sanitizeNext(res.next ?? next, next),
              roleHome: dashboardPathForUser(res.user),
            }),
            { replace: true }
          );
          return;
        }
        setError(res.error || 'ورود از تلگرام ناموفق بود');
        setWaiting(null);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : '';
        if (/410|منقضی|استفاده|پیدا نشد/i.test(msg)) {
          setError(msg || 'درخواست ورود منقضی شد');
          setWaiting(null);
        }
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), 1600);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [waiting, acceptSession, navigate, next]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sendIn > 0) return;
    setError('');
    setDevHint('');
    setBusy(true);
    try {
      const res = await requestOtp('phone', target.trim());
      if (res.devCode) setDevHint(`کد توسعه: ${res.devCode}`);
      toastSuccess('کد ارسال شد');
      navigate(`/auth/otp?next=${encodeURIComponent(next)}`, {
        state: res.devCode ? { devCode: res.devCode, next } : { next },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ارسال کد ناموفق بود';
      const retry = readRetryAfterSec(err);
      if (retry) setSendIn(retry);
      setError(msg);
      toastError(msg);
    } finally {
      setBusy(false);
    }
  }

  function onGoogleClick(e: MouseEvent) {
    if (googleReady === true) return;
    e.preventDefault();
    setError('ورود با گوگل (جیمیل) روی این سرور هنوز فعال نشده — کلید OAuth لازم است.');
  }

  async function onTelegramLogin(e: MouseEvent) {
    if (!usePendingFlow) return;
    e.preventDefault();
    setError('');
    setTgBusy(true);
    try {
      const res = await startTelegramPendingLogin(next);
      setWaiting({
        id: res.id,
        deepLink: res.deepLink,
        expiresAt: res.expiresAt,
      });
      window.open(res.deepLink, '_blank', 'noopener,noreferrer');
      toastInfo('تلگرام را باز کن و ورود را تأیید کن.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'شروع ورود تلگرام ناموفق بود';
      setError(msg);
      toastError(msg);
    } finally {
      setTgBusy(false);
    }
  }

  if (waiting) {
    return (
      <AuthShell
        bannerTitle="ورود با تلگرام"
        bannerLead="تأیید تلگرام — ادامه در همین مرورگر"
        bannerImage="/pepito/uploads/3.jpg"
        footer={false}
      >
        <div className="pepito-auth-login auth-login-premium auth-login-premium--wait">
          <h1>منتظر تأیید…</h1>
          <p className="auth-lead">
            در تلگرام دکمهٔ <strong>تأیید ورود</strong> را بزن. همین تب خودکار وارد می‌شود.
          </p>
          {error ? <p className="auth-error">{error}</p> : null}
          <a
            className="pepito-btn button-3 auth-telegram-cta auth-login-method"
            href={waiting.deepLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Send size={16} strokeWidth={2} aria-hidden />
            باز کردن دوباره تلگرام
          </a>
          <button
            type="button"
            className="auth-link-btn"
            onClick={() => {
              setWaiting(null);
              setError('');
            }}
          >
            انصراف و بازگشت
          </button>
        </div>
      </AuthShell>
    );
  }

  const lead = 'با تلگرام، گوگل یا موبایل وارد شو — یک حساب برای وب و ربات.';
  const googleOn = googleReady === true;

  return (
    <AuthShell
      bannerTitle="ورود"
      bannerLead="ورود امن — همان حساب وب و ربات"
      bannerImage="/pepito/uploads/3.jpg"
      footer={false}
    >
      <div className="pepito-auth-login auth-login-premium">
        <header className="auth-login-head">
          <h1>خوش آمدی</h1>
          <p className="auth-lead">{lead}</p>
        </header>

        <div className="auth-login-methods" role="group" aria-label="روش‌های ورود">
          <a
            className="pepito-btn button-3 auth-telegram-cta auth-login-method auth-login-method--primary"
            href={usePendingFlow ? '#' : telegramLoginUrl}
            target={usePendingFlow ? undefined : '_blank'}
            rel="noopener noreferrer"
            onClick={onTelegramLogin}
            aria-disabled={tgBusy}
          >
            <Send size={17} strokeWidth={2.25} aria-hidden />
            {tgBusy ? 'در حال آماده‌سازی…' : 'ورود با تلگرام'}
          </a>

          <a
            className={`auth-google-cta auth-login-method auth-login-method--google${
              googleOn ? '' : ' is-off'
            }`}
            href={googleOn ? googleHref : '#'}
            aria-disabled={!googleOn}
            onClick={onGoogleClick}
          >
            <GoogleMark />
            ورود با گوگل (جیمیل)
          </a>
          {googleReady === false ? (
            <p className="auth-provider-hint">ورود گوگل روی این سرور هنوز فعال نشده.</p>
          ) : null}
        </div>

        <div className="auth-or auth-login-or" role="separator">
          <span>یا با موبایل</span>
        </div>

        <form className="auth-form auth-login-phone" onSubmit={onSubmit}>
          <label className="auth-login-phone-label" htmlFor="login-phone">
            <Smartphone size={15} aria-hidden />
            شماره موبایل
          </label>
          <div className="auth-login-phone-row">
            <input
              id="login-phone"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="0912…"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              required
            />
            <button
              type="submit"
              className="pepito-btn button-1 auth-submit auth-login-otp-btn"
              disabled={busy || !target.trim() || sendIn > 0}
            >
              {busy
                ? '…'
                : sendIn > 0
                  ? `${sendIn.toLocaleString('fa-IR')}ث`
                  : 'دریافت کد'}
            </button>
          </div>
          {sendIn > 0 ? (
            <p className="auth-otp-countdown" role="status" aria-live="polite">
              ارسال دوباره تا{' '}
              <strong className="auth-otp-countdown-num">
                {sendIn.toLocaleString('fa-IR')}
              </strong>{' '}
              ثانیه
            </p>
          ) : null}
          {error ? <p className="auth-error">{error}</p> : null}
          {devHint ? <p className="auth-dev">{devHint}</p> : null}
        </form>

        <p className="auth-foot">حساب نداری؟ با همان روش وارد شو — ساخته می‌شود.</p>
      </div>
    </AuthShell>
  );
}
