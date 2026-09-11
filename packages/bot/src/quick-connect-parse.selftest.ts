/**
 * Guard: bot quick-connect mapper must surface aiFallback so trainer/vet
 * AI sessions (پاشا) enter sticky vet_chat instead of dying on the main menu.
 *
 * Run: npx tsx packages/bot/src/quick-connect-parse.selftest.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseQuickVetConnectFailure,
  parseQuickVetConnectSuccess,
} from './api-client';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const srcPath = join(__dirname, 'api-client.ts');
const src = readFileSync(srcPath, 'utf8');

assert(
  /aiFallback:\s*Boolean\(json\.aiFallback\)/.test(src),
  'quickVetConnect success mapper must pass aiFallback from API JSON'
);
assert(
  /advice:\s*typeof json\.advice === 'string'/.test(src),
  'quickVetConnect success mapper must pass advice text'
);

const human = parseQuickVetConnectSuccess({
  sent: 2,
  cost: 50,
  coins: 100,
  consultations: [{ id: 1 }],
  message: 'درخواست ارسال شد',
});
assert(human.ok === true, 'human ok');
assert(human.aiFallback === false, 'human path: aiFallback false');
assert(human.advice === undefined, 'human path: no advice');
assert(human.sent === 2 && human.cost === 50, 'human counters');

const ai = parseQuickVetConnectSuccess({
  sent: 1,
  cost: 0,
  coins: 100,
  consultations: [{ id: 42, vetUserId: 7, serviceKind: 'trainer' }],
  message: 'گفتگو با دکتر لیلا کیانی شروع شد',
  aiFallback: true,
  advice: 'سلام — من دکتر لیلا کیانی‌ام.',
  adviceSource: 'offline',
  serviceKind: 'trainer',
});
assert(ai.aiFallback === true, 'AI path: aiFallback must be true');
assert(ai.advice?.includes('پاشا'), 'AI path: advice preserved');
assert(ai.adviceSource === 'offline', 'AI path: adviceSource');
assert(ai.serviceKind === 'trainer', 'AI path: serviceKind');
assert(ai.consultations[0]?.id === 42, 'AI path: consult id');

const fail = parseQuickVetConnectFailure(
  409,
  { error: 'هنوز درخواست باز است', reason: 'already_pending', code: 'ALREADY_PENDING' },
  ''
);
assert(fail.ok === false, 'failure ok=false');
assert(fail.reason === 'already_pending', 'failure reason');
assert(fail.code === 'ALREADY_PENDING', 'failure code');

console.log('quick-connect-parse.selftest: ok');
