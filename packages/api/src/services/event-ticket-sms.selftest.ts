/**
 * Offline checks for event-ticket SMS copy.
 * Run: npx tsx packages/api/src/services/event-ticket-sms.selftest.ts
 */
import assert from 'node:assert/strict';
import { formatEventTicketSms } from './event-ticket-sms';

const body = formatEventTicketSms({
  eventTitle: 'پت دیتینگ باغ گل‌ها کرج',
  ticketUrl: 'https://petdate.ir/t/PD-KRJ-2026-000154',
});
assert.match(body, /پت‌دیت/);
assert.match(body, /بلیط ایونت/);
assert.match(body, /باغ گل/);
assert.match(body, /https:\/\/petdate\.ir\/t\/PD-KRJ-2026-000154/);
assert.doesNotMatch(body, /OTP|کد تأیید/);

console.log('event-ticket-sms.selftest: ok');
