import { createHash, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { authenticateAdminRequest } from './admin-auth';
import { infra } from './config/infra';

function tokensEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

function headerToken(req: { header?: (name: string) => string | undefined; headers?: Request['headers'] }): string {
  const fromFn = req.header?.('x-petdate-bot-token');
  const raw = fromFn ?? req.headers?.['x-petdate-bot-token'];
  return String(Array.isArray(raw) ? raw[0] : raw ?? '').trim();
}

/** Internal Telegram bot (X-PetDate-Bot-Token === TELEGRAM_BOT_TOKEN). */
export function isInternalBot(req: {
  header?: (name: string) => string | undefined;
  headers?: Request['headers'];
}): boolean {
  const expected = (infra.telegram.botToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const got = headerToken(req);
  if (!expected || !got) return false;
  return tokensEqual(expected, got);
}

/** Bot token or admin password — staff-only mutations (payments, moderation). */
export function requireTrustedStaff(req: Request, res: Response, next: NextFunction): void {
  if (isInternalBot(req) || authenticateAdminRequest(req)) {
    next();
    return;
  }
  res.status(401).json({ error: 'وارد نشده‌اید' });
}
