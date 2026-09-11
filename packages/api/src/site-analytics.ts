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
  utmContent?: string | null;
  utmTerm?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
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
export type SiteAnalyticsUtmRow = {
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
  pageviews: number;
};
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
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
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
  utmPerformance: SiteAnalyticsUtmRow[];
  events: SiteAnalyticsBucket[];
  recentSessions: SiteAnalyticsSessionRow[];
  savedUtmCampaigns: UtmCampaignRecord[];
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

export type UtmCampaignRecord = {
  id: number;
  name: string;
  path: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string | null;
  utmTerm: string | null;
  previewUrl: string;
  createdAt: string;
};

let ensured = false;

/**
 * Postgres (via pg-compat) lowercases unquoted aliases — `AS startedAt` becomes `startedat`.
 * Always read with case-insensitive fallback so SQLite + Postgres both work.
 */
export function pickRowField(
  row: Record<string, unknown> | null | undefined,
  ...names: string[]
): unknown {
  if (!row) return undefined;
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name) && row[name] != null && row[name] !== '') {
      return row[name];
    }
  }
  const lowerMap = new Map(Object.keys(row).map((k) => [k.toLowerCase(), k]));
  for (const name of names) {
    const real = lowerMap.get(name.toLowerCase());
    if (real != null && row[real] != null && row[real] !== '') return row[real];
  }
  return undefined;
}

function pickRowStr(
  row: Record<string, unknown>,
  names: string[],
  fallback = '',
): string {
  const v = pickRowField(row, ...names);
  if (v == null) return fallback;
  return String(v);
}

function pickRowNum(row: Record<string, unknown>, names: string[], fallback = 0): number {
  const v = pickRowField(row, ...names);
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

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
    CREATE TABLE IF NOT EXISTS utm_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT NOT NULL DEFAULT '/',
      utm_source TEXT NOT NULL,
      utm_medium TEXT NOT NULL,
      utm_campaign TEXT NOT NULL,
      utm_content TEXT,
      utm_term TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const cols = (
    db.prepare(`PRAGMA table_info(site_analytics_events)`).all() as Array<{ name: string }>
  ).map((c) => c.name);
  const addCol = (name: string, ddl: string) => {
    if (!cols.includes(name)) db.exec(`ALTER TABLE site_analytics_events ADD COLUMN ${ddl}`);
  };
  addCol('meta_json', 'meta_json TEXT');
  addCol('utm_content', 'utm_content TEXT');
  addCol('utm_term', 'utm_term TEXT');
  addCol('gclid', 'gclid TEXT');
  addCol('fbclid', 'fbclid TEXT');
  ensured = true;
}

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/**
 * Normalize a page path for storage/aggregation.
 * Strips query/hash, control chars, trailing junk (`|`), and empty/undefined → `/`.
 */
export function normalizePath(raw: unknown): string {
  let s = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
  s = s.trim();
  if (!s || s === 'undefined' || s === 'null' || s === '(null)') return '/';
  try {
    if (/%[0-9A-Fa-f]{2}/.test(s)) s = decodeURIComponent(s);
  } catch {
    /* keep raw */
  }
  s = s.replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, '').trim();
  const pathOnly = s.split('?')[0]?.split('#')[0] || '';
  // Trailing `|` / backslashes are telemetry junk (seen as `/profile|` in admin charts).
  let cleaned = pathOnly.replace(/[|\\]+$/g, '').replace(/\/{2,}/g, '/').trim();
  if (!cleaned || cleaned === 'undefined' || cleaned === 'null') return '/';
  // Path that was only delimiters (e.g. `|`, `||`) is empty, not home.
  if (/^[|\\]+$/.test(pathOnly.trim())) return '/';
  if (!cleaned.startsWith('/')) cleaned = `/${cleaned}`;
  if (cleaned.length > 1) cleaned = cleaned.replace(/\/+$/, '');
  return cleaned.slice(0, 512) || '/';
}

/**
 * Admin chart label for a path bucket — never blank or junk.
 * Empty / undefined / delimiter-only → `(خالی)`; otherwise normalized path.
 */
export function formatAnalyticsPathLabel(raw: unknown): string {
  const original = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim();
  if (!original || original === 'undefined' || original === 'null' || original === '(null)' || original === 'نامشخص') {
    return '(خالی)';
  }
  if (/^[|\\/\s]+$/.test(original) && !/^\/+$/.test(original)) {
    return '(خالی)';
  }
  const normalized = normalizePath(original);
  // Lone `/` from a junk-only input (e.g. `|`) should stay readable as empty.
  if (normalized === '/' && /^[|\\]+$/.test(original.replace(/\s/g, ''))) {
    return '(خالی)';
  }
  return normalized;
}

/** Merge path buckets after normalizing labels (collapses `/profile` + `/profile|`). */
export function mergePathBuckets(rows: SiteAnalyticsBucket[], limit = 15): SiteAnalyticsBucket[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const label = formatAnalyticsPathLabel(r.label);
    map.set(label, (map.get(label) || 0) + (Number(r.value) || 0));
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
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
        utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, fbclid,
        language, country, device,
        screen_w, screen_h, user_agent, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      clampStr(input.utmContent, 120),
      clampStr(input.utmTerm, 120),
      clampStr(input.gclid, 120),
      clampStr(input.fbclid, 120),
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

/** Inclusive day window using space-separated timestamps (matches SQLite/PG TO_CHAR storage). */
function daysBack(n: number): { from: string; to: string; days: string[] } {
  const days: string[] = [];
  const end = new Date();
  // Use UTC calendar days so substr(created_at,1,10) buckets align with fillDaily labels.
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(endUtc - i * 24 * 60 * 60 * 1000);
    days.push(d.toISOString().slice(0, 10));
  }
  return {
    from: `${days[0]} 00:00:00`,
    to: `${days[days.length - 1]} 23:59:59`,
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

  const recentSessionsRaw = db.prepare(
    `SELECT
       session_id AS "sessionId",
       MIN(created_at) AS "startedAt",
       MAX(created_at) AS "lastSeenAt",
       SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) AS "pageviews",
       (SELECT path FROM site_analytics_events e2 WHERE e2.session_id = e.session_id AND e2.event_type = 'pageview' ORDER BY e2.id ASC LIMIT 1) AS "landingPath",
       (SELECT path FROM site_analytics_events e3 WHERE e3.session_id = e.session_id AND e3.event_type = 'pageview' ORDER BY e3.id DESC LIMIT 1) AS "exitPath",
       COALESCE((SELECT referrer_host FROM site_analytics_events e4 WHERE e4.session_id = e.session_id ORDER BY e4.id ASC LIMIT 1), '(direct)') AS "referrerHost",
       COALESCE((SELECT device FROM site_analytics_events e5 WHERE e5.session_id = e.session_id ORDER BY e5.id ASC LIMIT 1), 'desktop') AS "device",
       COALESCE((SELECT country FROM site_analytics_events e6 WHERE e6.session_id = e.session_id ORDER BY e6.id ASC LIMIT 1), 'نامشخص') AS "country",
       (SELECT utm_source FROM site_analytics_events e7 WHERE e7.session_id = e.session_id AND e7.utm_source IS NOT NULL AND e7.utm_source != '' ORDER BY e7.id ASC LIMIT 1) AS "utmSource",
       (SELECT utm_medium FROM site_analytics_events e8 WHERE e8.session_id = e.session_id AND e8.utm_medium IS NOT NULL AND e8.utm_medium != '' ORDER BY e8.id ASC LIMIT 1) AS "utmMedium",
       (SELECT utm_campaign FROM site_analytics_events e9 WHERE e9.session_id = e.session_id AND e9.utm_campaign IS NOT NULL AND e9.utm_campaign != '' ORDER BY e9.id ASC LIMIT 1) AS "utmCampaign"
     FROM site_analytics_events e
     WHERE created_at >= ? AND created_at <= ?
     GROUP BY session_id
     ORDER BY MAX(created_at) DESC
     LIMIT 40`
  ).all(from, to) as Array<Record<string, unknown>>;

  const utmPerformanceRaw = db.prepare(
    `SELECT
       COALESCE(utm_source, '(none)') AS "source",
       COALESCE(utm_medium, '(none)') AS "medium",
       COALESCE(utm_campaign, '(none)') AS "campaign",
       COUNT(DISTINCT session_id) AS "sessions",
       SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) AS "pageviews"
     FROM site_analytics_events
     WHERE created_at >= ? AND created_at <= ?
       AND (
         (utm_source IS NOT NULL AND utm_source != '')
         OR (utm_medium IS NOT NULL AND utm_medium != '')
         OR (utm_campaign IS NOT NULL AND utm_campaign != '')
         OR (gclid IS NOT NULL AND gclid != '')
         OR (fbclid IS NOT NULL AND fbclid != '')
       )
     GROUP BY 1, 2, 3
     ORDER BY 5 DESC
     LIMIT 40`
  ).all(from, to) as Array<Record<string, unknown>>;

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
    popularPages: mergePathBuckets(
      topBucket(
        `SELECT path AS label, COUNT(*) AS value FROM site_analytics_events
         WHERE event_type = 'pageview' AND created_at >= ? AND created_at <= ?
         GROUP BY path ORDER BY value DESC`, [from, to], 40),
      15,
    ),
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
    utmPerformance: utmPerformanceRaw.map((r) => ({
      source: pickRowStr(r, ['source'], '(none)'),
      medium: pickRowStr(r, ['medium'], '(none)'),
      campaign: pickRowStr(r, ['campaign'], '(none)'),
      sessions: pickRowNum(r, ['sessions']),
      pageviews: pickRowNum(r, ['pageviews']),
    })),
    events: topBucket(
      `SELECT COALESCE(NULLIF(event_name, ''), event_type) AS label, COUNT(*) AS value
       FROM site_analytics_events
       WHERE created_at >= ? AND created_at <= ?
         AND event_type IN ('event', 'pageview', 'heartbeat')
       GROUP BY label ORDER BY value DESC`, [from, to], 25),
    recentSessions: recentSessionsRaw.map((s) => {
      const startedAt = pickRowStr(s, ['startedAt', 'started_at']);
      const lastSeenAt = pickRowStr(s, ['lastSeenAt', 'last_seen_at']);
      const utmSource = pickRowStr(s, ['utmSource', 'utm_source'], '') || null;
      const utmMedium = pickRowStr(s, ['utmMedium', 'utm_medium'], '') || null;
      const utmCampaign = pickRowStr(s, ['utmCampaign', 'utm_campaign'], '') || null;
      let referrerHost = pickRowStr(s, ['referrerHost', 'referrer_host'], '(direct)');
      // Surface UTM as attribution when browser referrer was empty/direct.
      if ((!referrerHost || referrerHost === '(direct)') && utmSource) {
        referrerHost = `utm:${utmSource}${utmMedium ? '/' + utmMedium : ''}`;
      }
      return {
        sessionId: pickRowStr(s, ['sessionId', 'session_id'], 'unknown'),
        startedAt,
        lastSeenAt,
        pageviews: pickRowNum(s, ['pageviews']),
        landingPath: formatAnalyticsPathLabel(pickRowStr(s, ['landingPath', 'landing_path'], '/') || '/'),
        exitPath: formatAnalyticsPathLabel(pickRowStr(s, ['exitPath', 'exit_path'], '/') || '/'),
        referrerHost: referrerHost || '(direct)',
        device: pickRowStr(s, ['device'], 'desktop') || 'desktop',
        country: pickRowStr(s, ['country'], 'نامشخص') || 'نامشخص',
        utmSource,
        utmMedium,
        utmCampaign,
      };
    }),
    savedUtmCampaigns: listUtmCampaigns(),
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
    `SELECT id, session_id AS "sessionId", event_type AS "eventType", event_name AS "eventName",
            path, device, created_at AS "createdAt", meta_json AS "metaJson"
     FROM site_analytics_events
     WHERE created_at >= ? AND created_at <= ?
     ORDER BY id DESC
     LIMIT 60`
  ).all(from, to) as Array<Record<string, unknown>>;

  const lastEventAt = pickRowStr(
    (db.prepare(`SELECT MAX(created_at) AS t FROM site_analytics_events`).get() as Record<string, unknown>) || {},
    ['t'],
  ) || null;

  const lastPageviewAt = pickRowStr(
    (db.prepare(
      `SELECT MAX(created_at) AS t FROM site_analytics_events WHERE event_type = 'pageview'`
    ).get() as Record<string, unknown>) || {},
    ['t'],
  ) || null;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
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
      topPages: mergePathBuckets(
        topBucket(
          `SELECT path AS label, COUNT(*) AS value FROM site_analytics_events
           WHERE event_type = 'pageview' AND created_at >= ? AND created_at <= ?
           GROUP BY path ORDER BY value DESC`,
          [from, to],
          40
        ),
        15
      ),
      devices: deviceRows.map((d) => ({
        label: d.label === 'desktop' ? 'دسکتاپ' : d.label === 'mobile' ? 'موبایل' : d.label === 'tablet' ? 'تبلت' : d.label,
        value: d.value,
      })),
      recentEvents: recentRaw.map((r) => ({
        id: pickRowNum(r, ['id']),
        sessionId: pickRowStr(r, ['sessionId', 'session_id']),
        eventType: pickRowStr(r, ['eventType', 'event_type'], 'pageview'),
        eventName: (() => {
          const v = pickRowField(r, 'eventName', 'event_name');
          return v == null || v === '' ? null : String(v);
        })(),
        path: formatAnalyticsPathLabel(pickRowStr(r, ['path'], '/')),
        device: pickRowStr(r, ['device'], 'desktop') || 'desktop',
        createdAt: pickRowStr(r, ['createdAt', 'created_at']),
        meta: parseMeta(
          (() => {
            const v = pickRowField(r, 'metaJson', 'meta_json');
            return v == null ? null : String(v);
          })()
        ),
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

const PUBLIC_SITE_ORIGIN = 'https://petdate.ir';

export function buildUtmPreviewUrl(input: {
  path?: string | null;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent?: string | null;
  utmTerm?: string | null;
}): string {
  const pathRaw = (input.path || '/').trim() || '/';
  const path = pathRaw.startsWith('/') ? pathRaw.split('?')[0] : `/${pathRaw.split('?')[0]}`;
  const u = new URL(path, PUBLIC_SITE_ORIGIN);
  u.searchParams.set('utm_source', input.utmSource.trim());
  u.searchParams.set('utm_medium', input.utmMedium.trim());
  u.searchParams.set('utm_campaign', input.utmCampaign.trim());
  if (input.utmContent?.trim()) u.searchParams.set('utm_content', input.utmContent.trim());
  if (input.utmTerm?.trim()) u.searchParams.set('utm_term', input.utmTerm.trim());
  return u.toString();
}

export function listUtmCampaigns(): UtmCampaignRecord[] {
  ensureSiteAnalyticsSchema();
  const rows = getDb()
    .prepare(
      `SELECT id, name, path, utm_source AS "utmSource", utm_medium AS "utmMedium",
              utm_campaign AS "utmCampaign", utm_content AS "utmContent", utm_term AS "utmTerm",
              created_at AS "createdAt"
       FROM utm_campaigns
       ORDER BY id DESC
       LIMIT 100`
    )
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => {
    const utmSource = pickRowStr(r, ['utmSource', 'utm_source']);
    const utmMedium = pickRowStr(r, ['utmMedium', 'utm_medium']);
    const utmCampaign = pickRowStr(r, ['utmCampaign', 'utm_campaign']);
    const utmContent = pickRowStr(r, ['utmContent', 'utm_content'], '') || null;
    const utmTerm = pickRowStr(r, ['utmTerm', 'utm_term'], '') || null;
    const path = pickRowStr(r, ['path'], '/') || '/';
    return {
      id: pickRowNum(r, ['id']),
      name: pickRowStr(r, ['name'], 'campaign'),
      path,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      previewUrl: buildUtmPreviewUrl({ path, utmSource, utmMedium, utmCampaign, utmContent, utmTerm }),
      createdAt: pickRowStr(r, ['createdAt', 'created_at']),
    };
  });
}

export function createUtmCampaign(input: {
  name: string;
  path?: string | null;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent?: string | null;
  utmTerm?: string | null;
}): UtmCampaignRecord {
  ensureSiteAnalyticsSchema();
  const name = clampStr(input.name, 120);
  const utmSource = clampStr(input.utmSource, 80);
  const utmMedium = clampStr(input.utmMedium, 80);
  const utmCampaign = clampStr(input.utmCampaign, 120);
  if (!name || !utmSource || !utmMedium || !utmCampaign) {
    throw new Error('نام، source، medium و campaign الزامی است');
  }
  const path = normalizePath(input.path || '/');
  const result = getDb()
    .prepare(
      `INSERT INTO utm_campaigns (name, path, utm_source, utm_medium, utm_campaign, utm_content, utm_term)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      path,
      utmSource,
      utmMedium,
      utmCampaign,
      clampStr(input.utmContent, 120),
      clampStr(input.utmTerm, 120),
    );
  const id = Number(result.lastInsertRowid);
  const created = listUtmCampaigns().find((c) => c.id === id);
  if (created) return created;
  return {
    id,
    name,
    path,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent: clampStr(input.utmContent, 120),
    utmTerm: clampStr(input.utmTerm, 120),
    previewUrl: buildUtmPreviewUrl({
      path,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent: input.utmContent,
      utmTerm: input.utmTerm,
    }),
    createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
  };
}

export function deleteUtmCampaign(id: number): boolean {
  ensureSiteAnalyticsSchema();
  const result = getDb().prepare(`DELETE FROM utm_campaigns WHERE id = ?`).run(id);
  return Number(result.changes) > 0;
}
