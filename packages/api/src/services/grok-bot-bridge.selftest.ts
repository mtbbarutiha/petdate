/**
 * Grok Bot ↔ team-agents bridge selftest.
 * Run: cd packages/api && npx tsx src/services/grok-bot-bridge.selftest.ts
 */
export {};

import assert from 'node:assert/strict';
import {
  TEAM_AGENT_GROK_ENGINE_IDS,
  TEAM_AGENTS,
  getTeamAgentByGrokBotKey,
} from '@petdate/shared';
import {
  grokBotBridgeSummary,
  listTeamAgentsWithGrokBridge,
  resolveGrokBotLink,
  resolveTeamAgentFromGrokRef,
} from './grok-bot-bridge';

assert.equal(TEAM_AGENTS.length, 4);
for (const a of TEAM_AGENTS) {
  assert.ok(a.grokBotKey, `${a.slug} missing grokBotKey`);
  assert.ok(a.grokBotId, `${a.slug} missing grokBotId`);
  assert.equal(a.grokBotId, TEAM_AGENT_GROK_ENGINE_IDS[a.slug]);
  assert.equal(getTeamAgentByGrokBotKey(a.grokBotKey)?.slug, a.slug);
  assert.equal(getTeamAgentByGrokBotKey(a.grokBotKey.replace(/_/g, '-'))?.slug, a.slug);
}

assert.equal(resolveTeamAgentFromGrokRef('yalda_shabani')?.kind, 'support');
assert.equal(resolveTeamAgentFromGrokRef('yalda_shabani')?.slug, 'sanaz-ghaffari');
assert.equal(resolveTeamAgentFromGrokRef('faranak-ahmadi')?.name, 'فرانک احمدی');
assert.equal(resolveTeamAgentFromGrokRef('sanaz_ghaffari')?.kind, 'support');
assert.notEqual(resolveTeamAgentFromGrokRef('sanaz_ghaffari')?.kind, 'vet');
assert.equal(resolveTeamAgentFromGrokRef('leila_kiani')?.kind, 'finance');
assert.notEqual(resolveTeamAgentFromGrokRef('leila_kiani')?.kind, 'trainer');
assert.equal(resolveTeamAgentFromGrokRef('sara_noori')?.name, 'سارا نوری');

delete process.env.GROK_BOT_AGENT_MAP;
delete process.env.GROK_BOT_FARANAK_AHMADI_ID;
delete process.env.GROK_BOT_FARANAK_AHMADI_URL;
delete process.env.GROK_BOT_SANAZ_GHAFFARI_URL;

const faranak = TEAM_AGENTS.find((a) => a.slug === 'faranak-ahmadi')!;
const leila = TEAM_AGENTS.find((a) => a.slug === 'leila-kiani')!;
const sara = TEAM_AGENTS.find((a) => a.slug === 'sara-noori')!;
const sanaz = TEAM_AGENTS.find((a) => a.slug === 'sanaz-ghaffari')!;

const baked = resolveGrokBotLink(faranak);
assert.equal(baked.id, TEAM_AGENT_GROK_ENGINE_IDS['faranak-ahmadi']);
assert.equal(baked.linked, true, 'baked Grok engine id marks persona linked');

process.env.GROK_BOT_FARANAK_AHMADI_ID = 'gb-faranak-test';
process.env.GROK_BOT_SANAZ_GHAFFARI_URL = 'https://x.ai/grok-bot/sanaz-test';
process.env.GROK_BOT_AGENT_MAP = JSON.stringify({
  leila_kiani: { id: 'gb-leila' },
  sara_noori: 'https://x.ai/grok-bot/sara',
});

assert.deepEqual(resolveGrokBotLink(faranak), {
  id: 'gb-faranak-test',
  url: null,
  linked: true,
});
assert.equal(resolveGrokBotLink(sanaz).url, 'https://x.ai/grok-bot/sanaz-test');
assert.equal(resolveGrokBotLink(leila).id, 'gb-leila');
assert.equal(resolveGrokBotLink(sara).url, 'https://x.ai/grok-bot/sara');
assert.equal(resolveGrokBotLink(sara).id, TEAM_AGENT_GROK_ENGINE_IDS['sara-noori']);

const list = listTeamAgentsWithGrokBridge();
assert.equal(list.length, 4);
assert.ok(list.every((a) => a.chatPath && a.grokBotKey && a.grokBotId));
assert.equal(list.find((a) => a.slug === 'sanaz-ghaffari')?.chatPath, '/support/chat');
assert.equal(list.find((a) => a.slug === 'leila-kiani')?.kind, 'finance');
assert.equal(list.find((a) => a.slug === 'sanaz-ghaffari')?.kind, 'support');
assert.equal(list.find((a) => a.slug === 'sara-noori')?.kind, 'vet');
assert.ok(!list.some((a) => a.slug === 'yalda-shabani'));

const summary = grokBotBridgeSummary();
assert.equal(summary.source, 'grok_bot');
assert.equal(summary.rosterSize, 4);
assert.equal(summary.linkedCount, 4);

delete process.env.GROK_BOT_FARANAK_AHMADI_ID;
delete process.env.GROK_BOT_SANAZ_GHAFFARI_URL;
delete process.env.GROK_BOT_AGENT_MAP;
delete process.env.GROK_BOT_SARA_NOORI_ID;
process.env.GROK_BOT_SARA_NOZI_ID = 'gb-sara-legacy';
assert.equal(resolveGrokBotLink(sara).id, 'gb-sara-legacy', 'legacy SARA_NOZI env links Sara');
delete process.env.GROK_BOT_SARA_NOZI_ID;

console.log('grok-bot-bridge.selftest: ok');
