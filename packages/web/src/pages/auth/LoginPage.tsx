import { FormEvent, MouseEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Send, Smartphone } from 'lucide-react';
import { AuthShell } from '../../components/AuthShell';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useAppToast } from '../../hooks/useAppToast';
import {
  pollTelegramPendingLogin,
  prefersSameBrowserTelegramLogin,
  startTelegramPendingLogin,
  telegramWebLoginDeepLink,
  type WebOtpChannel,
} from '../../lib/api';
import { postAuthPath, sanitizeNext } from '../../lib/authRedirect';
import { dashboardPathForUser } from '@petdate/shared';

type WaitingState = {
  id: string;
  deepLink: string;
  expiresAt: string;
};

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
  const [channel, setChannel] = useState<WebOtpChannel>('phone');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [devHint, setDevHint] = useState('');
  const [waiting, setWaiting] = useState<WaitingState | null>(null);
  const [tgBusy, setTgBusy] = useState(false);
  const telegramLoginUrl = telegramWebLoginDeepLink(next);
  const usePendingFlow = prefersSameBrowserTelegramLogin();
  const finishingRef = useRef(false);

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
        // Soft: keep polling on transient network errors
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
    setError('');
    setDevHint('');
    setBusy(true);
    try {
      const res = await requestOtp(channel, target.trim());
      if (res.devCode) setDevHint(`کد توسعه: ${res.devCode}`);
      toastSuccess('کد ارسال شد');
      navigate(`/auth/otp?next=${encodeURIComponent(next)}`, {
        state: res.devCode ? { devCode: res.devCode, next } : { next },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ارسال کد ناموفق بود';
      const full = channel === 'phone' ? `${msg} اگر پیامک نرسید، از تب ایمیل استفاده کن.` : msg;
      setError(full); toastError(full);
    } finally {
      setBusy(false);
    }
  }

  async function onTelegramLogin(e: MouseEvent) {
    if (!usePendingFlow) return; // desktop: let <a href> open classic deep link
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
      // Open Telegram for confirmation only — stay on this waiting tab.
      window.open(res.deepLink, '_blank', 'noopener,noreferrer');
      toastInfo('تلگرام را باز کن و ورود را تأیید کن.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'شروع ورود تلگرام ناموفق بود'; setError(msg); toastError(msg);
    } finally {
      setTgBusy(false);
    }
  }

  if (waiting) {
    return (
      <AuthShell
        bannerTitle="ورود به Pet Date"
        bannerLead="تأیید در تلگرام — ادامه در همین مرورگر"
        bannerImage="/pepito/uploads/3.jpg"
      >
        <p className="pepito-auth-kicker">تلگرام</p>
        <h1>منتظر تأیید…</h1>
        <p className="auth-lead">
          در تلگرام دکمهٔ <strong>تأیید ورود</strong> را بزن. بعد از تأیید، همین صفحه (همین مرورگر)
          خودکار وارد می‌شود — لینک وب را از داخل تلگرام باز نکن.
        </p>
        <p className="auth-telegram-hint auth-telegram-wait">
          این تب را باز نگه دار. اگر تلگرام باز نشد، دکمه زیر را بزن.
        </p>
        {error ? <p className="auth-error">{error}</p> : null}
        <a
          className="pepito-btn button-2 auth-telegram-cta"
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
      </AuthShell>
    );
  }

  return (
    <AuthShell
      bannerTitle="ورود به Pet Date"
      bannerLead="با تلگرام، موبایل یا ایمیل — همان حساب وب و ربات"
      bannerImage="/pepito/uploads/3.jpg"
    >
      <p className="pepito-auth-kicker">ورود</p>
      <h1>خوش آمدی</h1>
      <p className="auth-lead">
        با اکانت تلگرام یک‌ضرب وارد شو، یا مثل قبل با شماره موبایل / ایمیل کد بگیر — همان حساب،
        همان پت‌ها و چت‌ها.
      </p>

      <a
        className="pepito-btn button-2 auth-telegram-cta"
        href={usePendingFlow ? '#' : telegramLoginUrl}
        target={usePendingFlow ? undefined : '_blank'}
        rel="noopener noreferrer"
        onClick={onTelegramLogin}
        aria-disabled={tgBusy}
      >
        <Send size={16} strokeWidth={2} aria-hidden />
        {tgBusy ? 'در حال آماده‌سازی…' : 'ورود با اکانت تلگرام'}
      </a>
      <p className="auth-telegram-hint">
        {usePendingFlow
          ? 'تلگرام فقط برای تأیید باز می‌شود؛ بعد از تأیید، همین مرورگر ادامه می‌دهد.'
          : 'ربات باز می‌شود؛ دکمهٔ «ورود به وبسایت» را بزن تا امن و خودکار وارد وب شوی.'}
      </p>

      <div className="auth-or" role="separator">
        <span>یا ورود با موبایل / ایمیل</span>
      </div>

      <div className="auth-tabs" role="tablist">
        <button
          type="button"
          className={`auth-tab${channel === 'phone' ? ' is-on' : ''}`}
          onClick={() => setChannel('phone')}
        >
          <Smartphone size={16} /> موبایل
        </button>
        <button
          type="button"
          className={`auth-tab${channel === 'email' ? ' is-on' : ''}`}
          onClick={() => setChannel('email')}
        >
          <Mail size={16} /> ایمیل
        </button>
      </div>

      <form className="auth-form" onSubmit={onSubmit}>
        <label>
          {channel === 'phone' ? 'شماره موبایل' : 'ایمیل'}
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={channel === 'phone' ? '0912…' : 'you@email.com'}
            inputMode={channel === 'phone' ? 'tel' : 'email'}
            autoComplete={channel === 'phone' ? 'tel' : 'email'}
            dir={channel === 'phone' ? 'ltr' : undefined}
            required
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        {devHint && <p className="auth-dev">{devHint}</p>}
        <button
          type="submit"
          className="pepito-btn button-1 auth-submit"
          disabled={busy || !target.trim()}
        >
          {busy ? 'در حال ارسال…' : 'دریافت کد یکبارمصرف'}
        </button>
      </form>

      <p className="auth-foot">
        هنوز حساب نداری؟ با تلگرام یا همان شماره/ایمیل وارد شو — حساب خودکار ساخته می‌شود و با ربات
        همگام است.
      </p>
    </AuthShell>
  );
}
