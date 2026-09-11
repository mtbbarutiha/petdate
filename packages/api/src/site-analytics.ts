/**
 * First-party site analytics — pageviews / sessions for public petdate.ir
 * and admin گزارشات سایت. Additive SQLite tables only (never wipe).
 */
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
    note: string;
  };
  requestedAgentId: string | null;
};

const AGENT_UUID = '4b79bfb4-a025-4f0e-8b84-0f45c3acac64';

/** Live Microsoft Clarity project for petdate.ir (short id — not the rejected agent UUID). */
export const DEFAULT_CLARITY_PROJECT_ID = 'ygkl5nck6k';

/** Live Google Tag Manager container for petdate.ir. */
export const DEFAULT_GTM_ID = 'GTM-KQPJT9Q4';

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
  `);
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
  // Explicit invalid override (e.g. leftover UUID) — do not silently fall back.
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
    dashboardUrl: ok ? `https://clarity.microsoft.com/projects/view/${raw}/` : null,
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

function gtmConfig(): SiteAnalyticsReport['gtm'] {
  const raw = resolveGtmId();
  const ok = Boolean(raw);
  return {
    configured: ok,
    containerId: ok ? raw : null,
    dashboardUrl: ok ? 'https://tagmanager.google.com/' : null,
    note: ok
      ? `کانتینر GTM (${raw}) پیکربندی شده — فقط روی مسیرهای عمومی بارگذاری می‌شود (نه /admin).`
      : 'شناسهٔ GTM نامعتبر است. مقدار VITE_GTM_ID را به صورت GTM-XXXX تنظیم کنید.',
  };
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
        screen_w, screen_h, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      ua
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
    requestedAgentId: AGENT_UUID,
  };
}
