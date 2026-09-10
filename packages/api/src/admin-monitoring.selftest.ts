/**
 * Selftest for admin live monitoring classifiers (no network / no VPS).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  checkDown,
  checkNotConfigured,
  checkUp,
  checkWarn,
  classifyDisk,
  classifyElasticsearchHealth,
  classifyHttpResult,
  isNonCriticalCheck,
  sqliteFileCheck,
} from './admin-monitoring';

const GB = 1024 ** 3;
const MB = 1024 ** 2;

assert.equal(checkUp('ok').status, 'up');
assert.equal(checkUp('ok').ok, true);
assert.equal(checkWarn('slow').status, 'warn');
assert.equal(checkWarn('slow').ok, true);
assert.equal(checkDown('fail').status, 'down');
assert.equal(checkDown('fail').ok, false);
assert.equal(checkNotConfigured().status, 'not_configured');

assert.equal(classifyDisk(10 * GB, 50 * GB).status, 'up');
assert.equal(classifyDisk(4 * GB, 50 * GB).status, 'warn');
assert.equal(classifyDisk(8 * GB, 50 * GB).status, 'up');
assert.equal(classifyDisk(7 * GB, 50 * GB).status, 'warn');
assert.equal(classifyDisk(400 * MB, 50 * GB).status, 'down');
assert.equal(classifyDisk(3 * GB, 50 * GB).status, 'warn');
assert.equal(classifyDisk(2 * GB, 50 * GB).status, 'down');

assert.equal(classifyElasticsearchHealth('green', 'es').status, 'up');
assert.equal(classifyElasticsearchHealth('yellow', 'es').status, 'warn');
assert.equal(classifyElasticsearchHealth('red', 'es').status, 'down');

assert.equal(classifyHttpResult('site', 200, 200).status, 'up');
assert.equal(classifyHttpResult('site', 200, 1600).status, 'warn');
assert.equal(classifyHttpResult('site', 503, 100).status, 'down');

assert.equal(isNonCriticalCheck('elasticsearch', true), true);
assert.equal(isNonCriticalCheck('smtp', true), true);
assert.equal(isNonCriticalCheck('sms', false), true);
assert.equal(isNonCriticalCheck('postgres', false), true);
assert.equal(isNonCriticalCheck('postgres', true), false);
assert.equal(isNonCriticalCheck('redis', true), false);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'petdate-mon-'));
const goodDb = path.join(tmp, 'good.db');
fs.writeFileSync(goodDb, 'sqlite');
assert.equal(sqliteFileCheck(goodDb, 'SQLite').status, 'up');

const emptyDb = path.join(tmp, 'empty.db');
fs.writeFileSync(emptyDb, '');
assert.equal(sqliteFileCheck(emptyDb, 'SQLite').status, 'warn');

assert.equal(sqliteFileCheck(path.join(tmp, 'missing.db'), 'SQLite').status, 'down');

fs.rmSync(tmp, { recursive: true, force: true });

console.log('admin-monitoring.selftest: OK');
