/**
 * Minimal offline checks for phone normalize + Candoo request shape.
 * Run: npx tsx packages/api/src/services/candoo.selftest.ts
 */
import { formatIranMobileDisplay, normalizeIranMobile } from '@petdate/shared';
import {
  buildSendPayload,
  CANDOO_BALANCE_TIMEOUT_MS,
  CANDOO_SEND_TIMEOUT_MS,
  isCandooSendAccepted,
  isCandooSrcRejection,
  parseCandooBalanceBody,
  sanitizeCandooPublicError,
} from './candoo';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const cases: Array<[string, string | null]> = [
  ['09121234567', '989121234567'],
  ['+989121234567', '989121234567'],
  ['989121234567', '989121234567'],
  ['9121234567', '989121234567'],
  ['۰۹۱۲۱۲۳۴۵۶۷', '989121234567'],
  ['02188776655', null],
  ['123', null],
];

for (const [raw, expected] of cases) {
  const got = normalizeIranMobile(raw);
  assert(got === expected, `normalize(${raw}) => ${got}, expected ${expected}`);
}

assert(formatIranMobileDisplay('989121234567') === '09121234567', 'display format');

const payload = buildSendPayload([
  {
    srcNum: '989999176033',
    recipient: '989121234567',
    body: 'کد تایید همبازی: 12345',
    type: 1,
    retryCount: 2,
    validityPeriod: 300,
    customerId: 42,
  },
]);

assert(Array.isArray(payload) && payload.length === 1, 'payload is array');
assert(payload[0]!.srcNum === '989999176033', 'srcNum');
assert(payload[0]!.recipient === '989121234567', 'recipient');
assert(payload[0]!.type === 1, 'OTP type=1');
assert(payload[0]!.body.includes('12345'), 'body has code');

assert(
  isCandooSendAccepted([
    { messageId: 1, status: 'ACCEPTED', statusCode: 200 },
  ]),
  'accepted payload'
);
assert(!isCandooSendAccepted([{ status: 'REJECTED', statusCode: 400 }]), 'rejected payload');
assert(!isCandooSendAccepted([]), 'empty payload');
assert(
  isCandooSrcRejection([{ status: 'REJECTED', statusCode: -4, messageId: 0 }]),
  'src rejection -4'
);
assert(
  !isCandooSrcRejection([{ status: 'ACCEPTED', statusCode: 200 }]),
  'accepted is not src rejection'
);

assert(
  CANDOO_BALANCE_TIMEOUT_MS > 0 && CANDOO_BALANCE_TIMEOUT_MS <= 10_000,
  'balance timeout must stay under nginx upstream limits'
);
assert(
  CANDOO_SEND_TIMEOUT_MS >= CANDOO_BALANCE_TIMEOUT_MS && CANDOO_SEND_TIMEOUT_MS <= 30_000,
  'send timeout must be finite and >= balance timeout'
);

assert(parseCandooBalanceBody('8728500') === 8728500, 'plain balance');
assert(parseCandooBalanceBody(' 1000.5 ') === 1000.5, 'decimal balance');
assert(parseCandooBalanceBody('"42"') === 42, 'json string number');
assert(parseCandooBalanceBody('{"balance":991}') === 991, 'json balance field');
assert(parseCandooBalanceBody('{"credit":12}') === 12, 'json credit field');
assert(parseCandooBalanceBody('not-a-balance') == null, 'reject garbage');
assert(
  !sanitizeCandooPublicError('fail Candoo_ABCDEFGHIJKLMNOPQRSTUVWXYZ').includes('Candoo_ABCDEF'),
  'sanitize candoo-like tokens'
);
assert(
  sanitizeCandooPublicError('کلید API نامعتبر (401)') === 'کلید API نامعتبر (401)',
  'keep safe errors'
);

console.log('candoo.selftest: OK');
