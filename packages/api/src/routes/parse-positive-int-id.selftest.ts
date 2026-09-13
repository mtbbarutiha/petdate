/**
 * parsePositiveIntId — reject NaN / empty / undefined / non-integers before SQL.
 * Run: cd packages/api && npx tsx src/routes/parse-positive-int-id.selftest.ts
 */
import assert from 'node:assert/strict';
import { parsePositiveIntId } from './parse-positive-int-id.ts';

const reject: Array<[unknown, string]> = [
  [NaN, 'NaN number'],
  ['NaN', 'NaN string'],
  ['', 'empty'],
  ['   ', 'whitespace'],
  [undefined, 'undefined'],
  ['undefined', 'undefined string'],
  [null, 'null'],
  ['null', 'null string'],
  ['abc', 'non-numeric'],
  ['list', 'list token'],
  [0, 'zero'],
  [-3, 'negative'],
  [1.5, 'float'],
  ['1.5', 'float string'],
  ['1e-1', 'scientific non-int'],
  [Infinity, 'Infinity'],
  ['Infinity', 'Infinity string'],
];

for (const [raw, label] of reject) {
  assert.equal(parsePositiveIntId(raw), null, label);
}

assert.equal(parsePositiveIntId(1), 1, 'int');
assert.equal(parsePositiveIntId('42'), 42, 'numeric string');
assert.equal(parsePositiveIntId(' 9 '), 9, 'trimmed');

console.log('parse-positive-int-id.selftest: ok');
