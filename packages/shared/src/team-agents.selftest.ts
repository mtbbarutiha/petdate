/**
 * Five site personas → three domain agents + exact chat routes.
 * Run: npx tsx packages/shared/src/team-agents.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  DEFAULT_TEAM_AGENT_SLUG,
  DEFAULT_VET_TEAM_AGENT_SLUG,
  SUPPORT_TEAM_AGENT_SLUG,
  TEAM_AGENTS,
  getTeamAgentBySlug,
  getTeamAgentByTelegramId,
  listTeamAgentTelegramIds,
  teamAgentChatPath,
  teamAgentOutOfDomainHint,
  teamAgentReferralForKind,
} from './team-agents';

assert.equal(TEAM_AGENTS.length, 5);
assert.equal(DEFAULT_TEAM_AGENT_SLUG, 'faranak-ahmadi');
assert.equal(DEFAULT_VET_TEAM_AGENT_SLUG, 'sara-noori');
assert.equal(SUPPORT_TEAM_AGENT_SLUG, 'yalda-shabani');

assert.equal(teamAgentChatPath('faranak-ahmadi'), '/team-chat/faranak-ahmadi');
assert.equal(teamAgentChatPath('leila-kiani'), '/team-chat/leila-kiani');
assert.equal(teamAgentChatPath('sanaz-ghaffari'), '/team-chat/sanaz-ghaffari');
assert.equal(teamAgentChatPath('sara-noori'), '/team-chat/sara-noori');
assert.equal(teamAgentChatPath('yalda-shabani'), '/support/chat');
assert.equal(teamAgentChatPath('pasha-yazdani'), '/team-chat/faranak-ahmadi');
assert.equal(teamAgentChatPath('layla-ahmadi'), '/team-chat/faranak-ahmadi');
assert.equal(teamAgentChatPath('sara-nozi'), '/team-chat/sara-noori');

assert.equal(getTeamAgentBySlug('faranak-ahmadi')?.kind, 'trainer');
assert.equal(getTeamAgentBySlug('leila-kiani')?.kind, 'trainer');
assert.equal(getTeamAgentBySlug('sanaz-ghaffari')?.kind, 'vet');
assert.equal(getTeamAgentBySlug('sara-noori')?.kind, 'vet');
assert.equal(getTeamAgentBySlug('sara-noori')?.role, 'دامپزشک');
assert.equal(getTeamAgentBySlug('sanaz-ghaffari')?.role, 'دامپزشک');
assert.equal(getTeamAgentBySlug('yalda-shabani')?.kind, 'support');
assert.equal(getTeamAgentByTelegramId('petdate_ai_sanaz_ghaffari')?.slug, 'sanaz-ghaffari');
assert.equal(getTeamAgentByTelegramId('petdate_ai_sara_nozi')?.slug, 'sara-noori');
assert.equal(getTeamAgentByTelegramId('petdate_ai_sara_noori')?.slug, 'sara-noori');
assert.equal(getTeamAgentByTelegramId('petdate_ai_sara_noori')?.kind, 'vet');
assert.ok(listTeamAgentTelegramIds(getTeamAgentBySlug('sara-noori')!).includes('petdate_ai_sara_nozi'));
assert.ok(listTeamAgentTelegramIds(getTeamAgentBySlug('sara-noori')!).includes('petdate_ai_sara_noori'));
assert.match(getTeamAgentBySlug('yalda-shabani')!.avatarUrl, /\/agents\/yalda-shabani\.jpg\?v=persona-v2$/, 'Yalda avatar is cache-busted');

for (const a of TEAM_AGENTS) {
  assert.match(a.avatarUrl, new RegExp(`/agents/${a.slug}\\.jpg\\?v=persona-v2$`), `${a.slug} avatar path`);
  assert.equal(a.cardImage, a.avatarUrl, `${a.slug} card matches avatar`);
  assert.ok(a.staffUsername, `${a.slug} staffUsername`);
  assert.ok(a.telegramId.startsWith('petdate_ai_'), `${a.slug} synthetic telegram id`);
}
assert.equal(getTeamAgentBySlug('sanaz-ghaffari')?.staffUsername, 'sanaz');
assert.equal(getTeamAgentBySlug('yalda-shabani')?.staffUsername, 'yalda');
assert.equal(getTeamAgentBySlug('faranak-ahmadi')?.staffUsername, 'faranak');

const trainerRef = teamAgentReferralForKind('trainer');
assert.equal(trainerRef.path, '/team-chat/faranak-ahmadi');
assert.match(trainerRef.name, /فرانک/);
const vetRef = teamAgentReferralForKind('vet');
assert.equal(vetRef.path, '/team-chat/sara-noori');
const supportRef = teamAgentReferralForKind('support');
assert.equal(supportRef.path, '/support/chat');

const trainerOod = teamAgentOutOfDomainHint('trainer');
assert.match(trainerOod, /\/team-chat\/sara-noori/);
assert.match(trainerOod, /\/support\/chat/);
const vetOod = teamAgentOutOfDomainHint('vet');
assert.match(vetOod, /\/team-chat\/faranak-ahmadi/);
assert.match(vetOod, /\/support\/chat/);
const supportOod = teamAgentOutOfDomainHint('support');
assert.match(supportOod, /\/team-chat\/faranak-ahmadi/);
assert.match(supportOod, /\/team-chat\/sara-noori/);

console.log('team-agents.selftest: ok');
