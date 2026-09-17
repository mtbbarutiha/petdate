/**
 * Event ticket create / uniqueness / validity.
 * Run: cd packages/api && npx tsx src/services/event-tickets.selftest.ts
 */
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-event-tickets-${process.pid}.db`;
process.env.NODE_ENV = 'test';
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
delete process.env.ALLOW_DEMO_SEEDS;
delete process.env.SEED_DEMO_DATA;

import assert from 'node:assert/strict';
import { makeEventTicketCode } from '@petdate/shared';
import { formatEventTicketSms } from './event-ticket-sms';

async function main() {
  const { getDb, dbService } = await import('../db');
  getDb();
  const {
    ensureEventTicketsSchema,
    issueEventTicketForJoin,
    getEventTicketByCode,
    getEventTicketByUserGame,
    listEventTicketsForUser,
    buildEventTicketPublicView,
  } = await import('./event-tickets');

  ensureEventTicketsSchema();

  const { user: host } = dbService.findOrCreateUser({
    telegramId: `ticket_host_${process.pid}`,
    name: 'علی محمدی',
  });
  assert.ok(host?.id);
  dbService.creditCoins(host.id, 300, undefined, { reason: 'test', skipLedger: true });

  const { user: guest } = dbService.findOrCreateUser({
    telegramId: `ticket_guest_${process.pid}`,
    name: 'میهمان تست',
  });
  assert.ok(guest?.id);
  dbService.creditCoins(guest.id, 100, undefined, { reason: 'test', skipLedger: true });

  dbService.createPet({
    ownerId: guest.id,
    name: 'ریو',
    species: 'dog',
    breed: 'گلدن',
  });

  const when = new Date();
  when.setDate(when.getDate() + 5);
  const created = dbService.createGame({
    title: 'پت دیتینگ باغ گل‌ها کرج',
    gameType: 'pet_dating',
    hostUserId: host.id,
    location: 'باغ گل‌ها، ورودی غربی، کرج',
    province: 'البرز',
    city: 'کرج',
    scheduledAt: when.toISOString(),
    maxPlayers: 50,
    joinFeeCoins: 0,
  });
  assert.ok(created.game?.id, 'game created');
  const gameId = created.game.id;

  const hostTicket = await issueEventTicketForJoin({
    userId: host.id,
    gameId,
    sendSms: false,
  });
  assert.equal(hostTicket.created, true);
  assert.match(hostTicket.ticket.ticketCode, /^PD-KRJ-\d{4}-\d{6}$/);
  assert.equal(hostTicket.ticket.isValid, true);

  const again = await issueEventTicketForJoin({
    userId: host.id,
    gameId,
    sendSms: false,
  });
  assert.equal(again.created, false, 'idempotent per user+game');
  assert.equal(again.ticket.ticketCode, hostTicket.ticket.ticketCode);

  const join = dbService.joinGame(gameId, guest.id);
  assert.ok(!join.error, join.error || 'joined');
  const guestTicket = await issueEventTicketForJoin({
    userId: guest.id,
    gameId,
    sendSms: false,
  });
  assert.equal(guestTicket.created, true);
  assert.notEqual(guestTicket.ticket.ticketCode, hostTicket.ticket.ticketCode, 'unique codes');

  const byCode = getEventTicketByCode(guestTicket.ticket.ticketCode);
  assert.ok(byCode);
  assert.equal(byCode!.ticketCode, guestTicket.ticket.ticketCode);

  const view = buildEventTicketPublicView(guestTicket.ticket);
  assert.ok(view);
  assert.equal(view!.eventTitle, 'پت دیتینگ باغ گل‌ها کرج');
  assert.equal(view!.petName, 'ریو');
  assert.equal(view!.ownerName, 'میهمان تست');
  assert.ok(view!.isValid);

  const mine = listEventTicketsForUser(guest.id);
  assert.equal(mine.length, 1);
  assert.equal(mine[0]!.ticketCode, guestTicket.ticket.ticketCode);

  const expected = makeEventTicketCode({
    id: guestTicket.ticket.id,
    city: 'کرج',
    scheduledAt: when.toISOString(),
  });
  assert.equal(guestTicket.ticket.ticketCode, expected);

  const sms = formatEventTicketSms({
    eventTitle: view!.eventTitle,
    ticketUrl: guestTicket.ticket.publicUrl,
  });
  assert.match(sms, /پت‌دیت/);
  assert.match(sms, /\/t\//);

  // Same user+game lookup
  const ug = getEventTicketByUserGame(guest.id, gameId);
  assert.ok(ug);
  assert.equal(ug!.id, guestTicket.ticket.id);

  console.log('event-tickets.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
