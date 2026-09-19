import { FormEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Send, Smartphone } from 'lucide-react';
import { dashboardPathForUser, formatIranMobileDisplay, isProfileComplete, normalizeIranMobile } from '@petdate/shared';
import { AuthShell } from '../../components/AuthShell';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useAppToast } from '../../hooks/useAppToast';
import { postAuthPath, sanitizeNext } from '../../lib/authRedirect';

const OTP_LEN = 5;

function digitsOnly(raw: string): string {
  return String(raw ?? '')
    .replace(/[^\d۰-۹٠-٩]/g, '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .slice(0, OTP_LEN);
}

function readRetryAfterSec(err: unknown, fallback = 60): number {
  if (err && typeof err === 'object' && 'retryAfterSec' in err) {
    const n = Number((err as { retryAfterSec?: unknown }).retryAfterSec);
    if (Number.isFinite(n) && n > 0) return Math.max(1, Math.ceil(n));
  }
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const m = msg.match(/(\d+)\s*ثانیه/);
  if (m) return Math.max(1, Number(m[1]));
  return Math.max(1, fallback);
}

/**
 * Mandatory phone SMS verify after Telegram / Google (email) web login.
 * Phone OTP login already sets phoneVerified and skips this page.
 */
export function PhoneVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const next = sanitizeNext(
    searchParams.get('next') || (location.state as { from?: string } | null)?.from,
    '/home'
  );
  const {
    isLoggedIn,
    isPhoneVerified,
    hasRole,
    isProfileComplete,
    user,
    sendPhoneAttachOtp,
    verifyPhoneAttachOtp,
    logout,
  } = useAuthStore();
  const { toastError, toastSuccess } = useAppToast();

  const [phone, setPhone] = useState('');
  const [pendingPhone, setPendingPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate(`/auth/login?next=${encodeURIComponent(next)}`, { replace: true });
      return;
    }
    if (isPhoneVerified) {
      navigate(
        postAuthPath({
          hasRole,
          isProfileComplete,
          phoneVerified: true,
          next,
          roleHome: dashboardPathForUser(user),
        }),
        { replace: true }
      );
    }
  }, [
    isLoggedIn,
    isPhoneVerified,
    hasRole,
    isProfileComplete,
    navigate,
    next,
    user,
  ]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (step !== 'otp') return;
    const el = inputRef.current;
    if (!el) return;
    const focusTimer = window.setTimeout(() => el.focus({ preventScroll: true }), 50);
    return () => window.clearTimeout(focusTimer);
  }, [step]);

  async function onSendPhone(e?: FormEvent) {
    e?.preventDefault();
    const normalized = normalizeIranMobile(phone);
    if (!normalized) {
      setError('شماره موبایل ایران معتبر وارد کن (مثلاً ۰۹۱۲…).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await sendPhoneAttachOtp(normalized);
      setPendingPhone(res.phone);
      setStep('otp');
      setCode('');
      setResendIn(60);
      toastSuccess('کد تأیید پیامک شد');
    } catch (err) {
      const retry = readRetryAfterSec(err);
      if ((err as { status?: number })?.status === 429 || /صبر|ثانیه/.test(String((err as Error)?.message))) {
        setResendIn(retry);
      }
      const msg = err instanceof Error ? err.message : 'ارسال پیامک ناموفق بود';
      setError(msg);
      toastError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e?: FormEvent) {
    e?.preventDefault();
    const otp = digitsOnly(code);
    if (otp.length < OTP_LEN) {
      setError('کد ۵ رقمی را وارد کن');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const verifiedUser = await verifyPhoneAttachOtp(pendingPhone, otp);
      toastSuccess('موبایل تأیید شد');
      navigate(
        postAuthPath({
          hasRole: Boolean(verifiedUser.roles?.length || verifiedUser.role),
          isProfileComplete: isProfileComplete(verifiedUser),
          phoneVerified: true,
          next,
          roleHome: dashboardPathForUser(verifiedUser),
        }),
        { replace: true }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تأیید ناموفق بود';
      setError(msg);
      toastError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      bannerTitle="احراز موبایل"
      bannerLead="بعد از ورود با تلگرام یا گوگل، تأیید شماره موبایل اجباری است."
    >
      <div className="auth-login-premium">
        <h1 className="auth-title">شماره موبایلت را تأیید کن</h1>
        <p className="auth-lead muted">
          بدون پیامک تأیید نمی‌توانی از پنل و امکانات حساب استفاده کنی.
        </p>

        {step === 'phone' ? (
          <form className="auth-form" onSubmit={(e) => void onSendPhone(e)}>
            <label className="auth-label" htmlFor="auth-phone-attach">
              شماره موبایل
            </label>
            <div className="auth-login-phone-row">
              <Smartphone size={18} aria-hidden />
              <input
                id="auth-phone-attach"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0912…"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={busy}
              />
            </div>
            {error ? <p className="auth-error">{error}</p> : null}
            <button type="submit" className="pepito-btn button-1" disabled={busy || resendIn > 0}>
              <Send size={16} />
              {resendIn > 0
                ? `ارسال مجدد تا ${resendIn.toLocaleString('fa-IR')}ث`
                : busy
                  ? 'در حال ارسال…'
                  : 'ارسال کد تأیید'}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={(e) => void onVerify(e)}>
            <p className="muted" style={{ marginBottom: 12 }}>
              کد پیامک‌شده به{' '}
              <bdi dir="ltr">{formatIranMobileDisplay(pendingPhone)}</bdi> را وارد کن.
            </p>
            <label className="auth-label" htmlFor="auth-phone-otp">
              کد تأیید
            </label>
            <input
              ref={inputRef}
              id="auth-phone-otp"
              className="auth-otp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LEN}
              value={code}
              onChange={(e) => setCode(digitsOnly(e.target.value))}
              disabled={busy}
            />
            {error ? <p className="auth-error">{error}</p> : null}
            <button type="submit" className="pepito-btn button-1" disabled={busy || code.length < OTP_LEN}>
              {busy ? 'در حال تأیید…' : 'تأیید و ادامه'}
            </button>
            <button
              type="button"
              className="pepito-btn button-2"
              disabled={busy || resendIn > 0}
              onClick={() => void onSendPhone()}
            >
              {resendIn > 0
                ? `ارسال مجدد (${resendIn.toLocaleString('fa-IR')}ث)`
                : 'ارسال مجدد کد'}
            </button>
            <button
              type="button"
              className="pepito-btn button-2"
              disabled={busy}
              onClick={() => {
                setStep('phone');
                setCode('');
                setError('');
              }}
            >
              تغییر شماره
            </button>
          </form>
        )}

        <button
          type="button"
          className="auth-link-btn"
          style={{ marginTop: 16 }}
          onClick={() => {
            void logout();
            navigate('/auth/login', { replace: true });
          }}
        >
          خروج و ورود با روش دیگر
        </button>
      </div>
    </AuthShell>
  );
}
