/**
 * Pure filters for admin «لاگ خطاها» noise — no DB / network.
 */
import assert from 'node:assert/strict';
import { isBenignTelegramWarn, isExpectedHttpNoise } from './app-logger';

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
  isExpectedHttpNoise('GET', '/api/admin/hr/ats/meta', 500),
  false,
  '500s always logged'
);
assert.equal(isExpectedHttpNoise('GET', '/favicon.ico', 404), true, 'non-api 404');

console.log('app-logger.selftest: ok');
