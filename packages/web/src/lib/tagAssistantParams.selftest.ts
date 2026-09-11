/**
 * Tag Assistant query-param helpers.
 * Run: npx tsx packages/web/src/lib/tagAssistantParams.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  hasTagAssistantParams,
  isTagAssistantParamKey,
  missingTagAssistantEntries,
  pickTagAssistantParams,
  stripTagAssistantParams,
  withTagAssistantParams,
} from './tagAssistantParams.ts';

assert.equal(isTagAssistantParamKey('gtm_debug'), true);
assert.equal(isTagAssistantParamKey('_dbg'), true);
assert.equal(isTagAssistantParamKey('next'), false);

const picked = pickTagAssistantParams('?gtm_debug=1789122177791&utm_source=x&_dbg=1');
assert.equal(picked.get('gtm_debug'), '1789122177791');
assert.equal(picked.get('_dbg'), '1');
assert.equal(picked.has('utm_source'), false);
assert.equal(hasTagAssistantParams('?gtm_debug='), true);
assert.equal(hasTagAssistantParams('?foo=1'), false);

assert.equal(
  stripTagAssistantParams('/home?gtm_debug=abc&next=%2Fwallet&_dbg=1'),
  '/home?next=%2Fwallet',
);
assert.equal(stripTagAssistantParams('/home?gtm_debug=abc'), '/home');
assert.equal(stripTagAssistantParams('/home'), '/home');
assert.equal(stripTagAssistantParams('/shop?utm_source=tg#top'), '/shop?utm_source=tg#top');

assert.equal(
  withTagAssistantParams('/auth/login?next=%2Fhome', '?gtm_debug=1789122177791&_dbg=1'),
  '/auth/login?next=%2Fhome&gtm_debug=1789122177791&_dbg=1',
);
assert.equal(withTagAssistantParams('/shop', '?utm_source=tg'), '/shop');
assert.equal(
  withTagAssistantParams('/?foo=1', '?gtm_debug=test123'),
  '/?foo=1&gtm_debug=test123',
);

// Empty gtm_debug still preserved when merging
assert.equal(withTagAssistantParams('/', '?gtm_debug='), '/?gtm_debug=');

// missingTagAssistantEntries without sessionStorage memory: nothing missing if not present
assert.deepEqual(missingTagAssistantEntries('?foo=1'), []);

console.log('tagAssistantParams.selftest: OK');
