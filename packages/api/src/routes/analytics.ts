import { Router } from 'express';
import { rateLimit } from '../middleware/rate-limit';
import { ingestSiteAnalyticsEvent, type SiteAnalyticsEventInput } from '../site-analytics';

export const analyticsRouter = Router();

const collectLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  message: 'تعداد رویدادهای آنالیتیکس زیاد است.',
});

function countryFromReq(req: { headers: Record<string, unknown> }): string | null {
  const cf = req.headers['cf-ipcountry'];
  if (typeof cf === 'string' && cf.trim() && cf.trim().toUpperCase() !== 'XX') {
    return cf.trim().toUpperCase().slice(0, 8);
  }
  return null;
}

analyticsRouter.post('/collect', collectLimit, (req, res) => {
  try {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const input: SiteAnalyticsEventInput = {
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : '',
      path: typeof body.path === 'string' ? body.path : '/',
      title: typeof body.title === 'string' ? body.title : null,
      referrer: typeof body.referrer === 'string' ? body.referrer : null,
      utmSource: typeof body.utmSource === 'string' ? body.utmSource : null,
      utmMedium: typeof body.utmMedium === 'string' ? body.utmMedium : null,
      utmCampaign: typeof body.utmCampaign === 'string' ? body.utmCampaign : null,
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
