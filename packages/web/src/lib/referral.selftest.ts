/**
 * Invite ref persist / parse for /invite and login attribution.
 * Run: npx tsx packages/web/src/lib/referral.selftest.ts
 */
import assert from 'node:assert/strict';
import { parseReferralRef } from '@petdate/shared';
import {
  captureReferralFromLocation,
  clearStoredReferralRef,
  persistReferralRef,
  readStoredReferralRef,
} from './referral.ts';

const store = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, String(v));
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => store.clear(),
  key: () => null,
  get length() {
    return store.size;
  },
} as Storage;

clearStoredReferralRef();
assert.equal(readStoredReferralRef(), null);
assert.equal(persistReferralRef('ref_42'), 42);
assert.equal(readStoredReferralRef(), 42);
assert.equal(persistReferralRef('nope'), null);
assert.equal(readStoredReferralRef(), 42, 'invalid persist must not wipe');

assert.equal(captureReferralFromLocation('?ref=9', '/invite'), 9);
assert.equal(readStoredReferralRef(), 9);
assert.equal(captureReferralFromLocation('?start=ref_11', '/'), 11);
assert.equal(parseReferralRef('https://petdate.ir/invite?ref=11'), 11);

clearStoredReferralRef();
assert.equal(readStoredReferralRef(), null);

console.log('referral.selftest: ok');
