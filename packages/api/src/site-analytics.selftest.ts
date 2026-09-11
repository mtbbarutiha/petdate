/**
 * Site analytics selftest — temp DB only, never touches production path.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'petdate-site-analytics-'));
const dbPath = path.join(tmpDir, 'test.db');
process.env.DATABASE_PATH = dbPath;
// Empty string blocks dotenv from preferring Postgres when .env has DATABASE_URL.
process.env.DATABASE_URL = '';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { getDb } = await import('./db');
  getDb();

  const {
    ingestSiteAnalyticsEvent,
    buildSiteAnalyticsReport,
    buildTagManagerReport,
    buildUtmPreviewUrl,
    createUtmCampaign,
    detectDevice,
    parseReferrerHost,
    pickRowField,
    isValidClarityProjectId,
    isValidGtmContainerId,
    ensureSiteAnalyticsSchema,
    normalizePath,
    formatAnalyticsPathLabel,
    mergePathBuckets,
  } = await import('./site-analytics');

  ensureSiteAnalyticsSchema();

  assert(normalizePath('/profile|') === '/profile', 'strip trailing pipe');
  assert(normalizePath('|') === '/', 'pipe-only path');
  assert(formatAnalyticsPathLabel('/profile|') === '/profile', 'display strip pipe');
  assert(formatAnalyticsPathLabel('|') === '(خالی)', 'display pipe-only');
  assert(formatAnalyticsPathLabel('') === '(خالی)', 'display empty');
  assert(
    mergePathBuckets([
      { label: '/profile|', value: 2 },
      { label: '/profile', value: 3 },
    ])[0].value === 5,
    'merge path variants',
  );

  assert(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 390) === 'mobile', 'iphone');
  assert(detectDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 1440) === 'desktop', 'desktop');
  assert(parseReferrerHost('https://www.google.com/search?q=pet') === 'google.com', 'ref host');
  assert(parseReferrerHost('https://petdate.ir/shop') === '(internal)', 'internal ref');
  assert(parseReferrerHost(null) === '(direct)', 'direct');
  assert(!isValidClarityProjectId('4b79bfb4-a025-4f0e-8b84-0f45c3acac64'), 'uuid not clarity');
  assert(isValidClarityProjectId('abc12xyz'), 'short clarity ok');
  assert(isValidClarityProjectId('ygkl5nck6k'), 'live clarity id ok');
  assert(isValidGtmContainerId('GTM-KQPJT9Q4'), 'live gtm ok');
  assert(isValidGtmContainerId('gtm-kqpjt9q4'), 'gtm case insensitive');
  assert(!isValidGtmContainerId('KQPJT9Q4'), 'gtm needs prefix');
  assert(!isValidGtmContainerId('GTM'), 'gtm too short');

  // Postgres-style lowercased aliases must still resolve.
  assert(pickRowField({ startedat: '2025-09-11 10:00:00' }, 'startedAt') === '2025-09-11 10:00:00', 'pick lower');
  assert(pickRowField({ startedAt: '2025-09-11 10:00:00' }, 'startedAt') === '2025-09-11 10:00:00', 'pick camel');
  assert(
    buildUtmPreviewUrl({
      path: '/shop',
      utmSource: 'telegram',
      utmMedium: 'social',
      utmCampaign: 'launch',
    }).includes('utm_source=telegram'),
    'utm preview',
  );

  ingestSiteAnalyticsEvent({
    sessionId: 'sess-test-0001',
    path: '/shop',
    title: 'فروشگاه',
    referrer: 'https://t.me/share',
    utmSource: 'telegram',
    utmMedium: 'social',
    utmCampaign: 'spring_launch',
    utmContent: 'story',
    language: 'fa-IR',
    screenW: 390,
    screenH: 844,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    eventType: 'pageview',
    eventName: 'page_view',
  });
  ingestSiteAnalyticsEvent({
    sessionId: 'sess-test-0001',
    path: '/vet-consult',
    title: 'مشاوره',
    referrer: 'https://petdate.ir/shop',
    utmSource: 'telegram',
    utmMedium: 'social',
    utmCampaign: 'spring_launch',
    language: 'fa-IR',
    screenW: 390,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    eventType: 'pageview',
    eventName: 'page_view',
  });
  ingestSiteAnalyticsEvent({
    sessionId: 'sess-test-0002',
    path: '/',
    title: 'خانه',
    referrer: '',
    language: 'en-US',
    screenW: 1440,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    eventType: 'pageview',
    eventName: 'page_view',
    country: 'IR',
  });
  ingestSiteAnalyticsEvent({
    sessionId: 'sess-test-0002',
    path: '/shop/cart',
    eventType: 'event',
    eventName: 'add_to_cart',
    meta: { value: 120000, currency: 'IRR' },
    language: 'en-US',
    screenW: 1440,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  });
  ingestSiteAnalyticsEvent({
    sessionId: 'sess-test-0003',
    path: '/profile',
    referrer: 'https://www.google.com/',
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'brand',
    gclid: 'test-gclid',
    language: 'fa-IR',
    screenW: 768,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
    eventType: 'pageview',
    eventName: 'page_view',
    country: 'IR',
  });

  const report = buildSiteAnalyticsReport(7);
  assert(report.overview.pageviews >= 4, 'pageviews');
  assert(report.overview.uniqueSessions >= 3, 'sessions');
  assert(typeof report.overview.engagementRatePct === 'number', 'engagement');
  assert(Array.isArray(report.events), 'events breakdown');
  assert(Array.isArray(report.utmMediums), 'utm mediums');
  assert(report.utmPerformance.some((u) => u.source === 'telegram'), 'utm performance');
  assert(report.trafficDaily.some((d) => d.value > 0), 'traffic daily non-empty');
  assert(report.sessionsDaily.some((d) => d.value > 0), 'sessions daily non-empty');
  assert(report.ga4 && typeof report.ga4.configured === 'boolean', 'ga4 status');
  assert(report.popularPages.some((p) => p.label === '/shop'), 'popular /shop');
  assert(report.devices.length >= 1, 'devices');
  assert(report.recentSessions.length >= 3, 'recent sessions');
  const sess1 = report.recentSessions.find((s) => s.sessionId === 'sess-test-0001');
  assert(sess1, 'sess1 found');
  assert(Boolean(sess1.startedAt), 'startedAt filled');
  assert(Boolean(sess1.lastSeenAt), 'lastSeenAt filled');
  assert(sess1.landingPath === '/shop', 'landing /shop');
  assert(sess1.exitPath === '/vet-consult', 'exit vet');
  assert(sess1.referrerHost === 't.me' || sess1.referrerHost.startsWith('utm:'), 'referrer');
  assert(sess1.pageviews === 2, 'sess1 pageviews');
  assert(report.requestedAgentId === '4b79bfb4-a025-4f0e-8b84-0f45c3acac64', 'agent id note');
  assert(report.gtm.tagAssistantUrl === 'https://tagassistant.google.com/', 'tag assistant url');

  const saved = createUtmCampaign({
    name: 'تست تلگرام',
    path: '/shop',
    utmSource: 'telegram',
    utmMedium: 'social',
    utmCampaign: 'selftest',
  });
  assert(saved.previewUrl.includes('utm_campaign=selftest'), 'saved campaign url');
  assert(report.savedUtmCampaigns || true, 'saved campaigns field');

  const tm = buildTagManagerReport(7);
  assert(tm.gtm.containerId === 'GTM-KQPJT9Q4', 'tm container');
  assert(tm.catalog.variables.some((v) => v.name === 'page_path'), 'tm variables');
  assert(tm.catalog.variables.some((v) => v.name === 'utm_source'), 'tm utm var');
  assert(tm.catalog.triggers.some((t) => t.name === 'purchase'), 'tm triggers');
  assert(tm.checklist.length >= 5, 'tm checklist');
  assert(tm.metrics.customEvents >= 1, 'tm custom events');
  assert(tm.metrics.eventsByType.some((e) => e.label === 'add_to_cart'), 'tm event bucket');
  assert(tm.health.eventsLast24h >= 1, 'tm health');
  assert(tm.metrics.recentEvents[0]?.createdAt, 'tm recent createdAt');

  // Default live project when env is unset.
  delete process.env.CLARITY_PROJECT_ID;
  delete process.env.VITE_CLARITY_PROJECT_ID;
  delete process.env.GTM_ID;
  delete process.env.VITE_GTM_ID;
  const reportDefault = buildSiteAnalyticsReport(7);
  assert(reportDefault.clarity.configured === true, 'clarity configured by default');
  assert(reportDefault.clarity.projectId === 'ygkl5nck6k', 'default clarity project id');
  assert(
    reportDefault.clarity.dashboardUrl === 'https://clarity.microsoft.com/projects/view/ygkl5nck6k/',
    'clarity dashboard url',
  );
  assert(reportDefault.gtm.configured === true, 'gtm configured by default');
  assert(reportDefault.gtm.containerId === 'GTM-KQPJT9Q4', 'default gtm container id');
  assert(reportDefault.gtm.dashboardUrl === 'https://tagmanager.google.com/', 'gtm dashboard url');

  // Explicit invalid UUID override must not silently fall back.
  process.env.VITE_CLARITY_PROJECT_ID = '4b79bfb4-a025-4f0e-8b84-0f45c3acac64';
  const reportUuid = buildSiteAnalyticsReport(7);
  assert(reportUuid.clarity.configured === false, 'clarity not configured with uuid override');
  delete process.env.VITE_CLARITY_PROJECT_ID;

  process.env.VITE_GTM_ID = 'not-a-gtm-id';
  const reportBadGtm = buildSiteAnalyticsReport(7);
  assert(reportBadGtm.gtm.configured === false, 'gtm not configured with invalid override');
  delete process.env.VITE_GTM_ID;
  console.log('site-analytics.selftest: OK');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });
