/**
 * Run: npx tsx packages/shared/src/event-ticket.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  eventCityTicketCode,
  eventTicketExpiresAtIso,
  eventTicketPublicPath,
  eventTicketPublicUrl,
  isEventTicketCurrentlyValid,
  makeEventTicketCode,
  normalizeEventTicketCode,
  padTicketSeq,
} from './event-ticket';

assert.equal(eventCityTicketCode('کرج'), 'KRJ');
assert.equal(eventCityTicketCode('تهران'), 'THR');
assert.equal(eventCityTicketCode(undefined, 'مشهد'), 'MSH');
assert.equal(eventCityTicketCode('UnknownTown'), 'UNK');
assert.equal(eventCityTicketCode(''), 'EVT');
assert.equal(eventCityTicketCode(undefined, undefined), 'EVT');
assert.equal(padTicketSeq(154), '000154');
assert.equal(
  makeEventTicketCode({ id: 154, city: 'کرج', scheduledAt: '2026-09-28T09:00:00.000Z' }),
  'PD-KRJ-2026-000154'
);
assert.equal(normalizeEventTicketCode('pd-krj-2026-154'), 'PD-KRJ-2026-000154');
assert.equal(normalizeEventTicketCode('nope'), null);
assert.equal(eventTicketPublicPath('PD-KRJ-2026-000154'), '/t/PD-KRJ-2026-000154');
assert.equal(
  eventTicketPublicUrl('PD-KRJ-2026-000154', 'https://petdate.ir'),
  'https://petdate.ir/t/PD-KRJ-2026-000154'
);

const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
assert.equal(
  isEventTicketCurrentlyValid({
    status: 'valid',
    gameStatus: 'open',
    scheduledAt: future,
    expiresAt: eventTicketExpiresAtIso(future),
  }),
  true
);
assert.equal(
  isEventTicketCurrentlyValid({
    status: 'valid',
    gameStatus: 'cancelled',
    scheduledAt: future,
  }),
  false
);
assert.equal(
  isEventTicketCurrentlyValid({
    status: 'expired',
    gameStatus: 'open',
    scheduledAt: future,
  }),
  false
);
const past = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
assert.equal(
  isEventTicketCurrentlyValid({
    status: 'valid',
    gameStatus: 'open',
    scheduledAt: past,
    expiresAt: eventTicketExpiresAtIso(past),
  }),
  false
);

console.log('event-ticket.selftest: ok');
