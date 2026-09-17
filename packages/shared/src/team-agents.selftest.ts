/**
 * Four public team personas: kinds, Grok engine ids, exact chat routes.
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

assert.equal(TEAM_AGENTS.length, 4);
assert.equal(DEFAULT_TEAM_AGENT_SLUG, 'faranak-ahmadi');
assert.equal(DEFAULT_VET_TEAM_AGENT_SLUG, 'sara-noori');
assert.equal(DEFAULT_FINANCE_TEAM_AGENT_SLUG, 'leila-kiani');
assert.equal(SUPPORT_TEAM_AGENT_SLUG, 'sanaz-ghaffari');
assert.deepEqual(LANDING_TEAM_AGENT_SLUGS, [
  'faranak-ahmadi',
  'leila-kiani',
  'sanaz-ghaffari',
  'sara-noori',
]);
assert.equal(landingTeamAgents().length, 4);
assert.ok(!landingTeamAgents().some((a) => a.name.includes('یلدا')));
assert.ok(!TEAM_AGENTS.some((a) => a.slug === 'yalda-shabani'));

assert.equal(teamAgentChatPath('faranak-ahmadi'), '/team-chat/faranak-ahmadi');
assert.equal(teamAgentChatPath('leila-kiani'), '/team-chat/leila-kiani');
assert.equal(teamAgentChatPath('sanaz-ghaffari'), '/support/chat');
assert.equal(teamAgentChatPath('sara-noori'), '/team-chat/sara-noori');
assert.equal(teamAgentChatPath('yalda-shabani'), '/support/chat');
assert.equal(teamAgentChatPath('pasha-yazdani'), '/team-chat/faranak-ahmadi');
assert.equal(teamAgentChatPath('layla-ahmadi'), '/team-chat/faranak-ahmadi');
assert.equal(teamAgentChatPath('sara-nozi'), '/team-chat/sara-noori');

const EXPECTED: Record<string, { kind: string; role: string; id: string; name: string }> = {
  'faranak-ahmadi': {
    kind: 'trainer',
    role: 'مربی',
    id: 'b6e496b5-0b15-4c9b-852d-644d3f5e411a',
    name: 'فرانک احمدی',
  },
  'leila-kiani': {
    kind: 'finance',
    role: 'مدیر مالی',
    id: '2410554d-9496-4a60-9b15-4248dcc6e725',
    name: 'لیلا کیانی',
  },
  'sanaz-ghaffari': {
    kind: 'support',
    role: 'پشتیبانی',
    id: '18a4d76a-1900-49dc-964c-27d23abb31e9',
    name: 'ساناز غفاری',
  },
  'sara-noori': {
    kind: 'vet',
    role: 'دامپزشک',
    id: '0140b645-f844-45c1-b6d8-3f06514529de',
    name: 'سارا نوری',
  },
};

for (const [slug, expect] of Object.entries(EXPECTED)) {
  const agent = getTeamAgentBySlug(slug);
  assert.ok(agent, `${slug} missing`);
  assert.equal(agent!.kind, expect.kind, `${slug} kind`);
  assert.equal(agent!.role, expect.role, `${slug} role`);
  assert.equal(agent!.name, expect.name, `${slug} name`);
  assert.equal(agent!.grokBotId, expect.id, `${slug} grok engine id`);
  assert.equal(TEAM_AGENT_GROK_ENGINE_IDS[slug as keyof typeof TEAM_AGENT_GROK_ENGINE_IDS], expect.id);
}

assert.equal(getTeamAgentBySlug('yalda-shabani')?.slug, 'sanaz-ghaffari');
assert.equal(getTeamAgentBySlug('yalda-shabani')?.kind, 'support');
assert.equal(getTeamAgentByGrokBotId('18a4d76a-1900-49dc-964c-27d23abb31e9')?.slug, 'sanaz-ghaffari');

assert.notEqual(getTeamAgentBySlug('sanaz-ghaffari')?.kind, 'vet', 'Sanaz is not vet');
assert.notEqual(getTeamAgentBySlug('leila-kiani')?.kind, 'trainer', 'Leila is not trainer');
assert.equal(TEAM_AGENTS.filter((a) => a.kind === 'vet').length, 1, 'only one veterinarian');
assert.equal(TEAM_AGENTS.filter((a) => a.kind === 'support').length, 1);
assert.equal(TEAM_AGENTS.find((a) => a.kind === 'vet')?.slug, 'sara-noori');

assert.equal(getTeamAgentByTelegramId('petdate_ai_sanaz_ghaffari')?.slug, 'sanaz-ghaffari');
assert.equal(getTeamAgentByTelegramId('petdate_ai_sara_nozi')?.slug, 'sara-noori');
assert.equal(getTeamAgentByTelegramId('petdate_ai_sara_noori')?.kind, 'vet');
assert.equal(getTeamAgentByTelegramId('petdate_ai_assistant')?.kind, 'finance');
assert.ok(listTeamAgentTelegramIds(getTeamAgentBySlug('sara-noori')!).includes('petdate_ai_sara_nozi'));

for (const a of TEAM_AGENTS) {
  assert.match(
    a.avatarUrl,
    new RegExp(`/agents/${a.slug}-480\\.webp\\?v=persona-v4$`),
    `${a.slug} avatar path`,
  );
  assert.equal(a.cardImage, a.avatarUrl, `${a.slug} card matches avatar`);
  assert.ok(a.staffUsername, `${a.slug} staffUsername`);
  assert.ok(a.telegramId.startsWith('petdate_ai_'), `${a.slug} synthetic telegram id`);
  assert.ok(a.grokBotId, `${a.slug} grokBotId`);
}
assert.equal(getTeamAgentBySlug('sanaz-ghaffari')?.staffUsername, 'sanaz');
assert.equal(getTeamAgentBySlug('faranak-ahmadi')?.staffUsername, 'faranak');
assert.equal(getTeamAgentBySlug('leila-kiani')?.staffUsername, 'leila');

const trainerRef = teamAgentReferralForKind('trainer');
assert.equal(trainerRef.path, '/team-chat/faranak-ahmadi');
assert.match(trainerRef.name, /فرانک/);
const vetRef = teamAgentReferralForKind('vet');
assert.equal(vetRef.path, '/team-chat/sara-noori');
assert.equal(vetRef.name, 'سارا نوری');
const supportRef = teamAgentReferralForKind('support');
assert.equal(supportRef.path, '/support/chat');
assert.equal(supportRef.name, 'ساناز غفاری');
const financeRef = teamAgentReferralForKind('finance');
assert.equal(financeRef.path, '/team-chat/leila-kiani');
assert.equal(financeRef.role, 'مدیر مالی');

const trainerOod = teamAgentOutOfDomainHint('trainer');
assert.match(trainerOod, /\/team-chat\/sara-noori/);
assert.match(trainerOod, /\/support\/chat/);
assert.match(trainerOod, /\/team-chat\/leila-kiani/);
const financeOod = teamAgentOutOfDomainHint('finance');
assert.match(financeOod, /\/support\/chat/);
assert.doesNotMatch(financeOod, /دامپزشک ساناز|\/team-chat\/sanaz/);

console.log('team-agents.selftest: ok');
