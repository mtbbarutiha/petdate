import { Router } from 'express';
import { rateLimit } from '../middleware/rate-limit';
import {
  getSiteAnalyticsPublicConfig,
  ingestSiteAnalyticsEvent,
  type SiteAnalyticsEventInput,
} from '../site-analytics';

export const analyticsRouter = Router();

const collectLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  message: 'تعداد رویدادهای آنالیتیکس زیاد است.',
});

/** Prefer edge geo headers (Cloudflare / common CDN) when nginx forwards them. */
export function countryFromReq(req: { headers: Record<string, unknown> }): string | null {
  const headers = req.headers;
  const candidates = [
    headers['cf-ipcountry'],
    headers['CF-IPCountry'],
    headers['x-country-code'],
    headers['x-vercel-ip-country'],
    headers['cloudfront-viewer-country'],
    headers['x-appengine-country'],
  ];
  for (const raw of candidates) {
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (typeof v !== 'string') continue;
    const t = v.trim().toUpperCase();
    if (!t || t === 'XX' || t === 'ZZ' || t === 'T1') continue;
    if (/^[A-Z]{2}$/.test(t) || t === 'IR') return t.slice(0, 8);
  }
  return null;
}

function strField(body: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = body[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}

/** Public runtime config for GA4 / GTM / Clarity (no secrets). */
analyticsRouter.get('/config', (_req, res) => {
  res.json(getSiteAnalyticsPublicConfig());
});

analyticsRouter.post('/collect', collectLimit, (req, res) => {
  try {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const input: SiteAnalyticsEventInput = {
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : '',
      path: typeof body.path === 'string' ? body.path : '/',
      title: typeof body.title === 'string' ? body.title : null,
      referrer: typeof body.referrer === 'string' ? body.referrer : null,
      utmSource: strField(body, 'utmSource', 'utm_source'),
      utmMedium: strField(body, 'utmMedium', 'utm_medium'),
      utmCampaign: strField(body, 'utmCampaign', 'utm_campaign'),
      utmContent: strField(body, 'utmContent', 'utm_content'),
      utmTerm: strField(body, 'utmTerm', 'utm_term'),
      gclid: strField(body, 'gclid'),
      fbclid: strField(body, 'fbclid'),
      language: typeof body.language === 'string' ? body.language : null,
      screenW: typeof body.screenW === 'number' ? body.screenW : null,
      screenH: typeof body.screenH === 'number' ? body.screenH : null,
      userAgent:
        typeof body.userAgent === 'string'
          ? body.userAgent
          : typeof req.headers['user-agent'] === 'string'
            ? req.headers['user-agent']
            : null,
      country: typeof body.country === 'string' ? body.country : null,
      eventType:
        body.eventType === 'heartbeat' || body.eventType === 'event' ? body.eventType : 'pageview',
      eventName: typeof body.eventName === 'string' ? body.eventName : null,
      meta:
        body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)
          ? (body.meta as Record<string, unknown>)
          : null,
    };

    if (!input.language && typeof req.headers['accept-language'] === 'string') {
      input.language = req.headers['accept-language'].split(',')[0]?.trim().slice(0, 32) || null;
    }

    const result = ingestSiteAnalyticsEvent(input, { countryHint: countryFromReq(req) });
    res.status(202).json({ ok: true, id: result.id });
  } catch (err) {
    res.status(400).json({ ok: false, error: (err as Error).message || 'invalid' });
  }
});
