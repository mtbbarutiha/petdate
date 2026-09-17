/**
 * Event tickets API + public HTML page (/t/:code).
 */
import { Router } from 'express';
import { normalizeEventTicketCode } from '@petdate/shared';
import { getUserFromBearer } from '../services/web-otp';
import {
  buildEventTicketPublicView,
  getEventTicketByCode,
  listEventTicketsForUser,
} from '../services/event-tickets';
import { eventTicketQrPngBuffer, renderEventTicketHtml } from '../services/event-ticket-html';

export const eventTicketsApiRouter = Router();
export const eventTicketWebRouter = Router();

eventTicketsApiRouter.get('/mine', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session?.user?.id) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const includeExpired =
    String(req.query.includeExpired || '') === '1' ||
    String(req.query.includeExpired || '').toLowerCase() === 'true';
  const tickets = listEventTicketsForUser(session.user.id, { includeExpired });
  const views = tickets
    .map((t) => buildEventTicketPublicView(t))
    .filter((v): v is NonNullable<typeof v> => Boolean(v));
  res.json({ ok: true, tickets: views });
});

eventTicketsApiRouter.get('/:code', (req, res) => {
  const code = normalizeEventTicketCode(req.params.code) || String(req.params.code || '').trim();
  const ticket = getEventTicketByCode(code);
  if (!ticket) {
    res.status(404).json({ error: 'بلیط پیدا نشد' });
    return;
  }
  const view = buildEventTicketPublicView(ticket);
  if (!view) {
    res.status(404).json({ error: 'ایونت بلیط پیدا نشد' });
    return;
  }
  res.json({ ok: true, ticket: view });
});

eventTicketsApiRouter.get('/:code/qr.png', async (req, res) => {
  const code = normalizeEventTicketCode(req.params.code) || String(req.params.code || '').trim();
  const ticket = getEventTicketByCode(code);
  if (!ticket) {
    res.status(404).json({ error: 'بلیط پیدا نشد' });
    return;
  }
  try {
    const buf = await eventTicketQrPngBuffer(ticket.qrPayload || ticket.publicUrl);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buf);
  } catch (err) {
    console.warn('ticket QR failed:', (err as Error).message);
    res.status(500).json({ error: 'ساخت QR ناموفق بود' });
  }
});

eventTicketWebRouter.get('/:code', async (req, res) => {
  const code = normalizeEventTicketCode(req.params.code) || String(req.params.code || '').trim();
  const ticket = getEventTicketByCode(code);
  if (!ticket) {
    res.status(404).type('html').send(`<!DOCTYPE html><html lang="fa" dir="rtl"><body style="font-family:Tahoma;text-align:center;padding:48px"><h1>بلیط پیدا نشد</h1><p><a href="/events">ایونت‌ها</a></p></body></html>`);
    return;
  }
  const view = buildEventTicketPublicView(ticket);
  if (!view) {
    res.status(404).type('html').send(`<!DOCTYPE html><html lang="fa" dir="rtl"><body style="font-family:Tahoma;text-align:center;padding:48px"><h1>ایونت بلیط پیدا نشد</h1></body></html>`);
    return;
  }
  try {
    const html = await renderEventTicketHtml(view);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.send(html);
  } catch (err) {
    console.warn('ticket HTML failed:', (err as Error).message);
    res.status(500).json({ error: 'نمایش بلیط ناموفق بود' });
  }
});
