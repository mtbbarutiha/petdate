/**
 * Public first-party analytics beacon + optional Microsoft Clarity + Google Tag Manager.
 * Clarity only loads when the project id is a valid Clarity id (NOT a UUID).
 *
 * GTM container GTM-KQPJT9Q4 is installed in packages/web/index.html (official head +
 * noscript) so Tag Assistant / crawlers see it in the initial HTML. This module:
 * - ensures dataLayer exists (HTML snippet already creates it)
 * - pushes SPA `{ event: 'page_view', page_path, page_title, page_location }`
 * - pushes `{ event: 'link_click', ... }` for outbound / telegram / download / CTA
 * - does NOT reinject gtm.js when the HTML snippet is present
 * - skips /admin for Clarity, dataLayer SPA extras, and first-party beacons
 *
 * Tags inside the GTM container are configured in Google’s UI — we do not invent GA4 IDs.
 */
const SESSION_KEY = 'pd_analytics_sid';

/** Live Microsoft Clarity project for petdate.ir (short id — not the rejected agent UUID). */
export const DEFAULT_CLARITY_PROJECT_ID = 'ygkl5nck6k';

/** Live Google Tag Manager container for petdate.ir. */
export const DEFAULT_GTM_ID = 'GTM-KQPJT9Q4';

/** Public Tag Manager workspace entry (account/container path unknown — open + search by ID). */
export const GTM_DASHBOARD_URL = 'https://tagmanager.google.com/';

/** Internal path prefixes treated as conversion / signup CTAs for link_click. */
export const GTM_CTA_PATH_PREFIXES = [
  '/login',
  '/otp',
  '/auth',
  '/onboarding',
  '/role-select',
  '/roles',
  '/wallet',
  '/shop/cart',
  '/shop/checkout',
  '/shop/pay',
  '/vet-consult',
  '/trainer-consult',
  '/sitter-consult',
  '/invite',
] as const;

export type GtmLinkKind = 'outbound' | 'cta' | 'download' | 'telegram' | 'contact';

export type GtmPageViewPayload = {
  event: 'page_view';
  page_path: string;
  page_title: string;
  page_location: string;
};

export type GtmLinkClickPayload = {
  event: 'link_click';
  link_url: string;
  link_text: string;
  link_domain: string;
  link_kind: GtmLinkKind;
  outbound: boolean;
};

type DataLayerWindow = Window & { dataLayer?: unknown[] };

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

/** Ensure `window.dataLayer` exists before any GTM push / script insert. */
export function ensureDataLayer(): unknown[] {
  if (typeof window === 'undefined') return [];
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer || [];
  return w.dataLayer;
}

/** Push a dataLayer object (no-op off-window). */
export function pushDataLayer(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    ensureDataLayer().push(payload);
  } catch {
    /* ignore */
  }
}

export function buildGtmPageViewPayload(input: {
  path: string;
  title?: string | null;
  locationHref?: string | null;
}): GtmPageViewPayload {
  const path = (input.path.split('?')[0] || '/').trim() || '/';
  return {
    event: 'page_view',
    page_path: path.startsWith('/') ? path : `/${path}`,
    page_title: (input.title || '').trim() || path,
    page_location: (input.locationHref || '').trim() || path,
  };
}

export function isPetdateHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === 'petdate.ir' || h.endsWith('.petdate.ir') || h === 'localhost' || h === '127.0.0.1';
}

export function isCtaPath(pathname: string): boolean {
  const p = (pathname.split('?')[0] || '/').toLowerCase();
  return GTM_CTA_PATH_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

function looksLikeDownloadUrl(pathname: string, downloadAttr: boolean): boolean {
  if (downloadAttr) return true;
  return /\.(pdf|zip|rar|7z|csv|xlsx?|docx?|pptx?|apk|dmg|exe)(\?|#|$)/i.test(pathname);
}

/**
 * Classify a clicked href for GTM link_click (null = do not track).
 * Pure helper — safe for selftests.
 */
export function classifyTrackedLink(
  href: string,
  opts: {
    currentOrigin: string;
    downloadAttr?: boolean;
    explicitCta?: boolean;
  },
): { kind: GtmLinkKind; url: string; domain: string; outbound: boolean } | null {
  const raw = href.trim();
  if (!raw || raw === '#' || raw.startsWith('javascript:')) return null;

  const lower = raw.toLowerCase();
  if (lower.startsWith('mailto:') || lower.startsWith('tel:') || lower.startsWith('sms:')) {
    return {
      kind: 'contact',
      url: raw,
      domain: lower.startsWith('mailto:') ? 'mailto' : lower.startsWith('tel:') ? 'tel' : 'sms',
      outbound: true,
    };
  }

  let url: URL;
  try {
    url = new URL(raw, opts.currentOrigin);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname.toLowerCase();
  const outbound = !isPetdateHost(host) && url.origin !== opts.currentOrigin;
  const telegram = /(^|\.)t\.me$/i.test(host) || /(^|\.)telegram\.(me|org)$/i.test(host);

  if (looksLikeDownloadUrl(url.pathname, Boolean(opts.downloadAttr))) {
    return { kind: 'download', url: url.href, domain: host, outbound };
  }
  if (telegram) {
    return { kind: 'telegram', url: url.href, domain: host, outbound: true };
  }
  if (outbound) {
    return { kind: 'outbound', url: url.href, domain: host, outbound: true };
  }
  if (opts.explicitCta || isCtaPath(url.pathname)) {
    return { kind: 'cta', url: url.href, domain: host || 'petdate.ir', outbound: false };
  }
  return null;
}

export function buildGtmLinkClickPayload(input: {
  kind: GtmLinkKind;
  url: string;
  domain: string;
  outbound: boolean;
  text?: string | null;
}): GtmLinkClickPayload {
  return {
    event: 'link_click',
    link_url: input.url,
    link_text: (input.text || '').trim().slice(0, 120),
    link_domain: input.domain,
    link_kind: input.kind,
    outbound: input.outbound,
  };
}

let clarityBooted = false;
let gtmBooted = false;
let linkTrackingBooted = false;
let lastGtmPagePath: string | null = null;

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

function pushGtmVirtualPageview(pathname: string): void {
  if (typeof window === 'undefined' || !resolveGtmId()) return;
  const path = pathname.split('?')[0] || '/';
  const search = pathname.includes('?')
    ? pathname.slice(pathname.indexOf('?'))
    : typeof window !== 'undefined'
      ? window.location.search
      : '';
  // Dedupe identical consecutive SPA pushes (StrictMode double-effect / remounts).
  const dedupeKey = `${path}${search}`;
  if (lastGtmPagePath === dedupeKey) return;
  lastGtmPagePath = dedupeKey;
  pushDataLayer(
    buildGtmPageViewPayload({
      path,
      title: typeof document !== 'undefined' ? document.title : path,
      locationHref: window.location.href,
    }),
  );
}

function closestAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!target || typeof (target as Element).closest !== 'function') return null;
  return (target as Element).closest('a[href]') as HTMLAnchorElement | null;
}

function onDocumentLinkClick(ev: MouseEvent): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/admin')) return;
  // Ignore modified clicks (new tab / download gestures) that users intentionally open elsewhere —
  // still track them; UX is unchanged either way.
  const a = closestAnchor(ev.target);
  if (!a) return;
  const href = a.getAttribute('href') || '';
  const classified = classifyTrackedLink(href, {
    currentOrigin: window.location.origin,
    downloadAttr: a.hasAttribute('download'),
    explicitCta:
      a.hasAttribute('data-gtm-cta') ||
      a.getAttribute('data-analytics') === 'cta' ||
      a.classList.contains('cta-btn'),
  });
  if (!classified) return;
  const text = (a.innerText || a.getAttribute('aria-label') || a.title || '').replace(/\s+/g, ' ');
  pushDataLayer(
    buildGtmLinkClickPayload({
      kind: classified.kind,
      url: classified.url,
      domain: classified.domain,
      outbound: classified.outbound,
      text,
    }),
  );
}

function maybeInitLinkTracking(): void {
  if (linkTrackingBooted || typeof document === 'undefined') return;
  if (!resolveGtmId()) return;
  linkTrackingBooted = true;
  try {
    document.addEventListener('click', onDocumentLinkClick, true);
  } catch {
    /* ignore */
  }
}

function gtmScriptAlreadyPresent(containerId: string): boolean {
  if (typeof document === 'undefined') return false;
  if (document.getElementById('petdate-gtm')) return true;
  if (document.getElementById('petdate-gtm-html')) return true;
  const scripts = document.querySelectorAll('script[src*="googletagmanager.com/gtm.js"]');
  for (const el of scripts) {
    const src = el.getAttribute('src') || '';
    if (src.includes(`id=${containerId}`) || src.includes('id=GTM-')) return true;
  }
  return false;
}

/**
 * Ensure dataLayer + (fallback) GTM script. Production prefers the index.html
 * snippet for Tag Assistant; this path only injects if HTML snippet is absent.
 * SPA page_view / link_click run regardless. Skipped on /admin via trackPageview.
 */
function maybeInitGtm(): void {
  if (gtmBooted || typeof window === 'undefined' || typeof document === 'undefined') return;
  const containerId = resolveGtmId();
  if (!containerId) return;
  gtmBooted = true;
  try {
    // Always create dataLayer before any further pushes (HTML snippet usually did this).
    ensureDataLayer();

    if (!gtmScriptAlreadyPresent(containerId)) {
      pushDataLayer({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}`;
      s.id = 'petdate-gtm';
      const first = document.getElementsByTagName('script')[0];
      first?.parentNode?.insertBefore(s, first);

      if (!document.getElementById('petdate-gtm-noscript') && !document.getElementById('petdate-gtm-noscript-html')) {
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
    }
    maybeInitLinkTracking();
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
  pushGtmVirtualPageview(path);

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
