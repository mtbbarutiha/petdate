import { FormEvent, MouseEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import { normalizeRoles, userHasRole, dashboardPathForUser, primaryRole } from '@petdate/shared';
import { AuthShell } from '../../components/AuthShell';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useAppToast } from '../../hooks/useAppToast';
import {
  pollTelegramPendingLogin,
  prefersSameBrowserTelegramLogin,
  startTelegramPendingLogin,
  telegramWebLoginDeepLink,
} from '../../lib/api';
import { postAuthPath, sanitizeNext } from '../../lib/authRedirect';

type OtpCredentialLike = { code?: string };

/** Chrome Android Web OTP — typed loosely (not in all TS DOM libs). */
type OtpCredentialRequestOptions = CredentialRequestOptions & {
  otp?: { transport: Array<'sms'> };
};

const OTP_LEN = 5;

function digitsOnly(raw: string): string {
  return String(raw ?? '')
    .replace(/[^\d۰-۹٠-٩]/g, '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .slice(0, OTP_LEN);
}

export function OtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const nextRaw = sanitizeNext(
    searchParams.get('next') || (location.state as { next?: string } | null)?.next,
    '/home'
  );
  const next = nextRaw;
  const {
    pendingChannel,
    pendingTarget,
    pendingDevCode,
    verifyOtp,
    requestOtp,
    acceptSession,
  } = useAuthStore();
  const { toastError, toastSuccess } = useAppToast();
  const navDevCode = (location.state as { devCode?: string } | null)?.devCode;
  const initialDev = navDevCode || pendingDevCode || '';
  const [code, setCode] = useState(digitsOnly(initialDev));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [devHint, setDevHint] = useState(() =>
    initialDev ? `کد توسعه (فقط لوکال): ${initialDev}` : ''
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const codeRef = useRef(code);
  const telegramLoginUrl = telegramWebLoginDeepLink(next);
  const usePendingFlow = prefersSameBrowserTelegramLogin();
  const [tgWaiting, setTgWaiting] = useState<{ id: string; deepLink: string } | null>(null);
  const [tgBusy, setTgBusy] = useState(false);
  const [resendIn, setResendIn] = useState(60);
  const tgFinishingRef = useRef(false);

  useEffect(() => {
    setResendIn(60);
  }, [pendingChannel, pendingTarget]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    if (!pendingChannel || !pendingTarget) {
      navigate(`/auth/login?next=${encodeURIComponent(next)}`, { replace: true });
    }
  }, [pendingChannel, pendingTarget, navigate, next]);

  useEffect(() => {
    if (!tgWaiting) return;
    let cancelled = false;
    tgFinishingRef.current = false;
    const tick = async () => {
      if (cancelled || tgFinishingRef.current) return;
      try {
        const res = await pollTelegramPendingLogin(tgWaiting.id);
        if (cancelled || tgFinishingRef.current) return;
        if (res.status === 'pending') return;
        if (res.status === 'ready' && res.token && res.user) {
          tgFinishingRef.current = true;
          acceptSession(res.token, res.user);
          const roles = normalizeRoles(res.user.roles, res.user.role);
          const complete =
            res.user.onboarding === 'profile_complete' ||
            Boolean(
              res.user.name?.trim() &&
                res.user.age &&
                res.user.gender &&
                res.user.country &&
                res.user.city
            );
          navigate(
            postAuthPath({
              hasRole: roles.length > 0,
              isProfileComplete: complete,
              next: sanitizeNext(res.next ?? next, next),
              roleHome: dashboardPathForUser(res.user),
            }),
            { replace: true }
          );
          return;
        }
        setError(res.error || 'ورود از تلگرام ناموفق بود');
        setTgWaiting(null);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : '';
        if (/منقضی|استفاده|پیدا نشد/i.test(msg)) {
          setError(msg || 'درخواست ورود منقضی شد');
          setTgWaiting(null);
        }
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 1600);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tgWaiting, acceptSession, navigate, next]);

  async function onTelegramLogin(e: MouseEvent) {
    if (!usePendingFlow) return;
    e.preventDefault();
    setError('');
    setTgBusy(true);
    try {
      const res = await startTelegramPendingLogin(next);
      setTgWaiting({ id: res.id, deepLink: res.deepLink });
      window.open(res.deepLink, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'شروع ورود تلگرام ناموفق بود'; setError(msg); toastError(msg);
    } finally {
      setTgBusy(false);
    }
  }

  async function submitCode(raw: string) {
    const value = digitsOnly(raw);
    if (value.length < OTP_LEN || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError('');
    try {
      const user = await verifyOtp(value);
      const roles = normalizeRoles(user.roles, user.role);
      const complete =
        user.onboarding === 'profile_complete' ||
        Boolean(user.name?.trim() && user.age && user.gender && user.country && user.city);
      const homeForRole = dashboardPathForUser(user);
      const destination =
        nextRaw === '/home' || nextRaw === '/vet-consult' ? homeForRole : nextRaw;
      if (!roles.length) {
        navigate('/onboarding/role', { replace: true, state: { next: destination } });
      } else if (!complete) {
        navigate('/onboarding/profile', { replace: true, state: { next: destination } });
      } else if (
        primaryRole(user.roles, user.role) === 'pet_owner' &&
        user.onboarding !== 'profile_complete' &&
        userHasRole(user, 'pet_owner')
      ) {
        navigate('/onboarding/pet', { replace: true, state: { next: destination } });
      } else {
        navigate(destination, { replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تأیید کد ناموفق بود'; setError(msg); toastError(msg);
      submittingRef.current = false;
    } finally {
      setBusy(false);
    }
  }

  function applyOtpValue(raw: string, autoSubmit = true) {
    const nextCode = digitsOnly(raw);
    setCode(nextCode);
    if (autoSubmit && nextCode.length === OTP_LEN) {
      void submitCode(nextCode);
    }
  }

  /** Chrome Android Web OTP API only — do not call credentials.get on Safari. */
  useEffect(() => {
    if (pendingChannel !== 'phone') return;
    if (typeof window === 'undefined' || !('OTPCredential' in window)) return;

    const ac = new AbortController();
    const nav = navigator as Navigator & {
      credentials?: CredentialsContainer;
    };

    if (nav.credentials?.get) {
      const req: OtpCredentialRequestOptions = {
        otp: { transport: ['sms'] },
        signal: ac.signal,
      };
      void nav.credentials
        .get(req)
        .then((cred) => {
          const otp = cred as OtpCredentialLike | null;
          const filled = digitsOnly(otp?.code ?? '');
          if (filled.length >= OTP_LEN) {
            applyOtpValue(filled);
          }
        })
        .catch(() => {
          /* user dismissed / unsupported */
        });
    }

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listen once per phone challenge
  }, [pendingChannel, pendingTarget]);

  /**
   * iOS Safari sometimes fills autocomplete="one-time-code" without a reliable
   * React onChange. Poll the focused field lightly and also listen to input/change.
   */
  useEffect(() => {
    if (pendingChannel !== 'phone') return;
    const el = inputRef.current;
    if (!el) return;

    const syncFromDom = () => {
      const filled = digitsOnly(el.value);
      if (filled.length >= OTP_LEN && filled !== codeRef.current) {
        applyOtpValue(filled);
      } else if (filled && filled !== codeRef.current) {
        setCode(filled);
      }
    };

    el.addEventListener('input', syncFromDom);
    el.addEventListener('change', syncFromDom);
    el.addEventListener('keyup', syncFromDom);
    const timer = window.setInterval(() => {
      if (document.activeElement === el || digitsOnly(el.value).length === OTP_LEN) {
        syncFromDom();
      }
    }, 400);

    // Focus so the iOS keyboard suggestion bar can offer the SMS code.
    const focusTimer = window.setTimeout(() => {
      el.focus({ preventScroll: true });
    }, 50);

    return () => {
      el.removeEventListener('input', syncFromDom);
      el.removeEventListener('change', syncFromDom);
      el.removeEventListener('keyup', syncFromDom);
      window.clearInterval(timer);
      window.clearTimeout(focusTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChannel, pendingTarget]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await submitCode(code);
  }

  async function resend() {
    if (!pendingChannel || !pendingTarget || resendIn > 0) return;
    setBusy(true);
    setError('');
    submittingRef.current = false;
    try {
      const res = await requestOtp(pendingChannel, pendingTarget);
      const retryRaw = (res as unknown as { retryAfterSec?: number }).retryAfterSec;
      const retry = typeof retryRaw === 'number' ? Math.max(1, retryRaw) : 60;
      setResendIn(retry);
      if (res.devCode) {
        setDevHint(`کد توسعه (فقط لوکال): ${res.devCode}`);
        setCode(digitsOnly(res.devCode));
      }
      toastSuccess('کد دوباره ارسال شد');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ارسال مجدد ناموفق بود';
      const m = msg.match(/(\d+)\s*ثانیه/);
      if (m) setResendIn(Math.max(1, Number(m[1])));
      setError(msg); toastError(msg);
    } finally {
      setBusy(false);
      window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
    }
  }

  return (
    <AuthShell
      backTo={`/auth/login?next=${encodeURIComponent(next)}`}
      backLabel="تغییر شماره / ایمیل"
      bannerTitle="تأیید هویت"
      bannerLead="کد پیامک را وارد کن — روی موبایل معمولاً خودش پر می‌شود"
      bannerImage="/pepito/uploads/4.jpg"
    >
      <p className="pepito-auth-kicker">تأیید هویت</p>
      <h1>کد یکبارمصرف</h1>
      <p className="auth-lead">
        کد ۵ رقمی برای <strong>{pendingTarget}</strong> ارسال شد
        {pendingChannel === 'phone'
          ? ' — از پیشنهاد کیبورد (QuickType) کد را بزن یا صبر کن تا پر شود'
          : ' (ایمیل در لاگ سرور)'}
        .
      </p>
      <form className="auth-form" onSubmit={onSubmit} autoComplete="on">
        <label htmlFor="otp-code">
          کد تأیید
          {/*
            Single text field — required for iOS SMS Autofill.
            Do NOT use type=number/password or split boxes without a hidden
            one-time-code field (Safari will not offer the SMS code).
          */}
          <input
            ref={inputRef}
            id="otp-code"
            name="otp"
            type="text"
            value={code}
            onChange={(e) => applyOtpValue(e.target.value)}
            onInput={(e) => applyOtpValue((e.target as HTMLInputElement).value)}
            onPaste={(e) => {
              const pasted = e.clipboardData?.getData('text') ?? '';
              if (pasted) {
                e.preventDefault();
                applyOtpValue(pasted);
              }
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            pattern="[0-9]*"
            maxLength={OTP_LEN}
            minLength={OTP_LEN}
            placeholder="-----"
            required
            autoFocus
            enterKeyHint="done"
            aria-label="کد یکبارمصرف پیامک"
            dir="ltr"
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        {devHint && <p className="auth-dev">{devHint}</p>}
        <button
          type="submit"
          className="pepito-btn button-1 auth-submit"
          disabled={busy || code.trim().length < OTP_LEN}
        >
          {busy ? 'در حال بررسی…' : 'تأیید و ادامه'}
        </button>
      </form>
      <div className="auth-secondary-actions">
        <button
          type="button"
          className="auth-link-btn"
          onClick={() => void resend()}
          disabled={busy || resendIn > 0}
        >
          {resendIn > 0
            ? `ارسال دوباره تا ${resendIn.toLocaleString('fa-IR')} ثانیه`
            : 'ارسال دوباره کد'}
        </button>
        <Link to={`/auth/login?next=${encodeURIComponent(next)}`}>تغییر شماره / ایمیل</Link>
      </div>

      <div className="auth-or" role="separator">
        <span>یا</span>
      </div>
      {tgWaiting ? (
        <>
          <p className="auth-lead">
            در تلگرام <strong>تأیید ورود</strong> را بزن؛ همین صفحه خودکار ادامه می‌دهد.
          </p>
          <a
            className="pepito-btn button-2 auth-telegram-cta"
            href={tgWaiting.deepLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Send size={16} strokeWidth={2} aria-hidden />
            باز کردن دوباره تلگرام
          </a>
          <button type="button" className="auth-link-btn" onClick={() => setTgWaiting(null)}>
            انصراف
          </button>
        </>
      ) : (
        <a
          className="pepito-btn button-2 auth-telegram-cta"
          href={usePendingFlow ? '#' : telegramLoginUrl}
          target={usePendingFlow ? undefined : '_blank'}
          rel="noopener noreferrer"
          onClick={onTelegramLogin}
        >
          <Send size={16} strokeWidth={2} aria-hidden />
          {tgBusy ? 'در حال آماده‌سازی…' : 'ورود با اکانت تلگرام'}
        </a>
      )}
    </AuthShell>
  );
}
