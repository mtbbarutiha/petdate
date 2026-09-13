/**
 * Grok Bot ↔ team-agents bridge selftest.
 * Run: cd packages/api && npx tsx src/services/grok-bot-bridge.selftest.ts
 */
export {};

import assert from 'node:assert/strict';
import {
  TEAM_AGENTS,
  getTeamAgentByGrokBotKey,
} from '@petdate/shared';
import {
  grokBotBridgeSummary,
  listTeamAgentsWithGrokBridge,
  resolveGrokBotLink,
  resolveTeamAgentFromGrokRef,
} from './grok-bot-bridge';

assert.equal(TEAM_AGENTS.length, 5);
for (const a of TEAM_AGENTS) {
  assert.ok(a.grokBotKey, `${a.slug} missing grokBotKey`);
  assert.equal(getTeamAgentByGrokBotKey(a.grokBotKey)?.slug, a.slug);
  assert.equal(getTeamAgentByGrokBotKey(a.grokBotKey.replace(/_/g, '-'))?.slug, a.slug);
}

assert.equal(resolveTeamAgentFromGrokRef('yalda_shabani')?.kind, 'support');
assert.equal(resolveTeamAgentFromGrokRef('faranak-ahmadi')?.name, 'فرانک احمدی');
assert.equal(resolveTeamAgentFromGrokRef('sanaz_ghaffari')?.kind, 'vet');

delete process.env.GROK_BOT_AGENT_MAP;
delete process.env.GROK_BOT_FARANAK_AHMADI_ID;
delete process.env.GROK_BOT_FARANAK_AHMADI_URL;

const unlinked = resolveGrokBotLink(TEAM_AGENTS[0]!);
assert.equal(unlinked.linked, false);

process.env.GROK_BOT_FARANAK_AHMADI_ID = 'gb-faranak-test';
process.env.GROK_BOT_YALDA_SHABANI_URL = 'https://x.ai/grok-bot/yalda-test';
process.env.GROK_BOT_AGENT_MAP = JSON.stringify({
  leila_kiani: { id: 'gb-leila' },
  sara_noori: 'https://x.ai/grok-bot/sara',
});

const faranak = TEAM_AGENTS.find((a) => a.slug === 'faranak-ahmadi')!;
const yalda = TEAM_AGENTS.find((a) => a.slug === 'yalda-shabani')!;
const leila = TEAM_AGENTS.find((a) => a.slug === 'leila-kiani')!;
const sara = TEAM_AGENTS.find((a) => a.slug === 'sara-noori')!;

assert.deepEqual(resolveGrokBotLink(faranak), {
  id: 'gb-faranak-test',
  url: null,
  linked: true,
});
assert.equal(resolveGrokBotLink(yalda).url, 'https://x.ai/grok-bot/yalda-test');
assert.equal(resolveGrokBotLink(leila).id, 'gb-leila');
assert.equal(resolveGrokBotLink(sara).url, 'https://x.ai/grok-bot/sara');

const list = listTeamAgentsWithGrokBridge();
assert.equal(list.length, 5);
assert.ok(list.every((a) => a.chatPath && a.grokBotKey));
assert.equal(list.find((a) => a.slug === 'yalda-shabani')?.chatPath, '/support/chat');

const summary = grokBotBridgeSummary();
assert.equal(summary.source, 'grok_bot');
assert.equal(summary.rosterSize, 5);
assert.ok(summary.linkedCount >= 4);

delete process.env.GROK_BOT_FARANAK_AHMADI_ID;
delete process.env.GROK_BOT_YALDA_SHABANI_URL;
delete process.env.GROK_BOT_AGENT_MAP;
delete process.env.GROK_BOT_SARA_NOORI_ID;
process.env.GROK_BOT_SARA_NOZI_ID = 'gb-sara-legacy';
assert.equal(resolveGrokBotLink(sara).id, 'gb-sara-legacy', 'legacy SARA_NOZI env links Sara');
delete process.env.GROK_BOT_SARA_NOZI_ID;

console.log('grok-bot-bridge.selftest: ok');
