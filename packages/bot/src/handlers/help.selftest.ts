/**
 * Bot /help is role-aware, HTML, and covers trainer + guest (not a leftover stub).
 * Run: npx tsx packages/bot/src/handlers/help.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatBotHelpOverview,
  helpAudienceForUser,
  TELEGRAM_HELP_LIMIT,
} from '@petdate/shared';

const here = dirname(fileURLToPath(import.meta.url));
const helpSrc = readFileSync(join(here, 'help.ts'), 'utf8');
const indexSrc = readFileSync(join(here, 'index.ts'), 'utf8');
const startSrc = readFileSync(join(here, 'start.ts'), 'utf8');

assert.match(helpSrc, /formatBotHelpOverview/, 'handler uses shared overview');
assert.match(helpSrc, /parse_mode: 'HTML'/, 'help is HTML (no Markdown+underscore 400)');
assert.match(helpSrc, /help:t:/, 'topic callbacks');
assert.match(indexSrc, /help:t:\(\[a-z0-9\]\+\)/, 'index wires topic callbacks');
assert.match(indexSrc, /help:home/, 'index wires help home');
assert.match(startSrc, /export \{ handleHelp, handleHelpTopic \} from '\.\/help'/, 'start re-exports');
assert.doesNotMatch(startSrc, /به دنبال مشاوره برای خرید/, 'old no-pet help stub removed');
assert.doesNotMatch(helpSrc, /parse_mode: 'Markdown'/, 'no legacy Markdown help');

assert.equal(helpAudienceForUser({ role: 'trainer', roles: ['trainer'] }), 'trainer');
const trainer = formatBotHelpOverview('trainer');
assert.match(trainer, /مربی/, 'trainer title');
assert.ok(!/به‌زودی/.test(trainer), 'trainer is not coming-soon');
assert.ok(trainer.length < TELEGRAM_HELP_LIMIT);

const noPet = formatBotHelpOverview('no_pet');
assert.match(noPet, /مشورت با صاحبین|بدون پت/, 'no-pet documents owner advice');
assert.doesNotMatch(noPet, /به دنبال مشاوره برای خرید/);

console.log('bot help.selftest: ok');
