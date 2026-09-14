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

assert.match(api, /function asGameList/, 'asGameList normalizes payloads');
assert.match(api, /return \[\]/, 'empty/non-array payloads become []');
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
assert.match(api, /export async function createGame/, 'createGame helper');
assert.match(api, /export async function joinGame/, 'joinGame helper');
const gamesPage = readFileSync(join(webSrc, 'pages/GamesPage.tsx'), 'utf8');
assert.match(gamesPage, /listGames/, 'GamesPage uses listGames');
assert.match(gamesPage, /createGame/, 'GamesPage can create');
assert.match(gamesPage, /joinGame/, 'GamesPage can join');
assert.match(gamesPage, /uploadEventPhoto/, 'GamesPage uploads event photo');
assert.match(gamesPage, /EVENT_GAME_TYPES|pet_dating/, 'pet event types in form');
assert.match(gamesPage, /IRAN_PROVINCES/, 'province selector');
assert.match(gamesPage, /joinFeeCoins|fieldJoinFee/, 'join fee field');
assert.match(gamesPage, /fieldServices|services/, 'services field');
assert.match(api, /uploadEventPhoto/, 'uploadEventPhoto helper');

console.log('listGames.selftest: ok');
