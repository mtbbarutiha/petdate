/**
 * Shared error catalog — FA/EN log + upload copy.
 * Run: npx tsx packages/shared/src/error-catalog.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  extractErrorCode,
  parseHttpLogMessage,
  translateAppLogMessage,
  uploadErrorCopy,
} from './error-catalog.ts';

assert.equal(uploadErrorCopy('INVALID_IMAGE', 'fa').includes('عکس'), true);
assert.equal(uploadErrorCopy('INVALID_MIME', 'fa').includes('عکس'), true);
assert.equal(uploadErrorCopy('FILE_TOO_LARGE', 'fa').includes('۸'), true);
assert.match(uploadErrorCopy('INVALID_IMAGE', 'en'), /image|photo/i);

assert.equal(extractErrorCode('materialize telegram avatar failed: INVALID_IMAGE'), 'INVALID_IMAGE');
assert.equal(extractErrorCode('boom FILE_TOO_LARGE extra'), 'FILE_TOO_LARGE');
assert.equal(extractErrorCode('hello world'), null);

const http = parseHttpLogMessage('HTTP 400 POST /api/consultations/quick-connect');
assert.ok(http);
assert.equal(http!.status, 400);
assert.equal(http!.method, 'POST');
assert.equal(http!.path, '/api/consultations/quick-connect');

const avatar = translateAppLogMessage({
  message: 'materialize telegram avatar failed: INVALID_IMAGE',
});
assert.match(avatar.titleFa, /آواتار|تلگرام|عکس/);
assert.match(avatar.titleEn, /Telegram|avatar|image/i);
assert.equal(avatar.detail, 'materialize telegram avatar failed: INVALID_IMAGE');
assert.equal(avatar.code, 'INVALID_IMAGE');
assert.equal(avatar.translated, true);

const consult = translateAppLogMessage({
  message: 'HTTP 400 POST /api/consultations/quick-connect',
  path: '/api/consultations/quick-connect',
  method: 'POST',
  statusCode: 400,
});
assert.match(consult.titleFa, /نامعتبر|مشاوره/);
assert.match(consult.titleEn, /Invalid|Consult|quick-connect/i);
assert.equal(consult.detail, 'HTTP 400 POST /api/consultations/quick-connect');

const alreadyFa = translateAppLogMessage({ message: 'خطای داخلی سرور' });
assert.equal(alreadyFa.titleFa, 'خطای داخلی سرور');
assert.equal(alreadyFa.detail, null);

const gamesList = translateAppLogMessage({
  message: 'HTTP 500 GET /api/games/list',
  path: '/api/games/list',
  method: 'GET',
  statusCode: 500,
});
assert.match(gamesList.titleFa, /فهرست بازی|بازی/);
assert.match(gamesList.titleFa, /\/chats|هم بازی/);

console.log('error-catalog.selftest: ok');
