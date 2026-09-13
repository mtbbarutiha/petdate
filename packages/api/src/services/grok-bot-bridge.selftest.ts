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

assert.equal(TEAM_AGENTS.length, 4);
for (const a of TEAM_AGENTS) {
  assert.ok(a.grokBotKey, `${a.slug} missing grokBotKey`);
  assert.equal(getTeamAgentByGrokBotKey(a.grokBotKey)?.slug, a.slug);
  assert.equal(getTeamAgentByGrokBotKey(a.grokBotKey.replace(/_/g, '-'))?.slug, a.slug);
}

assert.equal(resolveTeamAgentFromGrokRef('yalda_shabani')?.kind, 'support');
assert.equal(resolveTeamAgentFromGrokRef('yalda_shabani')?.slug, 'sanaz-ghaffari');
assert.equal(resolveTeamAgentFromGrokRef('faranak-ahmadi')?.name, 'فرانک احمدی');
assert.equal(resolveTeamAgentFromGrokRef('sanaz_ghaffari')?.kind, 'support');
assert.equal(resolveTeamAgentFromGrokRef('leila_kiani')?.kind, 'finance');
assert.equal(resolveTeamAgentFromGrokRef('sara_noori')?.kind, 'vet');

delete process.env.GROK_BOT_AGENT_MAP;
delete process.env.GROK_BOT_FARANAK_AHMADI_ID;
delete process.env.GROK_BOT_FARANAK_AHMADI_URL;
delete process.env.GROK_BOT_SANAZ_GHAFFARI_ID;
delete process.env.GROK_BOT_SANAZ_GHAFFARI_URL;

const unlinked = resolveGrokBotLink(TEAM_AGENTS[0]!);
assert.equal(unlinked.linked, false);

process.env.GROK_BOT_FARANAK_AHMADI_ID = 'b6e496b5-0b15-4c9b-852d-644d3f5e411a';
process.env.GROK_BOT_SANAZ_GHAFFARI_ID = '18a4d76a-1900-49dc-964c-27d23abb31e9';
process.env.GROK_BOT_AGENT_MAP = JSON.stringify({
  leila_kiani: { id: 'gb-leila-pending' },
  sara_noori: '0140b645-f844-45c1-b6d8-3f06514529de',
});

const faranak = TEAM_AGENTS.find((a) => a.slug === 'faranak-ahmadi')!;
const sanaz = TEAM_AGENTS.find((a) => a.slug === 'sanaz-ghaffari')!;
const leila = TEAM_AGENTS.find((a) => a.slug === 'leila-kiani')!;
const sara = TEAM_AGENTS.find((a) => a.slug === 'sara-noori')!;

assert.deepEqual(resolveGrokBotLink(faranak), {
  id: 'b6e496b5-0b15-4c9b-852d-644d3f5e411a',
  url: null,
  linked: true,
});
assert.equal(resolveGrokBotLink(sanaz).id, '18a4d76a-1900-49dc-964c-27d23abb31e9');
assert.equal(resolveGrokBotLink(leila).id, 'gb-leila-pending');
assert.equal(resolveGrokBotLink(sara).id, '0140b645-f844-45c1-b6d8-3f06514529de');

const list = listTeamAgentsWithGrokBridge();
assert.equal(list.length, 4);
assert.ok(list.every((a) => a.chatPath && a.grokBotKey));
assert.equal(list.find((a) => a.slug === 'sanaz-ghaffari')?.chatPath, '/support/chat');
assert.equal(list.find((a) => a.slug === 'leila-kiani')?.chatPath, '/team-chat/leila-kiani');
assert.equal(list.find((a) => a.slug === 'leila-kiani')?.kind, 'finance');
assert.equal(list.find((a) => a.slug === 'leila-kiani')?.role, 'مدیر مالی');

const summary = grokBotBridgeSummary();
assert.equal(summary.source, 'grok_bot');
assert.equal(summary.rosterSize, 4);
assert.ok(summary.linkedCount >= 4);

delete process.env.GROK_BOT_FARANAK_AHMADI_ID;
delete process.env.GROK_BOT_SANAZ_GHAFFARI_ID;
delete process.env.GROK_BOT_AGENT_MAP;

console.log('grok-bot-bridge.selftest: ok');
