/**
 * Public marketing routes must stay reachable without login.
 * Run: npx tsx packages/web/src/lib/publicRoutes.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
const guard = readFileSync(join(webSrc, 'components/AuthGuard.tsx'), 'utf8');
const app = readFileSync(join(webSrc, 'App.tsx'), 'utf8');

assert.match(guard, /PUBLIC_EXACT[\s\S]*\/vet-consult/, 'AuthGuard treats /vet-consult as public');
assert.match(guard, /PUBLIC_PREFIXES[\s\S]*\/magazine/, 'AuthGuard treats /magazine as public');
assert.match(guard, /\/adoption/, 'AuthGuard treats /adoption as public');
assert.match(app, /path="adoption"\s+element=\{<AdoptionListPage/, 'App registers /adoption listing');
assert.match(app, /path="vet-consult"/, 'App registers /vet-consult');

console.log('publicRoutes.selftest: ok');
