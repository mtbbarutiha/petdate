/**
 * SW bust generation must move when guest marketing routes change.
 * v14 cacheId stayed active after later bust *keys*, so #213's new shell
 * never replaced the controlling worker (live still showed Layout + /#pets).
 * Run: npx tsx packages/web/src/lib/swCache.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(webSrc, '..');
const sw = readFileSync(join(webSrc, 'lib/swRegister.ts'), 'utf8');
const vite = readFileSync(join(root, 'vite.config.ts'), 'utf8');

assert.match(sw, /petdate-sw-20260912-guest-vet-v16/, 'swRegister bust generation is v16');
assert.match(sw, /petdate-web-v16-guest-vet/, 'swRegister active cacheId is v16');
assert.match(vite, /cacheId:\s*'petdate-web-v16-guest-vet'/, 'vite PWA cacheId is v16');
assert.doesNotMatch(sw, /petdate-web-v14-pets-sync/, 'old v14 cacheId is no longer active');
assert.doesNotMatch(sw, /petdate-web-v15-vet-landing/, 'unshipped v15 cacheId is not active');
assert.doesNotMatch(sw, /petdate-sw-20260908-profile-pets-v14/, 'old v14 bust key is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-profile-about-pets-v2/, 'v14-cacheId bust key is retired');

console.log('swCache.selftest: ok');
