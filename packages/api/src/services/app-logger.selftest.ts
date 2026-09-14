/**
 * Pure filters for admin «لاگ خطاها» noise — no DB / network.
 */
import assert from 'node:assert/strict';
import { clientStatusForDbError, isBenignTelegramWarn, isExpectedHttpNoise } from './app-logger';

assert.equal(
  isBenignTelegramWarn('telegram sendMessage failed: Bad Request: chat not found'),
  true,
  'chat not found is benign'
);
assert.equal(
  isBenignTelegramWarn('telegram sendDocument upload failed: Bad Request: chat not found'),
  true,
  'document chat not found benign'
);
assert.equal(
  isBenignTelegramWarn('telegram sendMessage failed: Forbidden: bot was blocked by the user'),
  true,
  'blocked by user benign'
);
assert.equal(
  isBenignTelegramWarn('telegram sendMessage failed: Bad Request: something else weird'),
  false,
  'unknown telegram failure still actionable'
);
assert.equal(isBenignTelegramWarn('prescription render failed: boom'), false, 'non-tg fail');

assert.equal(isExpectedHttpNoise('GET', '/api/status', 404), true, 'scanner /api/status');
assert.equal(isExpectedHttpNoise('GET', '/api/v1/health', 404), true, 'scanner health');
assert.equal(isExpectedHttpNoise('GET', '/api/aws/index.js?v=1', 404), true, 'scanner aws');
assert.equal(isExpectedHttpNoise('POST', '/api/admin/login', 404), true, 'legacy admin login');
assert.equal(
  isExpectedHttpNoise('GET', '/api/admin/crm/ticketing/bundle', 404),
  false,
  'real admin 404 kept'
);
assert.equal(
  isExpectedHttpNoise('POST', '/api/consultations/quick-connect', 409),
  true,
  'quick-connect 409 expected'
);
assert.equal(
  isExpectedHttpNoise('POST', '/api/auth/otp/request', 400),
  true,
  'otp request 400 already covered by sms logs / client validation'
);
assert.equal(
  isExpectedHttpNoise('POST', '/api/admin/hr/rbac/accounts', 400),
  true,
  'rbac account validation 400 is form noise'
);
assert.equal(
  isExpectedHttpNoise('GET', '/api/admin/hr/ats/meta', 500),
  false,
  '500s always logged'
);
assert.equal(isExpectedHttpNoise('GET', '/favicon.ico', 404), true, 'non-api 404');

assert.equal(
  clientStatusForDbError('invalid input syntax for type bigint: "NaN"'),
  400,
  'Postgres NaN bigint is 400 not 500'
);
assert.equal(clientStatusForDbError('invalid numeric id'), 400, 'invalid numeric id is 400');
assert.equal(clientStatusForDbError('relation "games" does not exist'), null, 'other DB errors stay 500');

console.log('app-logger.selftest: ok');
