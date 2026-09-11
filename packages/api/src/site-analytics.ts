/**
 * First-party site analytics — pageviews / sessions / GTM-mirrored events
 * for public petdate.ir and admin گزارشات. Additive SQLite tables only (never wipe).
 */
import {
  CLARITY_DASHBOARD_URL,
  CLARITY_PROJECT_ID,
  GTM_CONTAINER_ID,
  GTM_DASHBOARD_URL,
  GTM_SITE_TRIGGERS,
  GTM_SITE_VARIABLES,
  GTM_UI_SETUP_CHECKLIST,
  TAG_ASSISTANT_URL,
  type GtmCatalogRow,
  type GtmUiChecklistItem,
} from '@petdate/shared';
import { getDb } from './db';

export type SiteAnalyticsEventInput = {
  sessionId: string;
  path: string;
  title?: string | null;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  language?: string | null;
  screenW?: number | null;
  screenH?: number | null;
  userAgent?: string | null;
  country?: string | null;
  eventType?: 'pageview' | 'heartbeat' | 'event';
  eventName?: string | null;
  meta?: Record<string, unknown> | null;
};

export type SiteAnalyticsBucket = { label: string; value: number };
export type SiteAnalyticsSessionRow = {
  sessionId: string;
  startedAt: string;
  lastSeenAt: string;
  pageviews: number;
  landingPath: string;
  exitPath: string;
  referrerHost: string;
  device: string;
  country: string;
};

export type SiteAnalyticsRecentEvent = {
  id: number;
  sessionId: string;
  eventType: string;
  eventName: string | null;
  path: string;
  device: string;
  createdAt: string;
  meta: Record<string, unknown> | null;
};

export type SiteAnalyticsReport = {
  generatedAt: string;
  periodDays: number;
  from: string;
  to: string;
  overview: {
    pageviews: number;
    sessions: number;
    uniqueSessions: number;
    avgPagesPerSession: number;
    bounceRatePct: number;
    engagementRatePct: number;
    desktopPct: number;
    mobilePct: number;
    tabletPct: number;
  };
  trafficDaily: SiteAnalyticsBucket[];
  sessionsDaily: SiteAnalyticsBucket[];
  popularPages: SiteAnalyticsBucket[];
  referrers: SiteAnalyticsBucket[];
  devices: SiteAnalyticsBucket[];
  countries: SiteAnalyticsBucket[];
  languages: SiteAnalyticsBucket[];
  utmSources: SiteAnalyticsBucket[];
  utmMediums: SiteAnalyticsBucket[];
  utmCampaigns: SiteAnalyticsBucket[];
  events: SiteAnalyticsBucket[];
  recentSessions: SiteAnalyticsSessionRow[];
  clarity: {
    configured: boolean;
    projectId: string | null;
    dashboardUrl: string | null;
    note: string;
  };
  gtm: {
    configured: boolean;
    containerId: string | null;
    dashboardUrl: string | null;
    tagAssistantUrl: string | null;
    note: string;
  };
  ga4: {
    configured: boolean;
    measurementId: string | null;
    dashboardUrl: string | null;
    source: 'env' | 'settings' | null;
    note: string;
  };
  requestedAgentId: string | null;
};

/** admin_settings key for optional GA4 Measurement ID (never invent one). */
export const GA4_SETTINGS_KEY = 'ga4MeasurementId';

export type SiteAnalyticsPublicConfig = {
  ga4MeasurementId: string | null;
  gtmContainerId: string | null;
  clarityProjectId: string | null;
};

export type TagManagerReport = {
  generatedAt: string;
  periodDays: number;
  from: string;
  to: string;
  clarity: SiteAnalyticsReport['clarity'];
  gtm: SiteAnalyticsReport['gtm'] & {
    htmlSnippetDetected: boolean;
    statusLabelFa: string;
  };
  ga4: {
    measurementId: string | null;
    configured: boolean;
    note: string;
  };
  catalog: {
    variables: GtmCatalogRow[];
    triggers: GtmCatalogRow[];
  };
  checklist: GtmUiChecklistItem[];
  metrics: {
    pageviews: number;
    customEvents: number;
    uniqueSessions: number;
    eventsByType: SiteAnalyticsBucket[];
    topPages: SiteAnalyticsBucket[];
    devices: SiteAnalyticsBucket[];
    recentEvents: SiteAnalyticsRecentEvent[];
  };
  health: {
    lastEventAt: string | null;
    lastPageviewAt: string | null;
    eventsLast24h: number;
    note: string;
  };
};

const AGENT_UUID = '4b79bfb4-a025-4f0e-8b84-0f45c3acac64';

/** Live Microsoft Clarity project for petdate.ir (short id — not the rejected agent UUID). */
export const DEFAULT_CLARITY_PROJECT_ID = CLARITY_PROJECT_ID;

/** Live Google Tag Manager container for petdate.ir. */
export const DEFAULT_GTM_ID = GTM_CONTAINER_ID;

let ensured = false;

export function ensureSiteAnalyticsSchema(): void {
  if (ensured) return;
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL DEFAULT 'pageview',
      event_name TEXT,
      path TEXT NOT NULL,
      title TEXT,
      referrer TEXT,
      referrer_host TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      language TEXT,
      country TEXT,
      device TEXT,
      screen_w INTEGER,
      screen_h INTEGER,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_site_analytics_created ON site_analytics_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_site_analytics_session ON site_analytics_events(session_id);
    CREATE INDEX IF NOT EXISTS idx_site_analytics_path ON site_analytics_events(path);
    CREATE INDEX IF NOT EXISTS idx_site_analytics_event_name ON site_analytics_events(event_name);
  `);
  const cols = (
    db.prepare(`PRAGMA table_info(site_analytics_events)`).all() as Array<{ name: string }>
  ).map((c) => c.name);
  if (!cols.includes('meta_json')) {
    db.exec(`ALTER TABLE site_analytics_events ADD COLUMN meta_json TEXT`);
  }
  ensured = true;
}

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function normalizePath(raw: unknown): string {
  const s = clampStr(raw, 512) || '/';
  if (!s.startsWith('/')) return `/${s}`.slice(0, 512);
  const pathOnly = s.split('?')[0]?.split('#')[0] || '/';
  return pathOnly.slice(0, 512) || '/';
}

export function parseReferrerHost(referrer: string | null | undefined): string {
  if (!referrer) return '(direct)';
  try {
    const u = new URL(referrer);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (!host) return '(direct)';
    if (host === 'petdate.ir' || host.endsWith('.petdate.ir') || host === 'localhost') {
      return '(internal)';
    }
    return host.slice(0, 120);
  } catch {
    return '(other)';
  }
}

export function detectDevice(ua: string | null | undefined, screenW?: number | null): string {
  const s = (ua || '').toLowerCase();
  if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/.test(s)) return 'tablet';
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(s)) return 'mobile';
  if (typeof screenW === 'number' && Number.isFinite(screenW) && screenW > 0 && screenW < 768) {
    return 'mobile';
  }
  if (typeof screenW === 'number' && Number.isFinite(screenW) && screenW >= 768 && screenW < 1024) {
    return 'tablet';
  }
  return 'desktop';
}

export function isValidClarityProjectId(id: string | null | undefined): boolean {
  if (!id) return false;
  const t = id.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) {
    return false;
  }
  return /^[a-zA-Z0-9_-]{4,64}$/.test(t);
}

function resolveClarityProjectId(): string | null {
  const fromEnv =
    process.env.CLARITY_PROJECT_ID?.trim() ||
    process.env.VITE_CLARITY_PROJECT_ID?.trim() ||
    '';
  if (fromEnv && !isValidClarityProjectId(fromEnv)) return null;
  const id = fromEnv || DEFAULT_CLARITY_PROJECT_ID;
  return isValidClarityProjectId(id) ? id : null;
}

function clarityConfig(): SiteAnalyticsReport['clarity'] {
  const raw = resolveClarityProjectId();
  const ok = Boolean(raw);
  return {
    configured: ok,
    projectId: ok ? raw : null,
    dashboardUrl: ok
      ? raw === CLARITY_PROJECT_ID
        ? CLARITY_DASHBOARD_URL
        : `https://clarity.microsoft.com/projects/view/${raw}/`
      : null,
    note: ok
      ? 'پروژه Clarity پیکربندی شده — برای session replay و heatmap به داشبورد Clarity بروید.'
      : 'شناسهٔ داده‌شده (UUID ایجنت) توسط Clarity به‌عنوان project id رد شد؛ گزارش‌های زیر از آنالیتیکس اول‌شخص petdate است. برای Clarity یک Project ID معتبر را در VITE_CLARITY_PROJECT_ID ست کنید.',
  };
}

export function isValidGtmContainerId(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^GTM-[A-Z0-9]{4,12}$/i.test(id.trim());
}

function resolveGtmId(): string | null {
  const fromEnv =
    process.env.GTM_ID?.trim() ||
    process.env.VITE_GTM_ID?.trim() ||
    '';
  if (fromEnv && !isValidGtmContainerId(fromEnv)) return null;
  const id = fromEnv || DEFAULT_GTM_ID;
  return isValidGtmContainerId(id) ? id.trim().toUpperCase() : null;
}

export function isValidGa4MeasurementId(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^G-[A-Z0-9]{6,20}$/i.test(id.trim());
}

function readGa4FromSettings(): string | null {
  try {
    const row = getDb()
      .prepare(`SELECT value FROM admin_settings WHERE key = ?`)
      .get(GA4_SETTINGS_KEY) as { value?: string } | undefined;
    const v = row?.value?.trim() || '';
    return isValidGa4MeasurementId(v) ? v.toUpperCase() : null;
  } catch {
    return null;
  }
}

/**
 * Resolve GA4 Measurement ID: env first, then admin_settings.
 * Never invents a placeholder G- id.
 */
export function resolveGa4MeasurementId(): {
  id: string | null;
  source: 'env' | 'settings' | null;
} {
  const fromEnv =
    process.env.GA4_MEASUREMENT_ID?.trim() ||
    process.env.VITE_GA4_MEASUREMENT_ID?.trim() ||
    process.env.VITE_GOOGLE_ANALYTICS_ID?.trim() ||
    process.env.VITE_GA_MEASUREMENT_ID?.trim() ||
    process.env.GOOGLE_ANALYTICS_ID?.trim() ||
    '';
  if (fromEnv) {
    if (!isValidGa4MeasurementId(fromEnv)) return { id: null, source: null };
    return { id: fromEnv.toUpperCase(), source: 'env' };
  }
  const fromSettings = readGa4FromSettings();
  if (fromSettings) return { id: fromSettings, source: 'settings' };
  return { id: null, source: null };
}

function ga4Config(): SiteAnalyticsReport['ga4'] {
  const { id, source } = resolveGa4MeasurementId();
  const ok = Boolean(id);
  return {
    configured: ok,
    measurementId: id,
    dashboardUrl: ok ? 'https://analytics.google.com/' : null,
    source,
    note: ok
      ? `شناسه GA4 (${id}) از ${source === 'settings' ? 'تنظیمات پلتفرم' : 'env'} — gtag روی صفحات عمومی و dataLayer برای GTM فعال است.`
      : 'شناسه اندازه‌گیری GA4 هنوز تنظیم نشده. در «آنالیتیکس» یا تنظیمات پلتفرم فیلد Measurement ID را ذخیره کنید، یا VITE_GA4_MEASUREMENT_ID را در env بگذارید. تا آن زمان گزارش‌های زیر از آنالیتیکس اول‌شخص petdate است.',
  };
}

export function getSiteAnalyticsPublicConfig(): SiteAnalyticsPublicConfig {
  return {
    ga4MeasurementId: resolveGa4MeasurementId().id,
    gtmContainerId: resolveGtmId(),
    clarityProjectId: resolveClarityProjectId(),
  };
}

function gtmConfig(): SiteAnalyticsReport['gtm'] {
  const raw = resolveGtmId();
  const ok = Boolean(raw);
  return {
    configured: ok,
    containerId: ok ? raw : null,
    dashboardUrl: ok ? GTM_DASHBOARD_URL : null,
    tagAssistantUrl: ok ? TAG_ASSISTANT_URL : null,
    note: ok
      ? `کانتینر GTM (${raw}) در HTML اولیه نصب است (Tag Assistant). روی مسیرهای عمومی: dataLayer قبل از gtm.js، رویداد page_view در هر تغییر مسیر SPA، و رویدادهای auth/ecommerce/لید — تگ‌های داخل کانتینر را در Tag Manager وصل کنید (نه /admin).`
      : 'شناسهٔ GTM نامعتبر است. مقدار VITE_GTM_ID را به صورت GTM-XXXX تنظیم کنید.',
  };
}

function serializeMeta(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta || typeof meta !== 'object') return null;
  try {
    const json = JSON.stringify(meta);
    return json.length > 4000 ? json.slice(0, 4000) : json;
  } catch {
    return null;
  }
}

function parseMeta(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function ingestSiteAnalyticsEvent(
  input: SiteAnalyticsEventInput,
  opts?: { countryHint?: string | null }
): { ok: true; id: number } {
  ensureSiteAnalyticsSchema();
  const sessionId = clampStr(input.sessionId, 80);
  if (!sessionId || sessionId.length < 8) {
    throw new Error('sessionId نامعتبر');
  }
  const path = normalizePath(input.path);
  const eventType =
    input.eventType === 'heartbeat' || input.eventType === 'event' ? input.eventType : 'pageview';
  const referrer = clampStr(input.referrer, 1024);
  const ua = clampStr(input.userAgent, 512);
  const device = detectDevice(ua, input.screenW ?? null);
  const country =
    clampStr(opts?.countryHint, 64) ||
    clampStr(input.country, 64) ||
    'نامشخص';

  const result = getDb()
    .prepare(
      `INSERT INTO site_analytics_events (
        session_id, event_type, event_name, path, title, referrer, referrer_host,
        utm_source, utm_medium, utm_campaign, language, country, device,
        screen_w, screen_h, user_agent, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      sessionId,
      eventType,
      clampStr(input.eventName, 80),
      path,
      clampStr(input.title, 240),
      referrer,
      parseReferrerHost(referrer),
      clampStr(input.utmSource, 80),
      clampStr(input.utmMedium, 80),
      clampStr(input.utmCampaign, 120),
      clampStr(input.language, 32),
      country,
      device,
      typeof input.screenW === 'number' && Number.isFinite(input.screenW) ? Math.round(input.screenW) : null,
      typeof input.screenH === 'number' && Number.isFinite(input.screenH) ? Math.round(input.screenH) : null,
      ua,
      serializeMeta(input.meta ?? null)
    );

  return { ok: true, id: Number(result.lastInsertRowid) };
}

function daysBack(n: number): { from: string; to: string; days: string[] } {
  const days: string[] = [];
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return {
    from: `${days[0]}T00:00:00`,
    to: `${days[days.length - 1]}T23:59:59`,
    days,
  };
}

function topBucket(sql: string, params: unknown[], limit = 12): SiteAnalyticsBucket[] {
  const rows = getDb().prepare(sql).all(...params) as Array<{ label: string; value: number }>;
  return rows.slice(0, limit).map((r) => ({
    label: String(r.label || 'نامشخص'),
    value: Number(r.value) || 0,
  }));
}

function fillDaily(days: string[], rows: Array<{ d: string; c: number }>): SiteAnalyticsBucket[] {
  const map = new Map(rows.map((r) => [String(r.d), Number(r.c) || 0]));
  return days.map((label) => ({ label, value: map.get(label) || 0 }));
}

export function buildSiteAnalyticsReport(periodDays = 14): SiteAnalyticsReport {
  ensureSiteAnalyticsSchema();
  const n = Math.min(90, Math.max(1, Math.round(periodDays) || 14));
  const { from, to, days } = daysBack(n);
  const db = getDb();

  const pageviews = Number(
    (db.prepare(
      `SELECT COUNT(*) AS c FROM site_analytics_events
       WHERE event_type = 'pageview' AND created_at >= ? AND created_at <= ?`
    ).get(from, to) as { c: number })?.c || 0
  );

  const uniqueSessions = Number(
    (db.prepare(
      `SELECT COUNT(DISTINCT session_id) AS c FROM site_analytics_events
       WHERE created_at >= ? AND created_at <= ?`
    ).get(from, to) as { c: number })?.c || 0
  );

  const bounceRow = db.prepare(
    `SELECT COUNT(*) AS bounced FROM (
       SELECT session_id FROM site_analytics_events
       WHERE event_type = 'pageview' AND created_at >= ? AND created_at <= ?
       GROUP BY session_id HAVING COUNT(*) = 1
     )`
  ).get(from, to) as { bounced: number };
  const bounced = Number(bounceRow?.bounced || 0);
  const bounceRatePct = uniqueSessions ? Math.round((bounced / uniqueSessions) * 1000) / 10 : 0;

  // Engagement proxy: sessions with >1 pageview OR any custom event/heartbeat.
  const engagedRow = db.prepare(
    `SELECT COUNT(*) AS engaged FROM (
       SELECT session_id FROM site_analytics_events
       WHERE created_at >= ? AND created_at <= ?
       GROUP BY session_id
       HAVING SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) > 1
           OR SUM(CASE WHEN event_type IN ('event', 'heartbeat') THEN 1 ELSE 0 END) > 0
     )`
  ).get(from, to) as { engaged: number };
  const engaged = Number(engagedRow?.engaged || 0);
  const engagementRatePct = uniqueSessions ? Math.round((engaged / uniqueSessions) * 1000) / 10 : 0;

  const deviceRows = topBucket(
    `SELECT device AS label, COUNT(*) AS value FROM site_analytics_events
     WHERE event_type = 'pageview' AND created_at >= ? AND created_at <= ?
     GROUP BY device ORDER BY value DESC`,
    [from, to],
    10
  );
  const deviceTotal = deviceRows.reduce((s, r) => s + r.value, 0) || 1;
  const pct = (label: string) =>
    Math.round(((deviceRows.find((d) => d.label === label)?.value || 0) / deviceTotal) * 1000) / 10;

  const trafficDaily = fillDaily(
    days,
    db.prepare(
      `SELECT substr(created_at,1,10) AS d, COUNT(*) AS c FROM site_analytics_events
       WHERE event_type = 'pageview' AND created_at >= ? AND created_at <= ? GROUP BY d`
    ).all(from, to) as Array<{ d: string; c: number }>
  );

  const sessionsDaily = fillDaily(
    days,
    db.prepare(
      `SELECT substr(created_at,1,10) AS d, COUNT(DISTINCT session_id) AS c FROM site_analytics_events
       WHERE created_at >= ? AND created_at <= ? GROUP BY d`
    ).all(from, to) as Array<{ d: string; c: number }>
  );

  const recentSessions = db.prepare(
    `SELECT
       session_id AS sessionId,
       MIN(created_at) AS startedAt,
       MAX(created_at) AS lastSeenAt,
       SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) AS pageviews,
       (SELECT path FROM site_analytics_events e2 WHERE e2.session_id = e.session_id AND e2.event_type = 'pageview' ORDER BY e2.id ASC LIMIT 1) AS landingPath,
       (SELECT path FROM site_analytics_events e3 WHERE e3.session_id = e.session_id AND e3.event_type = 'pageview' ORDER BY e3.id DESC LIMIT 1) AS exitPath,
       COALESCE((SELECT referrer_host FROM site_analytics_events e4 WHERE e4.session_id = e.session_id ORDER BY e4.id ASC LIMIT 1), '(direct)') AS referrerHost,
       COALESCE((SELECT device FROM site_analytics_events e5 WHERE e5.session_id = e.session_id ORDER BY e5.id ASC LIMIT 1), 'desktop') AS device,
       COALESCE((SELECT country FROM site_analytics_events e6 WHERE e6.session_id = e.session_id ORDER BY e6.id ASC LIMIT 1), 'نامشخص') AS country
     FROM site_analytics_events e
     WHERE created_at >= ? AND created_at <= ?
     GROUP BY session_id
     ORDER BY lastSeenAt DESC
     LIMIT 40`
  ).all(from, to) as SiteAnalyticsSessionRow[];

  return {
    generatedAt: new Date().toISOString(),
    periodDays: n,
    from,
    to,
    overview: {
      pageviews,
      sessions: uniqueSessions,
      uniqueSessions,
      avgPagesPerSession: uniqueSessions > 0 ? Math.round((pageviews / uniqueSessions) * 10) / 10 : 0,
      bounceRatePct,
      engagementRatePct,
      desktopPct: pct('desktop'),
      mobilePct: pct('mobile'),
      tabletPct: pct('tablet'),
    },
    trafficDaily,
    sessionsDaily,
    popularPages: topBucket(
      `SELECT path AS label, COUNT(*) AS value FROM site_analytics_events
       WHERE event_type = 'pageview' AND created_at >= ? AND created_at <= ?
       GROUP BY path ORDER BY value DESC`, [from, to], 15),
    referrers: topBucket(
      `SELECT referrer_host AS label, COUNT(*) AS value FROM site_analytics_events
       WHERE event_type = 'pageview' AND created_at >= ? AND created_at <= ?
         AND referrer_host IS NOT NULL AND referrer_host != '(internal)'
       GROUP BY referrer_host ORDER BY value DESC`, [from, to], 12),
    devices: deviceRows.map((d) => ({
      label: d.label === 'desktop' ? 'دسکتاپ' : d.label === 'mobile' ? 'موبایل' : d.label === 'tablet' ? 'تبلت' : d.label,
      value: d.value,
    })),
    countries: topBucket(
      `SELECT country AS label, COUNT(*) AS value FROM site_analytics_events
       WHERE event_type = 'pageview' AND created_at >= ? AND created_at <= ?
       GROUP BY country ORDER BY value DESC`, [from, to], 12),
    languages: topBucket(
      `SELECT COALESCE(language, 'نامشخص') AS label, COUNT(*) AS value FROM site_analytics_events
       WHERE event_type = 'pageview' AND created_at >= ? AND created_at <= ?
       GROUP BY label ORDER BY value DESC`, [from, to], 10),
    utmSources: topBucket(
      `SELECT COALESCE(utm_source, '(none)') AS label, COUNT(*) AS value FROM site_analytics_events
       WHERE event_type = 'pageview' AND created_at >= ? AND created_at <= ?
         AND utm_source IS NOT NULL AND utm_source != ''
       GROUP BY label ORDER BY value DESC`, [from, to], 10),
    utmMediums: topBucket(
      `SELECT COALESCE(utm_medium, '(none)') AS label, COUNT(*) AS value FROM site_analytics_events
       WHERE event_type = 'pageview' AND created_at >= ? AND created_at <= ?
         AND utm_medium IS NOT NULL AND utm_medium != ''
       GROUP BY label ORDER BY value DESC`, [from, to], 10),
    utmCampaigns: topBucket(
      `SELECT COALESCE(utm_campaign, '(none)') AS label, COUNT(*) AS value FROM site_analytics_events
       WHERE event_type = 'pageview' AND created_at >= ? AND created_at <= ?
         AND utm_campaign IS NOT NULL AND utm_campaign != ''
       GROUP BY label ORDER BY value DESC`, [from, to], 10),
    events: topBucket(
      `SELECT COALESCE(NULLIF(event_name, ''), event_type) AS label, COUNT(*) AS value
       FROM site_analytics_events
       WHERE created_at >= ? AND created_at <= ?
         AND event_type IN ('event', 'pageview', 'heartbeat')
       GROUP BY label ORDER BY value DESC`, [from, to], 25),
    recentSessions: recentSessions.map((s) => ({
      ...s,
      pageviews: Number(s.pageviews) || 0,
      landingPath: s.landingPath || '/',
      exitPath: s.exitPath || '/',
      referrerHost: s.referrerHost || '(direct)',
      device: s.device || 'desktop',
      country: s.country || 'نامشخص',
    })),
    clarity: clarityConfig(),
    gtm: gtmConfig(),
    ga4: ga4Config(),
    requestedAgentId: AGENT_UUID,
  };
}

export function buildTagManagerReport(periodDays = 14): TagManagerReport {
  ensureSiteAnalyticsSchema();
  const n = Math.min(90, Math.max(1, Math.round(periodDays) || 14));
  const { from, to } = daysBack(n);
  const db = getDb();
  const gtm = gtmConfig();
  const clarity = clarityConfig();
  const ga4 = resolveGa4MeasurementId();
  const ga4Id = ga4.id;

  const pageviews = Number(
    (db.prepare(
      `SELECT COUNT(*) AS c FROM site_analytics_events
       WHERE event_type = 'pageview' AND created_at >= ? AND created_at <= ?`
    ).get(from, to) as { c: number })?.c || 0
  );

  const customEvents = Number(
    (db.prepare(
      `SELECT COUNT(*) AS c FROM site_analytics_events
       WHERE event_type = 'event' AND created_at >= ? AND created_at <= ?`
    ).get(from, to) as { c: number })?.c || 0
  );

  const uniqueSessions = Number(
    (db.prepare(
      `SELECT COUNT(DISTINCT session_id) AS c FROM site_analytics_events
       WHERE created_at >= ? AND created_at <= ?`
    ).get(from, to) as { c: number })?.c || 0
  );

  const eventsByType = topBucket(
    `SELECT COALESCE(NULLIF(event_name, ''), event_type) AS label, COUNT(*) AS value
     FROM site_analytics_events
     WHERE created_at >= ? AND created_at <= ?
     GROUP BY label ORDER BY value DESC`,
    [from, to],
    25
  );

  const deviceRows = topBucket(
    `SELECT device AS label, COUNT(*) AS value FROM site_analytics_events
     WHERE created_at >= ? AND created_at <= ?
     GROUP BY device ORDER BY value DESC`,
    [from, to],
    10
  );

  const recentRaw = db.prepare(
    `SELECT id, session_id AS sessionId, event_type AS eventType, event_name AS eventName,
            path, device, created_at AS createdAt, meta_json AS metaJson
     FROM site_analytics_events
     WHERE created_at >= ? AND created_at <= ?
     ORDER BY id DESC
     LIMIT 60`
  ).all(from, to) as Array<{
    id: number;
    sessionId: string;
    eventType: string;
    eventName: string | null;
    path: string;
    device: string;
    createdAt: string;
    metaJson: string | null;
  }>;

  const lastEventAt = (db.prepare(
    `SELECT MAX(created_at) AS t FROM site_analytics_events`
  ).get() as { t: string | null })?.t || null;

  const lastPageviewAt = (db.prepare(
    `SELECT MAX(created_at) AS t FROM site_analytics_events WHERE event_type = 'pageview'`
  ).get() as { t: string | null })?.t || null;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const eventsLast24h = Number(
    (db.prepare(
      `SELECT COUNT(*) AS c FROM site_analytics_events WHERE created_at >= ?`
    ).get(since24h) as { c: number })?.c || 0
  );

  return {
    generatedAt: new Date().toISOString(),
    periodDays: n,
    from,
    to,
    clarity,
    gtm: {
      ...gtm,
      htmlSnippetDetected: Boolean(gtm.configured),
      statusLabelFa: gtm.configured ? 'پیکربندی‌شده / snippet در HTML' : 'پیکربندی نشده',
    },
    ga4: {
      measurementId: ga4Id,
      configured: Boolean(ga4Id),
      note: ga4Id
        ? `شناسه GA4 (${ga4Id}) از ${ga4.source === 'settings' ? 'تنظیمات پلتفرم' : 'env'} — در GTM به‌عنوان Measurement ID استفاده کنید.`
        : 'شناسه GA4 تنظیم نشده (VITE_GA4_MEASUREMENT_ID یا تنظیمات پلتفرم). در چک‌لیست از PLACEHOLDER_G-XXXXXXXX استفاده کنید — مقدار ساختگی وارد نکنید.',
    },
    catalog: {
      variables: GTM_SITE_VARIABLES,
      triggers: GTM_SITE_TRIGGERS,
    },
    checklist: GTM_UI_SETUP_CHECKLIST,
    metrics: {
      pageviews,
      customEvents,
      uniqueSessions,
      eventsByType,
      topPages: topBucket(
        `SELECT path AS label, COUNT(*) AS value FROM site_analytics_events
         WHERE event_type = 'pageview' AND created_at >= ? AND created_at <= ?
         GROUP BY path ORDER BY value DESC`,
        [from, to],
        15
      ),
      devices: deviceRows.map((d) => ({
        label: d.label === 'desktop' ? 'دسکتاپ' : d.label === 'mobile' ? 'موبایل' : d.label === 'tablet' ? 'تبلت' : d.label,
        value: d.value,
      })),
      recentEvents: recentRaw.map((r) => ({
        id: Number(r.id),
        sessionId: r.sessionId,
        eventType: r.eventType,
        eventName: r.eventName,
        path: r.path,
        device: r.device || 'desktop',
        createdAt: r.createdAt,
        meta: parseMeta(r.metaJson),
      })),
    },
    health: {
      lastEventAt,
      lastPageviewAt,
      eventsLast24h,
      note: lastEventAt
        ? `آخرین رویداد اول‌شخص: ${lastEventAt} — جمع ۲۴ساعت: ${eventsLast24h}`
        : 'هنوز رویدادی در site_analytics ثبت نشده؛ پس از ترافیک عمومی اینجا پر می‌شود.',
    },
  };
}
