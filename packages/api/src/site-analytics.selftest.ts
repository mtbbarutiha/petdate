/**
 * Site analytics selftest — temp DB only, never touches production path.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'petdate-site-analytics-'));
const dbPath = path.join(tmpDir, 'test.db');
process.env.DATABASE_PATH = dbPath;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { getDb } = await import('./db');
  getDb();

  const {
    ingestSiteAnalyticsEvent,
    buildSiteAnalyticsReport,
    detectDevice,
    parseReferrerHost,
    isValidClarityProjectId,
    ensureSiteAnalyticsSchema,
  } = await import('./site-analytics');

  ensureSiteAnalyticsSchema();

  assert(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 390) === 'mobile', 'iphone');
  assert(detectDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 1440) === 'desktop', 'desktop');
  assert(parseReferrerHost('https://www.google.com/search?q=pet') === 'google.com', 'ref host');
  assert(parseReferrerHost('https://petdate.ir/shop') === '(internal)', 'internal ref');
  assert(parseReferrerHost(null) === '(direct)', 'direct');
  assert(!isValidClarityProjectId('4b79bfb4-a025-4f0e-8b84-0f45c3acac64'), 'uuid not clarity');
  assert(isValidClarityProjectId('abc12xyz'), 'short clarity ok');

  ingestSiteAnalyticsEvent({
    sessionId: 'sess-test-0001',
    path: '/shop',
    title: 'فروشگاه',
    referrer: 'https://t.me/share',
    utmSource: 'telegram',
    language: 'fa-IR',
    screenW: 390,
    screenH: 844,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    eventType: 'pageview',
  });
  ingestSiteAnalyticsEvent({
    sessionId: 'sess-test-0001',
    path: '/vet-consult',
    title: 'مشاوره',
    referrer: 'https://petdate.ir/shop',
    language: 'fa-IR',
    screenW: 390,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    eventType: 'pageview',
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
    country: 'IR',
  });

  const report = buildSiteAnalyticsReport(7);
  assert(report.overview.pageviews >= 3, 'pageviews');
  assert(report.overview.uniqueSessions >= 2, 'sessions');
  assert(report.popularPages.some((p) => p.label === '/shop'), 'popular /shop');
  assert(report.devices.length >= 1, 'devices');
  assert(report.recentSessions.length >= 2, 'recent sessions');
  assert(report.requestedAgentId === '4b79bfb4-a025-4f0e-8b84-0f45c3acac64', 'agent id note');
  assert(report.clarity.configured === false, 'clarity not configured with uuid');

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
