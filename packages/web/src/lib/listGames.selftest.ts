/**
 * Games list helper must never throw — a /api/games/list 500 must not blank the SPA.
 * Run: npx tsx packages/web/src/lib/listGames.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
const api = readFileSync(join(webSrc, 'lib/api.ts'), 'utf8');
const main = readFileSync(join(webSrc, 'main.tsx'), 'utf8');
const boundary = readFileSync(join(webSrc, 'components/AppErrorBoundary.tsx'), 'utf8');

assert.match(api, /export async function listGames/, 'listGames helper exists');
assert.match(api, /\/api\/games\/list/, 'listGames prefers /api/games/list');
assert.match(api, /return \[\];/, 'listGames returns [] on failure');
assert.match(
  api,
  /export async function listGames[\s\S]*catch \{[\s\S]*return \[\];/,
  'listGames swallows fetch/parse errors'
);

assert.match(main, /<AppErrorBoundary>/, 'root render wraps the app in AppErrorBoundary');
assert.match(boundary, /class AppErrorBoundary/, 'AppErrorBoundary is a class boundary');
assert.match(boundary, /getDerivedStateFromError/, 'boundary catches render errors');
assert.match(boundary, /تلاش دوباره/, 'boundary offers reload');

console.log('listGames.selftest: ok');
