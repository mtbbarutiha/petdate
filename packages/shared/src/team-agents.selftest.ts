/**
 * Four landing personas + Yalda support: kinds, Grok engine ids, exact chat routes.
 * Run: npx tsx packages/shared/src/team-agents.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  DEFAULT_FINANCE_TEAM_AGENT_SLUG,
  DEFAULT_TEAM_AGENT_SLUG,
  DEFAULT_VET_TEAM_AGENT_SLUG,
  LANDING_TEAM_AGENT_SLUGS,
  SUPPORT_TEAM_AGENT_SLUG,
  TEAM_AGENT_GROK_ENGINE_IDS,
  TEAM_AGENTS,
  getTeamAgentByGrokBotId,
  getTeamAgentBySlug,
  getTeamAgentByTelegramId,
  landingTeamAgents,
  listTeamAgentTelegramIds,
  teamAgentChatPath,
  teamAgentOutOfDomainHint,
  teamAgentReferralForKind,
} from './team-agents';

assert.equal(TEAM_AGENTS.length, 5);
assert.equal(DEFAULT_TEAM_AGENT_SLUG, 'faranak-ahmadi');
assert.equal(DEFAULT_VET_TEAM_AGENT_SLUG, 'sara-noori');
assert.equal(DEFAULT_FINANCE_TEAM_AGENT_SLUG, 'leila-kiani');
assert.equal(SUPPORT_TEAM_AGENT_SLUG, 'yalda-shabani');
assert.deepEqual(LANDING_TEAM_AGENT_SLUGS, [
  'faranak-ahmadi',
  'leila-kiani',
  'sanaz-ghaffari',
  'sara-noori',
]);
assert.equal(landingTeamAgents().length, 4);
assert.ok(!landingTeamAgents().some((a) => a.slug === 'yalda-shabani'));

assert.equal(teamAgentChatPath('faranak-ahmadi'), '/team-chat/faranak-ahmadi');
assert.equal(teamAgentChatPath('leila-kiani'), '/team-chat/leila-kiani');
assert.equal(teamAgentChatPath('sanaz-ghaffari'), '/team-chat/sanaz-ghaffari');
assert.equal(teamAgentChatPath('sara-noori'), '/team-chat/sara-noori');
assert.equal(teamAgentChatPath('yalda-shabani'), '/support/chat');
assert.equal(teamAgentChatPath('pasha-yazdani'), '/team-chat/faranak-ahmadi');
assert.equal(teamAgentChatPath('layla-ahmadi'), '/team-chat/faranak-ahmadi');
assert.equal(teamAgentChatPath('sara-nozi'), '/team-chat/sara-noori');

const EXPECTED: Record<string, { kind: string; role: string; id: string }> = {
  'faranak-ahmadi': { kind: 'trainer', role: 'مربی', id: 'b6e496b5-0b15-4c9b-852d-644d3f5e411a' },
  'leila-kiani': { kind: 'finance', role: 'مدیر مالی', id: '2410554d-9496-4a60-9b15-4248dcc6e725' },
  'sanaz-ghaffari': { kind: 'support', role: 'پشتیبانی', id: '18a4d76a-1900-49dc-964c-27d23abb31e9' },
  'sara-noori': { kind: 'vet', role: 'دامپزشک', id: '0140b645-f844-45c1-b6d8-3f06514529de' },
  'yalda-shabani': { kind: 'support', role: 'پشتیبانی', id: '18a4d76a-1900-49dc-964c-27d23abb31e9' },
};

for (const [slug, expect] of Object.entries(EXPECTED)) {
  const agent = getTeamAgentBySlug(slug);
  assert.ok(agent, `${slug} missing`);
  assert.equal(agent!.kind, expect.kind, `${slug} kind`);
  assert.equal(agent!.role, expect.role, `${slug} role`);
  assert.equal(agent!.grokBotId, expect.id, `${slug} grok engine id`);
  assert.equal(TEAM_AGENT_GROK_ENGINE_IDS[slug as keyof typeof TEAM_AGENT_GROK_ENGINE_IDS], expect.id);
  assert.equal(getTeamAgentByGrokBotId(expect.id)?.slug === slug || slug === 'yalda-shabani' || slug === 'sanaz-ghaffari', true);
}

assert.notEqual(getTeamAgentBySlug('sanaz-ghaffari')?.kind, 'vet', 'Sanaz is not vet');
assert.notEqual(getTeamAgentBySlug('leila-kiani')?.kind, 'trainer', 'Leila is not trainer');
assert.equal(TEAM_AGENTS.filter((a) => a.kind === 'vet').length, 1, 'only one veterinarian');
assert.equal(TEAM_AGENTS.find((a) => a.kind === 'vet')?.slug, 'sara-noori');
assert.equal(
  landingTeamAgents().filter((a) => a.kind === 'vet' || a.role === 'دامپزشک').length,
  1,
  'only Sara is vet among landing/team-chat doctors',
);
assert.ok(
  landingTeamAgents().every((a) => a.slug !== 'sara-noori' || (a.kind === 'vet' && a.role === 'دامپزشک')),
);

assert.equal(getTeamAgentBySlug('sanaz-ghaffari')?.name, 'ساناز غفاری');
assert.equal(getTeamAgentBySlug('yalda-shabani')?.kind, 'support');
assert.equal(getTeamAgentByTelegramId('petdate_ai_sanaz_ghaffari')?.slug, 'sanaz-ghaffari');
assert.equal(getTeamAgentByTelegramId('petdate_ai_sanaz_ghaffari')?.kind, 'support');
assert.equal(getTeamAgentByTelegramId('petdate_ai_sara_nozi')?.slug, 'sara-noori');
assert.equal(getTeamAgentByTelegramId('petdate_ai_sara_noori')?.slug, 'sara-noori');
assert.equal(getTeamAgentByTelegramId('petdate_ai_sara_noori')?.kind, 'vet');
assert.equal(getTeamAgentByTelegramId('petdate_ai_assistant')?.kind, 'finance');
assert.ok(listTeamAgentTelegramIds(getTeamAgentBySlug('sara-noori')!).includes('petdate_ai_sara_nozi'));
assert.ok(listTeamAgentTelegramIds(getTeamAgentBySlug('sara-noori')!).includes('petdate_ai_sara_noori'));
assert.match(getTeamAgentBySlug('yalda-shabani')!.avatarUrl, /\/agents\/yalda-shabani\.jpg\?v=persona-v2$/, 'Yalda avatar is cache-busted');

for (const a of TEAM_AGENTS) {
  assert.match(a.avatarUrl, new RegExp(`/agents/${a.slug}\\.jpg\\?v=persona-v2$`), `${a.slug} avatar path`);
  assert.equal(a.cardImage, a.avatarUrl, `${a.slug} card matches avatar`);
  assert.ok(a.staffUsername, `${a.slug} staffUsername`);
  assert.ok(a.telegramId.startsWith('petdate_ai_'), `${a.slug} synthetic telegram id`);
  assert.ok(a.grokBotId, `${a.slug} grokBotId`);
}
assert.equal(getTeamAgentBySlug('sanaz-ghaffari')?.staffUsername, 'sanaz');
assert.equal(getTeamAgentBySlug('yalda-shabani')?.staffUsername, 'yalda');
assert.equal(getTeamAgentBySlug('faranak-ahmadi')?.staffUsername, 'faranak');
assert.equal(getTeamAgentBySlug('leila-kiani')?.staffUsername, 'leila');

const trainerRef = teamAgentReferralForKind('trainer');
assert.equal(trainerRef.path, '/team-chat/faranak-ahmadi');
assert.match(trainerRef.name, /فرانک/);
const vetRef = teamAgentReferralForKind('vet');
assert.equal(vetRef.path, '/team-chat/sara-noori');
const supportRef = teamAgentReferralForKind('support');
assert.equal(supportRef.path, '/support/chat');
const financeRef = teamAgentReferralForKind('finance');
assert.equal(financeRef.path, '/team-chat/leila-kiani');
assert.equal(financeRef.role, 'مدیر مالی');

const trainerOod = teamAgentOutOfDomainHint('trainer');
assert.match(trainerOod, /\/team-chat\/sara-noori/);
assert.match(trainerOod, /\/support\/chat/);
assert.match(trainerOod, /\/team-chat\/leila-kiani/);
const vetOod = teamAgentOutOfDomainHint('vet');
assert.match(vetOod, /\/team-chat\/faranak-ahmadi/);
assert.match(vetOod, /\/support\/chat/);
const supportOod = teamAgentOutOfDomainHint('support');
assert.match(supportOod, /\/team-chat\/faranak-ahmadi/);
assert.match(supportOod, /\/team-chat\/sara-noori/);
assert.match(supportOod, /\/team-chat\/leila-kiani/);
const financeOod = teamAgentOutOfDomainHint('finance');
assert.match(financeOod, /\/team-chat\/faranak-ahmadi/);
assert.match(financeOod, /\/team-chat\/sara-noori/);
assert.match(financeOod, /\/support\/chat/);
assert.doesNotMatch(financeOod, /دامپزشک ساناز|\/team-chat\/sanaz/);

console.log('team-agents.selftest: ok');
