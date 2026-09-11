/**
 * Public first-party analytics beacon + optional Microsoft Clarity.
 * Clarity only loads when the project id is a valid Clarity id (NOT a UUID).
 * Override with VITE_CLARITY_PROJECT_ID; production default is the live petdate.ir project.
 */
const SESSION_KEY = 'pd_analytics_sid';

/** Live Microsoft Clarity project for petdate.ir (short id — not the rejected agent UUID). */
export const DEFAULT_CLARITY_PROJECT_ID = 'ygkl5nck6k';

function apiBase(): string {
  return (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
}

function isValidClarityProjectId(id: string | undefined | null): boolean {
  if (!id) return false;
  const t = id.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) {
    return false;
  }
  return /^[a-zA-Z0-9_-]{4,64}$/.test(t);
}

function resolveClarityProjectId(): string | null {
  const fromEnv = (import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined)?.trim() || '';
  // Explicit invalid override (e.g. leftover UUID) — do not silently fall back.
  if (fromEnv && !isValidClarityProjectId(fromEnv)) return null;
  const id = fromEnv || DEFAULT_CLARITY_PROJECT_ID;
  return isValidClarityProjectId(id) ? id : null;
}

function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `s-${Date.now().toString(36)}`;
  }
}

function readUtm(): { utmSource: string | null; utmMedium: string | null; utmCampaign: string | null } {
  try {
    const q = new URLSearchParams(window.location.search);
    return {
      utmSource: q.get('utm_source'),
      utmMedium: q.get('utm_medium'),
      utmCampaign: q.get('utm_campaign'),
    };
  } catch {
    return { utmSource: null, utmMedium: null, utmCampaign: null };
  }
}

let clarityBooted = false;

function maybeInitClarity(): void {
  if (clarityBooted || typeof window === 'undefined' || typeof document === 'undefined') return;
  const projectId = resolveClarityProjectId();
  if (!projectId) return;
  clarityBooted = true;
  try {
    const w = window as Window & { clarity?: ((...args: unknown[]) => void) & { q?: unknown[] } };
    w.clarity =
      w.clarity ||
      function (...args: unknown[]) {
        (w.clarity as { q?: unknown[] }).q = (w.clarity as { q?: unknown[] }).q || [];
        (w.clarity as { q: unknown[] }).q.push(args);
      };
    const s = document.createElement('script');
    s.type = 'text/javascript';
    s.async = true;
    s.src = `https://www.clarity.ms/tag/${projectId}`;
    s.id = 'petdate-clarity';
    const first = document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(s, first);
  } catch {
    /* ignore */
  }
}

export function trackPageview(pathname?: string): void {
  if (typeof window === 'undefined') return;
  const path = pathname ?? window.location.pathname;
  if (path.startsWith('/admin')) return;

  maybeInitClarity();

  const utm = readUtm();
  const payload = {
    sessionId: getSessionId(),
    path: path.split('?')[0] || '/',
    title: typeof document !== 'undefined' ? document.title : null,
    referrer: typeof document !== 'undefined' ? document.referrer || null : null,
    ...utm,
    language: typeof navigator !== 'undefined' ? navigator.language : null,
    screenW: window.innerWidth,
    screenH: window.innerHeight,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    eventType: 'pageview' as const,
  };

  const url = `${apiBase()}/api/analytics/collect`;
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    /* fall through */
  }
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    credentials: 'omit',
  }).catch(() => undefined);
}
