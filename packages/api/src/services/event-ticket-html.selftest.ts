/**
 * HTML ticket + QR wiring (no DB).
 * Run: npx tsx packages/api/src/services/event-ticket-html.selftest.ts
 */
import assert from 'node:assert/strict';
import { renderEventTicketHtml, eventTicketQrSvg } from './event-ticket-html';
import type { EventTicketPublicView } from '@petdate/shared';

const view: EventTicketPublicView = {
  id: 154,
  ticketCode: 'PD-KRJ-2026-000154',
  userId: 1,
  gameId: 2,
  petId: 3,
  qrPayload: 'https://petdate.ir/t/PD-KRJ-2026-000154',
  status: 'valid',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  createdAt: new Date().toISOString(),
  publicPath: '/t/PD-KRJ-2026-000154',
  publicUrl: 'https://petdate.ir/t/PD-KRJ-2026-000154',
  isValid: true,
  eventTitle: 'پت دیتینگ باغ گل‌ها کرج',
  eventScheduledAt: '2026-09-28T05:30:00.000Z',
  eventLocation: 'باغ گل‌ها، ورودی غربی، کرج',
  eventCity: 'کرج',
  eventProvince: 'البرز',
  currentPlayers: 12,
  maxPlayers: 50,
  ownerName: 'علی محمدی',
  petName: 'ریو',
  petSpecies: 'dog',
  petSpeciesLabel: 'سگ',
  ticketTypeLabel: '۱ صاحب + ۱ پت',
};

async function main() {
  const svg = await eventTicketQrSvg(view.publicUrl, 120);
  assert.match(svg, /<svg/i);

  const html = await renderEventTicketHtml(view);
  assert.match(html, /دعوت‌نامه اختصاصی/);
  assert.match(html, /PLAY • MEET • FRIENDS/);
  assert.match(html, /PD-KRJ-2026-000154/);
  assert.match(html, /ریو/);
  assert.match(html, /علی محمدی/);
  assert.match(html, /۱ صاحب \+ ۱ پت/);
  assert.match(html, /این بلیط مختص شماست/);
  assert.match(html, /لطفاً هنگام ورود QR را اسکن کنید/);
  assert.match(html, /آماده بازی؟/);
  assert.match(html, /petdate\.ir/);
  assert.match(html, /QR Ticket/);
  assert.match(html, /data-ticket-code="PD-KRJ-2026-000154"/);

  console.log('event-ticket-html.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
