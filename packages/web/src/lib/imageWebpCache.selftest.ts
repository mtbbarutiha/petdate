/**
 * Web image URL helper selftest.
 * Run: npx tsx packages/web/src/lib/imageWebpCache.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = join(webRoot, '../..');
const apiSrc = readFileSync(join(repoRoot, 'packages/api/src/routes/img.ts'), 'utf8');
const apiCache = readFileSync(join(repoRoot, 'packages/api/src/services/image-cache.ts'), 'utf8');
const webApi = readFileSync(join(webRoot, 'src/lib/api.ts'), 'utf8');

assert.match(apiSrc, /imgRouter/, 'img route exists');
assert.match(apiCache, /getOrCreateCachedWebp/, 'disk webp cache exists');
assert.match(apiCache, /image-cache/, 'cache dir name');
assert.match(webApi, /toCachedWebpUrl/, 'frontend helper');
assert.match(webApi, /\/api\/img/, 'routes through /api/img');
assert.match(webApi, /\.webp\$\/i\.test\(pathname\)/, 'skips already-WebP assets from /api/img hop');
assert.match(webApi, /\/api\/hero\/images\//, 'keeps hero paths direct');

console.log('imageWebpCache.selftest: ok');
