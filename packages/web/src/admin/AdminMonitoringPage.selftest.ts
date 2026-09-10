/**
 * Selftest for admin monitoring UI tone mapping.
 */
import assert from 'node:assert/strict';
import { checkTone } from './monitoringTone';

assert.equal(checkTone({ ok: true, status: 'up' }), 'ok');
assert.equal(checkTone({ ok: true, status: 'warn' }), 'warn');
assert.equal(checkTone({ ok: false, status: 'down' }), 'bad');
assert.equal(checkTone({ ok: true, status: 'not_configured' }), 'idle');
assert.equal(checkTone({ ok: true }), 'ok');
assert.equal(checkTone({ ok: false }), 'bad');

console.log('AdminMonitoringPage.selftest: OK');
