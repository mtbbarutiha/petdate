/**
 * Persian admin log message mapping — no DOM / network.
 * Run: npx tsx packages/web/src/admin/adminLogMessageFa.selftest.ts
 */
import assert from 'node:assert/strict';
import { formatAdminLogMessageFa, parseHttpLogMessage } from './adminLogMessageFa.ts';

const http = parseHttpLogMessage('HTTP 500 GET /api/games/list');
assert.ok(http);
assert.equal(http!.status, 500);
assert.equal(http!.method, 'GET');
assert.equal(http!.path, '/api/games/list');

const gamesList = formatAdminLogMessageFa({
  message: 'HTTP 500 GET /api/games/list',
  path: '/api/games/list',
  method: 'GET',
  statusCode: 500,
});
assert.match(gamesList.title, /فهرست بازی|بازی/);
assert.match(gamesList.title, /\/chats|هم بازی/);
assert.equal(gamesList.detail, 'HTTP 500 GET /api/games/list');

const gamesAbc = formatAdminLogMessageFa({
  message: 'HTTP 500 GET /api/games/abc',
  path: '/api/games/abc',
  method: 'GET',
  statusCode: 500,
});
assert.match(gamesAbc.title, /بازی|شناسه/);

const nan = formatAdminLogMessageFa({
  message: 'invalid input syntax for type bigint: "NaN"',
  path: '/api/games/list',
  method: 'GET',
  statusCode: 500,
});
assert.match(nan.title, /شناسه|NaN/);
assert.ok(nan.detail);

const avatar401 = formatAdminLogMessageFa({
  message: 'HTTP 401 GET /api/auth/avatar/1/x.jpg',
  path: '/api/auth/avatar/1/x.jpg',
  method: 'GET',
  statusCode: 401,
});
assert.match(avatar401.title, /آواتار|احراز/);

const appt400 = formatAdminLogMessageFa({
  message: 'HTTP 400 POST /api/appointments',
  path: '/api/appointments',
  method: 'POST',
  statusCode: 400,
});
assert.match(appt400.title, /نوبت/);

const generic404 = formatAdminLogMessageFa({
  message: 'HTTP 404 GET /api/shop/widgets',
  statusCode: 404,
});
assert.match(generic404.title, /یافت نشد|فروشگاه/);

const alreadyFa = formatAdminLogMessageFa({ message: 'خطای داخلی سرور' });
assert.equal(alreadyFa.title, 'خطای داخلی سرور');
assert.equal(alreadyFa.detail, null);

console.log('adminLogMessageFa.selftest: ok');
