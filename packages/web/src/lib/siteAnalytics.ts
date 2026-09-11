/**
 * Public first-party analytics beacon + optional Microsoft Clarity + Google Tag Manager.
 * Clarity only loads when the project id is a valid Clarity id (NOT a UUID).
 *
 * GTM container GTM-KQPJT9Q4 is installed in packages/web/index.html (official head +
 * noscript) so Tag Assistant / crawlers see it in the initial HTML. This module:
 * - ensures dataLayer exists (HTML snippet already creates it)
 * - pushDataLayer(event, payload) — shared helper for all SPA pushes
 * - page_view on every client route (+ variables: page_*, user_*)
 * - link_click / outbound_click / file_download for tracked anchors
 * - auth / lead / ecommerce helpers for public flows
 * - mirrors Custom Events to first-party /api/analytics/collect for admin reports
 * - skips /admin for Clarity, dataLayer SPA extras, and first-party beacons
 *
 * Tags inside the GTM container are configured in Google’s UI — we do not invent GA4 IDs.
 */
import { CLARITY_PROJECT_ID, GTM_CONTAINER_ID } from '@petdate/shared';

/** Live Microsoft Clarity project for petdate.ir (short id — not the rejected agent UUID). */
export const DEFAULT_CLARITY_PROJECT_ID = CLARITY_PROJECT_ID;
/** Live Google Tag Manager container for petdate.ir. */
export const DEFAULT_GTM_ID = GTM_CONTAINER_ID;

/** Public Tag Manager workspace entry (account/container path unknown — open + search by ID). */
export const GTM_DASHBOARD_URL = 'https://tagmanager.google.com/';
export const TAG_ASSISTANT_URL = 'https://tagassistant.google.com/';

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
  '/invite',
] as const;

export type GtmLinkKind = 'outbound' | 'cta' | 'download' | 'telegram' | 'contact';

export type GtmPageViewPayload = {
  event: 'page_view';
  page_path: string;
  page_title: string;
  page_location: string;
  page_type: string;
  user_id: string | null;
  user_status: 'guest' | 'logged_in';
};

export type GtmLinkClickPayload = {
  event: 'link_click';
  link_url: string;
  link_text: string;
  link_domain: string;
  link_kind: GtmLinkKind;
  outbound: boolean;
  click_text: string;
  click_url: string;
  click_id: string | null;
};

type DataLayerWindow = Window & { dataLayer?: unknown[] };

const SESSION_KEY = 'pd_analytics_sid';
const UTM_STORAGE_KEY = 'pd_analytics_utm_v1';
const AUTH_STORAGE_KEY = 'petdate_web_auth_v1';

export type UtmAttribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  gclid: string | null;
  fbclid: string | null;
};

function emptyUtm(): UtmAttribution {
  return {
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    gclid: null,
    fbclid: null,
  };
}

/** Parse utm_* + click ids from a query string (first-touch persistence). */
export function parseUtmFromSearch(search: string): UtmAttribution {
  try {
    const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    return {
      utmSource: q.get('utm_source'),
      utmMedium: q.get('utm_medium'),
      utmCampaign: q.get('utm_campaign'),
      utmContent: q.get('utm_content'),
      utmTerm: q.get('utm_term'),
      gclid: q.get('gclid'),
      fbclid: q.get('fbclid'),
    };
  } catch {
    return emptyUtm();
  }
}

function utmHasValue(u: UtmAttribution): boolean {
  return Boolean(
    u.utmSource || u.utmMedium || u.utmCampaign || u.utmContent || u.utmTerm || u.gclid || u.fbclid,
  );
}

function readStoredUtm(): UtmAttribution {
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return emptyUtm();
    const parsed = JSON.parse(raw) as Partial<UtmAttribution>;
    return {
      utmSource: typeof parsed.utmSource === 'string' ? parsed.utmSource : null,
      utmMedium: typeof parsed.utmMedium === 'string' ? parsed.utmMedium : null,
      utmCampaign: typeof parsed.utmCampaign === 'string' ? parsed.utmCampaign : null,
      utmContent: typeof parsed.utmContent === 'string' ? parsed.utmContent : null,
      utmTerm: typeof parsed.utmTerm === 'string' ? parsed.utmTerm : null,
      gclid: typeof parsed.gclid === 'string' ? parsed.gclid : null,
      fbclid: typeof parsed.fbclid === 'string' ? parsed.fbclid : null,
    };
  } catch {
    return emptyUtm();
  }
}

function writeStoredUtm(u: UtmAttribution): void {
  try {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(u));
  } catch {
    /* ignore */
  }
  try {
    // 90-day first-party cookie backup (SameSite=Lax) for attribution across tabs.
    const maxAge = 90 * 24 * 60 * 60;
    document.cookie = `${UTM_STORAGE_KEY}=${encodeURIComponent(JSON.stringify(u))};path=/;max-age=${maxAge};SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

function readCookieUtm(): UtmAttribution {
  try {
    const parts = document.cookie.split(';');
    for (const part of parts) {
      const [k, ...rest] = part.trim().split('=');
      if (k !== UTM_STORAGE_KEY) continue;
      const parsed = JSON.parse(decodeURIComponent(rest.join('='))) as Partial<UtmAttribution>;
      return {
        utmSource: typeof parsed.utmSource === 'string' ? parsed.utmSource : null,
        utmMedium: typeof parsed.utmMedium === 'string' ? parsed.utmMedium : null,
        utmCampaign: typeof parsed.utmCampaign === 'string' ? parsed.utmCampaign : null,
        utmContent: typeof parsed.utmContent === 'string' ? parsed.utmContent : null,
        utmTerm: typeof parsed.utmTerm === 'string' ? parsed.utmTerm : null,
        gclid: typeof parsed.gclid === 'string' ? parsed.gclid : null,
        fbclid: typeof parsed.fbclid === 'string' ? parsed.fbclid : null,
      };
    }
  } catch {
    /* ignore */
  }
  return emptyUtm();
}

/**
 * First-touch UTM: capture from URL on landing, persist for the session (and cookie),
 * return attribution for every collect / dataLayer push.
 */
export function captureAndReadUtm(search?: string): UtmAttribution {
  if (typeof window === 'undefined') return emptyUtm();
  const fromUrl = parseUtmFromSearch(
    search ?? (typeof window !== 'undefined' ? window.location.search : ''),
  );
  if (utmHasValue(fromUrl)) {
    writeStoredUtm(fromUrl);
    return fromUrl;
  }
  const stored = readStoredUtm();
  if (utmHasValue(stored)) return stored;
  const cookie = readCookieUtm();
  if (utmHasValue(cookie)) {
    writeStoredUtm(cookie);
    return cookie;
  }
  return emptyUtm();
}

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

/** Optional GA4 Measurement ID — never invent one. Env first, then runtime (DB settings via /api/analytics/config). */
let runtimeGa4MeasurementId: string | null = null;
let runtimeConfigFetched = false;
let ga4Booted = false;
let heartbeatBooted = false;

export function isValidGa4MeasurementId(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^G-[A-Z0-9]{6,20}$/i.test(id.trim());
}

export function setRuntimeGa4MeasurementId(id: string | null | undefined): void {
  if (!id || !isValidGa4MeasurementId(id)) {
    runtimeGa4MeasurementId = null;
    return;
  }
  runtimeGa4MeasurementId = id.trim().toUpperCase();
}

export function resolveGa4MeasurementId(): string | null {
  const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : ({} as ImportMetaEnv);
  const raw =
    (env.VITE_GA4_MEASUREMENT_ID as string | undefined)?.trim() ||
    (env.VITE_GOOGLE_ANALYTICS_ID as string | undefined)?.trim() ||
    (env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim() ||
    '';
  if (raw) {
    return isValidGa4MeasurementId(raw) ? raw.toUpperCase() : null;
  }
  return runtimeGa4MeasurementId;
}

type GtagFn = ((...args: unknown[]) => void) & { q?: unknown[] };

function maybeInitGa4(): void {
  if (ga4Booted || typeof window === 'undefined' || typeof document === 'undefined') return;
  const mid = resolveGa4MeasurementId();
  if (!mid) return;
  ga4Booted = true;
  try {
    const w = window as Window & { dataLayer?: unknown[]; gtag?: GtagFn };
    w.dataLayer = w.dataLayer || [];
    const gtag: GtagFn =
      w.gtag ||
      function (...args: unknown[]) {
        w.dataLayer!.push(args);
      };
    w.gtag = gtag;
    if (!document.getElementById('petdate-ga4-gtag')) {
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${mid}`;
      s.id = 'petdate-ga4-gtag';
      const first = document.getElementsByTagName('script')[0];
      first?.parentNode?.insertBefore(s, first);
    }
    gtag('js', new Date());
    gtag('config', mid, { send_page_view: false, anonymize_ip: true });
    pushDataLayer({ ga4_measurement_id: mid });
  } catch {
    /* ignore */
  }
}

function sendGtagPageView(path: string): void {
  if (typeof window === 'undefined') return;
  const mid = resolveGa4MeasurementId();
  const gtag = (window as Window & { gtag?: GtagFn }).gtag;
  if (!mid || !gtag) return;
  try {
    gtag('event', 'page_view', {
      page_path: path.split('?')[0] || '/',
      page_title: typeof document !== 'undefined' ? document.title : path,
      page_location: window.location.href,
      send_to: mid,
    });
  } catch {
    /* ignore */
  }
}

async function ensureRuntimeAnalyticsConfig(): Promise<void> {
  if (runtimeConfigFetched || typeof window === 'undefined') return;
  if (resolveGa4MeasurementId()) {
    runtimeConfigFetched = true;
    return;
  }
  runtimeConfigFetched = true;
  try {
    const res = await fetch(`${apiBase()}/api/analytics/config`, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { ga4MeasurementId?: string | null };
    setRuntimeGa4MeasurementId(data.ga4MeasurementId || null);
    maybeInitGa4();
  } catch {
    /* ignore */
  }
}

function maybeInitHeartbeat(): void {
  if (heartbeatBooted || typeof window === 'undefined') return;
  heartbeatBooted = true;
  try {
    window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const path = window.location.pathname;
      if (path.startsWith('/admin')) return;
      beaconCollect({
        eventType: 'heartbeat',
        eventName: 'user_engagement',
        path: path.split('?')[0] || '/',
      });
    }, 30_000);
  } catch {
    /* ignore */
  }
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

/** Ensure `window.dataLayer` exists before any GTM push / script insert. */
export function ensureDataLayer(): unknown[] {
  if (typeof window === 'undefined') return [];
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer || [];
  return w.dataLayer;
}

/**
 * Shared helper — push to dataLayer.
 * Usage: pushDataLayer('login', { method: 'otp' }) or pushDataLayer({ event: 'login', ... }).
 */
export function pushDataLayer(eventOrPayload: string | Record<string, unknown>, payload?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, unknown> =
      typeof eventOrPayload === 'string'
        ? { event: eventOrPayload, ...(payload || {}) }
        : eventOrPayload;
    ensureDataLayer().push(obj);
  } catch {
    /* ignore */
  }
}

export type PublicUserContext = {
  user_id: string | null;
  user_status: 'guest' | 'logged_in';
};

/** Read public auth snapshot — internal numeric id only (no tokens / PII). */
export function readPublicUserContext(): PublicUserContext {
  if (typeof window === 'undefined') return { user_id: null, user_status: 'guest' };
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { user_id: null, user_status: 'guest' };
    const parsed = JSON.parse(raw) as { token?: string; user?: { id?: number } };
    if (parsed?.token && typeof parsed.user?.id === 'number' && Number.isFinite(parsed.user.id)) {
      return { user_id: `u_${parsed.user.id}`, user_status: 'logged_in' };
    }
  } catch {
    /* ignore */
  }
  return { user_id: null, user_status: 'guest' };
}

export function inferPageType(pathname: string): string {
  const p = (pathname.split('?')[0] || '/').toLowerCase() || '/';
  if (p === '/' || p === '') return 'home';
  if (p.startsWith('/admin')) return 'admin';
  if (p.startsWith('/auth') || p.startsWith('/login') || p.startsWith('/otp')) return 'auth';
  if (p.startsWith('/onboarding') || p.startsWith('/role')) return 'onboarding';
  if (
    p.startsWith('/shop/cart') ||
    p.startsWith('/shop/checkout') ||
    p.startsWith('/shop/card-pay') ||
    p.startsWith('/shop/stars-pay')
  ) {
    return 'checkout';
  }
  if (p.startsWith('/shop/product/')) return 'product';
  if (p.startsWith('/shop')) return 'shop';
  if (p.startsWith('/wallet')) return 'wallet';
  if (p.startsWith('/vet') || p.startsWith('/consult')) return 'consult';
  if (p.startsWith('/chat') || p.startsWith('/inbox')) return 'chat';
  if (p.startsWith('/pets') || p.startsWith('/pet')) return 'pets';
  if (p.startsWith('/faq') || p.startsWith('/about')) return 'content';
  if (p.startsWith('/home')) return 'app_home';
  return 'other';
}

export function buildGtmPageViewPayload(input: {
  path: string;
  title?: string | null;
  locationHref?: string | null;
  user?: PublicUserContext | null;
  utm?: UtmAttribution | null;
}): GtmPageViewPayload & Record<string, unknown> {
  const path = (input.path.split('?')[0] || '/').trim() || '/';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const user = input.user || { user_id: null, user_status: 'guest' as const };
  const utm = input.utm || emptyUtm();
  return {
    event: 'page_view',
    page_path: normalized,
    page_title: (input.title || '').trim() || path,
    page_location: (input.locationHref || '').trim() || path,
    page_type: inferPageType(normalized),
    user_id: user.user_id,
    user_status: user.user_status,
    utm_source: utm.utmSource,
    utm_medium: utm.utmMedium,
    utm_campaign: utm.utmCampaign,
    utm_content: utm.utmContent,
    utm_term: utm.utmTerm,
    gclid: utm.gclid,
    fbclid: utm.fbclid,
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
  clickId?: string | null;
}): GtmLinkClickPayload {
  const text = (input.text || '').trim().slice(0, 120);
  return {
    event: 'link_click',
    link_url: input.url,
    link_text: text,
    link_domain: input.domain,
    link_kind: input.kind,
    outbound: input.outbound,
    click_text: text,
    click_url: input.url,
    click_id: input.clickId?.trim() || null,
  };
}

type EcommerceItem = {
  item_id: string;
  item_name: string;
  price?: number;
  quantity?: number;
  item_category?: string;
};

function beaconCollect(input: {
  eventType: 'pageview' | 'heartbeat' | 'event';
  eventName?: string | null;
  path?: string;
  title?: string | null;
  meta?: Record<string, unknown> | null;
}): void {
  if (typeof window === 'undefined') return;
  const path = (input.path || window.location.pathname).split('?')[0] || '/';
  if (path.startsWith('/admin')) return;

  const utm = captureAndReadUtm();
  const payload = {
    sessionId: getSessionId(),
    path,
    title: input.title ?? (typeof document !== 'undefined' ? document.title : null),
    referrer: typeof document !== 'undefined' ? document.referrer || null : null,
    ...utm,
    language: typeof navigator !== 'undefined' ? navigator.language : null,
    screenW: window.innerWidth,
    screenH: window.innerHeight,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    eventType: input.eventType,
    eventName: input.eventName ?? null,
    meta: input.meta ?? null,
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

/**
 * Push a named Custom Event to dataLayer and mirror to first-party analytics.
 */
export function trackGtmEvent(
  event: string,
  payload: Record<string, unknown> = {},
  opts?: { beacon?: boolean; path?: string },
): void {
  if (typeof window === 'undefined') return;
  const path = (opts?.path || window.location.pathname).split('?')[0] || '/';
  if (path.startsWith('/admin')) return;

  const user = readPublicUserContext();
  pushDataLayer(event, {
    page_path: path,
    page_location: window.location.href,
    page_title: typeof document !== 'undefined' ? document.title : path,
    page_type: inferPageType(path),
    user_id: user.user_id,
    user_status: user.user_status,
    ...payload,
  });

  if (opts?.beacon === false) return;
  beaconCollect({
    eventType: 'event',
    eventName: event.slice(0, 80),
    path,
    meta: payload,
  });
}

export function trackAuthSuccess(input: {
  isNewUser: boolean;
  method?: string;
  userId?: number | null;
}): void {
  const user_id =
    typeof input.userId === 'number' && Number.isFinite(input.userId) ? `u_${input.userId}` : readPublicUserContext().user_id;
  const base = { method: input.method || 'otp', user_id, user_status: 'logged_in' as const };
  trackGtmEvent('login', base);
  if (input.isNewUser) {
    trackGtmEvent('sign_up', { ...base, method: input.method || 'otp' });
  }
}

export function trackGenerateLead(input: {
  formId?: string;
  formName?: string;
  method?: string;
}): void {
  trackGtmEvent('generate_lead', {
    form_id: input.formId || null,
    form_name: input.formName || 'newsletter',
    method: input.method || 'email',
  });
}

export function trackViewItem(input: {
  itemId: string;
  itemName: string;
  price?: number;
  category?: string;
}): void {
  const items: EcommerceItem[] = [
    {
      item_id: input.itemId,
      item_name: input.itemName,
      price: input.price,
      quantity: 1,
      item_category: input.category,
    },
  ];
  trackGtmEvent('view_item', {
    currency: 'IRR',
    value: input.price ?? 0,
    items,
  });
}

export function trackAddToCart(input: {
  itemId: string;
  itemName: string;
  price?: number;
  quantity?: number;
  category?: string;
}): void {
  const qty = Math.max(1, input.quantity || 1);
  const unit = input.price ?? 0;
  const items: EcommerceItem[] = [
    {
      item_id: input.itemId,
      item_name: input.itemName,
      price: unit,
      quantity: qty,
      item_category: input.category,
    },
  ];
  trackGtmEvent('add_to_cart', {
    currency: 'IRR',
    value: unit * qty,
    items,
  });
}

export function trackBeginCheckout(input: {
  value: number;
  items: EcommerceItem[];
  currency?: string;
}): void {
  trackGtmEvent('begin_checkout', {
    currency: input.currency || 'IRR',
    value: input.value,
    items: input.items,
  });
}

export function trackPurchase(input: {
  transactionId: string;
  value: number;
  items: EcommerceItem[];
  currency?: string;
  paymentType?: string;
}): void {
  trackGtmEvent('purchase', {
    transaction_id: input.transactionId,
    currency: input.currency || 'IRR',
    value: input.value,
    items: input.items,
    payment_type: input.paymentType || null,
  });
}

let clarityBooted = false;
let gtmBooted = false;
let linkTrackingBooted = false;
let scrollTrackingBooted = false;
let ga4VarPushed = false;
let lastGtmPagePath: string | null = null;
let scrollMarkedPath: string | null = null;

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
  const dedupeKey = `${path}${search}`;
  if (lastGtmPagePath === dedupeKey) return;
  lastGtmPagePath = dedupeKey;
  scrollMarkedPath = null;
  const utm = captureAndReadUtm(search || window.location.search);
  pushDataLayer(
    buildGtmPageViewPayload({
      path,
      title: typeof document !== 'undefined' ? document.title : path,
      locationHref: window.location.href,
      user: readPublicUserContext(),
      utm,
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
  const clickId =
    a.getAttribute('data-gtm-id') || a.id || a.getAttribute('data-analytics-id') || null;
  const payload = buildGtmLinkClickPayload({
    kind: classified.kind,
    url: classified.url,
    domain: classified.domain,
    outbound: classified.outbound,
    text,
    clickId,
  });
  pushDataLayer(payload);
  beaconCollect({
    eventType: 'event',
    eventName: 'link_click',
    meta: {
      link_kind: classified.kind,
      link_url: classified.url,
      outbound: classified.outbound,
      click_id: clickId,
    },
  });
  if (classified.outbound && classified.kind === 'outbound') {
    trackGtmEvent('outbound_click', {
      click_text: payload.click_text,
      click_url: payload.click_url,
      click_id: clickId,
      link_domain: classified.domain,
    });
  }
  if (classified.kind === 'download') {
    trackGtmEvent('file_download', {
      click_text: payload.click_text,
      click_url: payload.click_url,
      click_id: clickId,
      file_extension: (classified.url.split('?')[0].split('.').pop() || '').slice(0, 12),
    });
  }
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

function onScrollDepth(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.location.pathname.startsWith('/admin')) return;
  const path = window.location.pathname.split('?')[0] || '/';
  if (scrollMarkedPath === path) return;
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || 0;
  const height = Math.max(doc.scrollHeight - window.innerHeight, 1);
  const pct = scrollTop / height;
  if (pct < 0.75) return;
  scrollMarkedPath = path;
  trackGtmEvent('scroll', { percent_scrolled: 75 });
}

function maybeInitScrollTracking(): void {
  if (scrollTrackingBooted || typeof window === 'undefined') return;
  if (!resolveGtmId()) return;
  scrollTrackingBooted = true;
  try {
    window.addEventListener('scroll', onScrollDepth, { passive: true });
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
    ensureDataLayer();

    if (!ga4VarPushed) {
      ga4VarPushed = true;
      const mid = resolveGa4MeasurementId();
      if (mid) {
        pushDataLayer({ ga4_measurement_id: mid });
      }
    }

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
    maybeInitScrollTracking();
  } catch {
    /* ignore */
  }
}

export function trackPageview(pathname?: string): void {
  if (typeof window === 'undefined') return;
  const path = pathname ?? window.location.pathname;
  if (path.startsWith('/admin')) return;

  void ensureRuntimeAnalyticsConfig();
  maybeInitClarity();
  maybeInitGtm();
  maybeInitGa4();
  maybeInitHeartbeat();
  pushGtmVirtualPageview(path);
  sendGtagPageView(path);

  beaconCollect({
    eventType: 'pageview',
    eventName: 'page_view',
    path: path.split('?')[0] || '/',
  });
}
