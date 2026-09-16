import { MouseEvent } from 'react';
import { googleOAuthStartPath } from '../lib/api';

export function GoogleMark() {
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

function isNativeCapacitorShell(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  try {
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

/** Full-page OAuth start — avoids SPA/SW trapping and WebView user-agent blocks. */
export function startGoogleOAuth(next?: string | null): void {
  const href = googleOAuthStartPath(next);
  if (typeof window === 'undefined') return;
  if (isNativeCapacitorShell()) {
    // Google blocks OAuth inside many embedded WebViews — open the system browser.
    const opened = window.open(href, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.assign(href);
    return;
  }
  window.location.assign(href);
}

/** First-class Gmail/Google OAuth CTA — same session model as Telegram / mobile OTP. */
export function GoogleLoginButton({
  next,
  className,
}: {
  next?: string | null;
  className?: string;
}) {
  const href = googleOAuthStartPath(next);

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    // Keep href for accessibility / open-in-new-tab, but force top-level navigation
    // so React Router / analytics never treat /api/auth/google as an in-app route.
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    startGoogleOAuth(next);
  }

  return (
    <a
      className={`auth-google-cta auth-login-method auth-login-method--google${
        className ? ` ${className}` : ''
      }`}
      href={href}
      rel="noopener noreferrer"
      data-gtm-id="auth-google-login"
      onClick={onClick}
    >
      <GoogleMark />
      ورود با گوگل
    </a>
  );
}
