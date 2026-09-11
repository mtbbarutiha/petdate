/**
 * Public first-party analytics beacon + optional Microsoft Clarity + Google Tag Manager.
 * Clarity only loads when the project id is a valid Clarity id (NOT a UUID).
 * GTM loads when container id matches GTM-XXXX (override with VITE_GTM_ID).
 * Both skip /admin paths. Production defaults: live Clarity + GTM-KQPJT9Q4.
 */
const SESSION_KEY = 'pd_analytics_sid';

/** Live Microsoft Clarity project for petdate.ir (short id — not the rejected agent UUID). */
export const DEFAULT_CLARITY_PROJECT_ID = 'ygkl5nck6k';

/** Live Google Tag Manager container for petdate.ir. */
export const DEFAULT_GTM_ID = 'GTM-KQPJT9Q4';

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

export function isValidGtmContainerId(id: string | undefined | null): boolean {
  if (!id) return false;
  return /^GTM-[A-Z0-9]{4,12}$/i.test(id.trim());
}

function resolveGtmId(): string | null {
  const fromEnv = (import.meta.env.VITE_GTM_ID as string | undefined)?.trim() || '';
  if (fromEnv && !isValidGtmContainerId(fromEnv)) return null;
  const id = fromEnv || DEFAULT_GTM_ID;
  return isValidGtmContainerId(id) ? id.toUpperCase() : null;
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
let gtmBooted = false;

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

/**
 * Inject standard GTM head script + noscript iframe (SPA-safe).
 * Only once per session; skipped on /admin via trackPageview.
 */
function maybeInitGtm(): void {
  if (gtmBooted || typeof window === 'undefined' || typeof document === 'undefined') return;
  const containerId = resolveGtmId();
  if (!containerId) return;
  if (document.getElementById('petdate-gtm')) {
    gtmBooted = true;
    return;
  }
  gtmBooted = true;
  try {
    const w = window as Window & { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}`;
    s.id = 'petdate-gtm';
    const first = document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(s, first);

    if (!document.getElementById('petdate-gtm-noscript')) {
      const noscript = document.createElement('noscript');
      noscript.id = 'petdate-gtm-noscript';
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.googletagmanager.com/ns.html?id=${containerId}`;
      iframe.height = '0';
      iframe.width = '0';
      iframe.style.display = 'none';
      iframe.style.visibility = 'hidden';
      iframe.title = 'Google Tag Manager';
      noscript.appendChild(iframe);
      const body = document.body;
      if (body?.firstChild) {
        body.insertBefore(noscript, body.firstChild);
      } else if (body) {
        body.appendChild(noscript);
      }
    }
  } catch {
    /* ignore */
  }
}

export function trackPageview(pathname?: string): void {
  if (typeof window === 'undefined') return;
  const path = pathname ?? window.location.pathname;
  if (path.startsWith('/admin')) return;

  maybeInitClarity();
  maybeInitGtm();

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
